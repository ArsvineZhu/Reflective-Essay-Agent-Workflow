import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

function isAbsolute(p: string): boolean {
  return /^([A-Za-z]:[/\\]|\/|\\)/.test(p)
}

function resolve(p: string, base: string): string {
  return isAbsolute(p) ? p : path.join(base, p)
}

function countChinese(text: string): number {
  const body = text.split("\n---")[0]
  const withoutTitle = body.startsWith("# ") && body.includes("\n")
    ? body.substring(body.indexOf("\n") + 1)
    : body
  const m = withoutTitle.match(/[一-鿿]/g)
  return m ? m.length : 0
}

/**
 * Extract the title from an article's first line (`# Title`).
 */
function extractTitle(text: string): string {
  const firstLine = text.split("\n")[0].trim()
  if (firstLine.startsWith("# ")) return firstLine.slice(2).trim()
  return ""
}

/**
 * Try to extract 综合评分 from review-report.md.
 */
function extractScore(reviewReportPath: string): number | null {
  if (!fs.existsSync(reviewReportPath)) return null
  const content = fs.readFileSync(reviewReportPath, "utf-8")
  const m = content.match(/\| (?: 综合评分|读者评分) \| (\d+)\/100 \|/)
  if (m) return parseInt(m[1], 10)
  // fallback: try any score pattern
  const m2 = content.match(/(\d+)\/100/)
  return m2 ? parseInt(m2[1], 10) : null
}

export default tool({
  description: "在文章末尾追加标准元数据区块. 自动提取标题与字数, 从审校报告读取综合评分, 其余字段由参数传入. 禁止手动估算字数.",
  args: {
    article: tool.schema.string().describe("文章路径, 如 output/xxx.txt"),
    score: tool.schema.number().optional().describe("综合评分 (0-100). 不传则从 tmp/review-report.md 自动读取"),
    requiredWords: tool.schema.string().optional().describe("要求字数, 如 '800', '700-900', 'Unspec'"),
    reasonForDeduction: tool.schema.array(tool.schema.string()).optional().describe("扣分理由列表"),
    abstract: tool.schema.string().optional().describe("文章摘要"),
    highlights: tool.schema.array(tool.schema.string()).optional().describe("精彩句子/金句点评列表"),
    approach: tool.schema.string().optional().describe("创作方法与过程"),
    topic: tool.schema.string().optional().describe("命题原文、分析理解与切入角度"),
  },
  async execute(args, context) {
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const articlePath = resolve(args.article, base)

    if (!fs.existsSync(articlePath)) {
      throw new Error(`文章文件不存在: ${articlePath}`)
    }

    const text = fs.readFileSync(articlePath, "utf-8")

    // Check if metadata already exists
    if (text.trimEnd().endsWith("---")) {
      // Check if there's already a metadata block
      const lastPart = text.trimEnd().split("\n").slice(-5).join("\n")
      if (lastPart.includes("Title:") || lastPart.includes("Score:")) {
        throw new Error(`文章已有元数据区块. 请确认后直接进入归档步骤.`)
      }
    }

    const title = extractTitle(text)
    const wordCount = countChinese(text)
    const titleStr = title

    // Score: parameter > review-report.md > null
    let score: number | null = args.score ?? null
    if (score === null) {
      score = extractScore(path.join(base, "tmp", "review-report.md"))
    }
    const scoreStr = score !== null ? String(score) : "N/A"

    // Word count
    const requiredStr = args.requiredWords ?? "Unspec"

    // Build metadata block
    const lines: string[] = []
    lines.push("")
    lines.push("---")
    lines.push(`Title: "${titleStr}"`)
    lines.push(`Score: ${scoreStr}`)

    // Reason for deduction
    if (args.reasonForDeduction && args.reasonForDeduction.length > 0) {
      lines.push("Reason for deduction: [")
      for (const r of args.reasonForDeduction) {
        lines.push(`    "${r}",`)
      }
      lines.push("]")
    } else {
      lines.push("Reason for deduction: []")
    }

    lines.push(`Word Count: ${wordCount} - Required: ${requiredStr}`)

    // Abstract
    if (args.abstract) {
      lines.push("Abstract: {")
      lines.push(`    ${args.abstract}`)
      lines.push("}")
    }

    // Highlights
    if (args.highlights && args.highlights.length > 0) {
      lines.push("Highlight: [")
      for (const h of args.highlights) {
        lines.push(`    "${h}",`)
      }
      lines.push("]")
    }

    // Approach
    if (args.approach) {
      lines.push("Approach: {")
      lines.push(`    ${args.approach}`)
      lines.push("}")
    }

    // Topic
    if (args.topic) {
      lines.push("Topic: {")
      lines.push(`    ${args.topic}`)
      lines.push("}")
    }

    const metadata = lines.join("\n") + "\n"

    // Append to file
    // Remove trailing whitespace, then append metadata
    const cleanText = text.trimEnd() + "\n"
    fs.writeFileSync(articlePath, cleanText + metadata, "utf-8")

    const summary = [
      `元数据已追加: ${args.article}`,
      `  Title: ${titleStr}`,
      `  Score: ${scoreStr}`,
      `  Word Count: ${wordCount} - Required: ${requiredStr}`,
    ]
    if (args.reasonForDeduction && args.reasonForDeduction.length > 0) {
      summary.push(`  Deductions: ${args.reasonForDeduction.length} 项`)
    }

    return summary.join("\n")
  },
})
