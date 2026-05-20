import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

function isAbsolute(p: string): boolean {
  return /^([A-Za-z]:[/\\]|\/|\\)/.test(p)
}

function nextReviewNumber(base: string): string {
  const tmpDir = path.join(base, "tmp")
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true })
    return "001"
  }

  const files = fs.readdirSync(tmpDir)
  const reviewFiles = files.filter(f => /^review-(\d+)\.json$/.test(f))
  if (reviewFiles.length === 0) return "001"

  const maxNum = Math.max(
    ...reviewFiles.map(f => {
      const m = f.match(/^review-(\d+)\.json$/)
      return m ? parseInt(m[1], 10) : 0
    })
  )

  return String(maxNum + 1).padStart(3, "0")
}

const DEDUCTION_BASE = 5
const REJECT_THRESHOLD = 40
const SEVERE_SEVERITY_MIN = 4

interface ComputedResult {
  item: string
  result: string
  note: string
  severity: number
  occurrences: number
  deduction: number
  citation?: string
}

interface DeductionEntry {
  id: string
  content: string
  severity: "low" | "medium" | "high"
  citation?: string
}

function mapSeverity(severity: number): "low" | "medium" | "high" {
  if (severity <= 1) return "low"
  if (severity <= 2) return "medium"
  return "high"
}

interface CriticReport {
  report_type: string
  article: string
  verdict: string
  score: number
  deduction_detail: {
    total_deduction: number
    doubt_count: number
    severe_reject: boolean
    threshold_reject: boolean
    threshold: number
    items: ComputedResult[]
  }
  item_results: Array<{
    item: string
    result: string
    severity: number
    note: string
    citation?: string
    occurrences?: number
  }>
  deductions: DeductionEntry[]
  common_errors?: Array<Record<string, unknown>>
  danger_signals?: Array<Record<string, unknown>>
  overall_assessment?: string
  overall_recommendation?: string
}

export default tool({
  description: "写入批评家审查报告, 保存到 tmp/review-NNN.json, 自动计算扣分与判定, 并返回摘要行.",
  args: {
    report_type: tool.schema.string().describe("报告类型. 按当前 critic 职责填写, 如 `原创性审查`, `结构与技法`, `声音与合规`, `AI 感审查`."),
    article: tool.schema.string().describe("被审查的文章路径, 使用收到的文章路径, 如 `./output/xxx.txt`."),
    item_results: tool.schema.array(tool.schema.object({
      item: tool.schema.string().describe("检查项名称, 必须包含编号与名称, 如 `A1 句式套用`, `B2 螺旋自然性`, `C6 说教脚手架`, `D3 过渡词脚手架`."),
      result: tool.schema.string().describe("检查结果, 只能使用 `PASS`, `DOUBT`, `REJECT`."),
      severity: tool.schema.number().describe("扣分倍率. PASS 填 0; DOUBT/REJECT 按当前检查项判定表中的 severity 填写."),
      note: tool.schema.string().describe("对该检查项的具体判断说明. 必须说明为什么 PASS/DOUBT/REJECT."),
      citation: tool.schema.string().optional().describe("原文精确引用. REJECT/DOUBT 项必须提供, 除非问题是结构性整体问题而无法精确引用. 多条引用用分号分隔. PASS 项通常不需要."),
      occurrences: tool.schema.number().optional().describe("REJECT 时的问题数量, 不传则默认为 1. DOUBT/PASS 通常不传."),
    })).describe("逐项检查结果数组. 每个检查项都写一条结果; 工具会根据 result/severity/occurrences 自动计算总扣分、总分和 PASS/REJECT 判定."),
    common_errors: tool.schema.array(tool.schema.any()).optional().describe("常见错误数组. 仅声音与合规审查需要时使用; 每项应包含 type/location/description 等可读字段."),
    danger_signals: tool.schema.array(tool.schema.any()).optional().describe("危险信号数组. 仅声音与合规审查需要时使用; 每项应包含 signal/description 等可读字段."),
    overall_assessment: tool.schema.string().optional().describe("总体评估. 原创性审查可用; 用一段话概括整体原创性风险."),
    overall_recommendation: tool.schema.string().optional().describe("整体建议. 结构与技法、声音与合规、AI 感审查可用; 用一段话概括是否建议修改及重点."),
  },
  async execute(args, context) {
    // --- validation ---
    if (!args.report_type) throw new Error("report_type 不能为空")
    if (!args.item_results || args.item_results.length === 0) throw new Error("item_results 不能为空")

    // --- calculate score and verdict ---
    let totalDeduction = 0
    let passCount = 0, doubtCount = 0, rejectCount = 0
    let severeReject = false
    const computedResults: ComputedResult[] = []

    for (const item of args.item_results) {
      const result = (item.result || "PASS").trim()
      const severity = typeof item.severity === "number" ? item.severity : 0
      const occurrences = result === "REJECT" ? (item.occurrences ?? 1) : 0
      const deductionPerUnit = Math.max(0, severity) * DEDUCTION_BASE

      let itemDeduction = 0
      if (result === "DOUBT") {
        doubtCount++
        itemDeduction = severity * DEDUCTION_BASE
      } else if (result === "REJECT") {
        rejectCount++
        itemDeduction = occurrences * deductionPerUnit
        if (severity >= SEVERE_SEVERITY_MIN) severeReject = true
      } else {
        passCount++
      }

      totalDeduction += itemDeduction
      computedResults.push({
        item: item.item,
        result: item.result,
        note: item.note,
        severity,
        occurrences: result === "REJECT" ? occurrences : (result === "DOUBT" ? 1 : 0),
        deduction: itemDeduction,
        citation: item.citation,
      })
    }

    const score = Math.max(0, 100 - totalDeduction)
    const rejectByThreshold = totalDeduction >= REJECT_THRESHOLD
    const verdict = (severeReject || rejectByThreshold) ? "REJECT" : "PASS"

    // --- build report ---
    const deductions: DeductionEntry[] = computedResults
      .filter(r => r.result !== "PASS")
      .map((r, i) => ({
        id: (r.item.split(" ")[0]) || "UNKNOWN",
        content: r.note || "",
        severity: mapSeverity(r.severity),
        citation: r.citation,
      }))

    const report: CriticReport = {
      report_type: args.report_type,
      article: args.article,
      verdict,
      score,
      deduction_detail: {
        total_deduction: totalDeduction,
        doubt_count: doubtCount,
        severe_reject: severeReject,
        threshold_reject: rejectByThreshold,
        threshold: REJECT_THRESHOLD,
        items: computedResults,
      },
      item_results: args.item_results,
      deductions,
    }

    if (args.common_errors && args.common_errors.length > 0) report.common_errors = args.common_errors
    if (args.danger_signals && args.danger_signals.length > 0) report.danger_signals = args.danger_signals
    if (args.overall_assessment) report.overall_assessment = args.overall_assessment
    if (args.overall_recommendation) report.overall_recommendation = args.overall_recommendation

    // --- write file ---
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const resolve = (p: string) => isAbsolute(p) ? p : path.join(base, p)

    const number = nextReviewNumber(base)
    const filename = `review-${number}.json`
    const filePath = resolve(path.join("tmp", filename))

    const tmpDir = path.dirname(filePath)
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8")

    // --- build summary line ---
    const issueBrief = computedResults
      .filter(r => r.occurrences > 0)
      .map(r => `${(r.item.split(" ")[0]) || "?"}${r.occurrences}`)
      .join(" ")

    const summaryLine = `tmp/${filename} | PASS: ${passCount} | DOUBT: ${doubtCount} | REJECT: ${rejectCount} | ${issueBrief || "无问题"}`

    return summaryLine
  },
})
