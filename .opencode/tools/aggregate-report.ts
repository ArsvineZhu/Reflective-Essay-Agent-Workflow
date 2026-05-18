import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

const SECTION_NAMES: Record<string, string> = {
  "review-001": "critic-originality",
  "review-002": "critic-structure",
  "review-003": "critic-voice",
  "review-004": "critic-ai",
}

function isAbsolute(p: string): boolean {
  return /^([A-Za-z]:[/\\]|\/|\\)/.test(p)
}

function parseCriticSummary(line: string): { id: string; verdict: string; doubts: string; note: string } | null {
  const parts = line.split("|").map(s => s.trim())
  if (parts.length < 4) return null
  const filename = path.basename(parts[0] || "", path.extname(parts[0] || "")).replace(/\..*$/, "")
  // parts[1] = "PASS: N", parts[2] = "DOUBT: N", parts[3] = "REJECT: N"
  const rejectCount = parseInt(parts[3]?.replace("REJECT:", "").trim() || "0", 10)
  const verdict = rejectCount > 0 ? "REJECT" : "PASS"
  const doubts = parts[2] || ""
  const note = parts.slice(4).join("|").trim()
  return { id: SECTION_NAMES[filename] || filename, verdict, doubts, note }
}

function parseReaderSummary(line: string): { id: string; style: string; note: string; evaluation: string } | null {
  const parts = line.split("|").map(s => s.trim())
  if (parts.length < 4) return null
  const stylePart = parts[1] || ""
  const style = stylePart.includes("—") ? stylePart.split("—")[1]?.trim() || stylePart : stylePart
  return { id: parts[1] || "", style, note: parts[2] || "", evaluation: parts[3] || "" }
}

function evaluationLevel(evaluation: string): string {
  const last = evaluation.slice(-1)
  if (last === "高") return "高"
  if (last === "中") return "中"
  if (last === "低") return "低"
  return "—"
}

function renderCriticJson(content: string): string {
  try {
    const data = JSON.parse(content)
    const result: string[] = []

    result.push(`### ${data.report_type || "批评报告"}`)
    result.push(`\n**${data.verdict || "PASS"}**`)
    result.push("\n---")

    if (data.item_results && data.item_results.length > 0) {
      result.push("\n### 逐项结果")
      result.push("\n| 项 | 结果 | 说明 | 引用 |")
      result.push("\n|----|------|------|------|")
      for (const item of data.item_results) {
        const cit = item.citation
          ? item.citation.length > 60
            ? item.citation.slice(0, 60) + "..."
            : item.citation
          : ""
        result.push(`\n| ${item.item} | ${item.result} | ${item.note} | ${cit} |`)
      }
    }

    if (data.common_errors && data.common_errors.length > 0) {
      result.push("\n### 常见错误")
      result.push("\n| 类型 | 位置 | 说明 |")
      result.push("\n|------|------|------|")
      for (const err of data.common_errors) {
        result.push(`\n| ${err.type} | ${err.location} | ${err.description} |`)
      }
    }

    if (data.danger_signals && data.danger_signals.length > 0) {
      result.push("\n### 危险信号")
      result.push("\n| 信号 | 说明 |")
      result.push("\n|------|------|")
      for (const sig of data.danger_signals) {
        result.push(`\n| ${sig.signal} | ${sig.description} |`)
      }
    }


    if (data.overall_assessment) {
      result.push(`\n### 总体评估\n\n${data.overall_assessment}`)
    }

    if (data.overall_recommendation) {
      result.push(`\n### 整体建议\n\n${data.overall_recommendation}`)
    }

    return result.join("")
  } catch (e: any) {
    const preview = content.length > 200 ? content.slice(0, 200) + "..." : content
    return `### 批评报告 (解析失败)\n\n**错误**: ${e?.message || "无效的 JSON"}\n\n**内容预览**:\n\`\`\`\n${preview}\n\`\`\``
  }
}

function renderReaderJson(content: string): string {
  try {
    const data = JSON.parse(content)
    const result: string[] = []

    result.push(`### ${data.style || "读者"}`)

    // Render highlights
    if (data.metadata_highlights && data.metadata_highlights.length > 0) {
      result.push("\n")
      for (const h of data.metadata_highlights) {
        if (h.citation) {
          result.push(`\n> "${h.citation}"`)
        }
      }
    }

    if (data.free_response) {
      result.push(`\n\n${data.free_response}`)
    }

    if (data.ai_suspicion && data.ai_suspicion.length > 0) {
      result.push(`\n\n**感觉像 AI**: ${data.ai_suspicion.join("; ")}`)
    }

    if (data.overall_evaluation) {
      result.push(`\n\n**整体评价**: ${data.overall_evaluation}`)
    }

    if (data.evaluation) {
      const level = evaluationLevel(data.evaluation)
      const tag = level === "高" ? "[高]" : level === "中" ? "[中]" : level === "低" ? "[低]" : "[?]"
      result.push(`\n\n**评价**: ${tag} ${data.evaluation}`)
    }

    return result.join("")
  } catch (e: any) {
    const preview = content.length > 200 ? content.slice(0, 200) + "..." : content
    return `### 读者感受 (解析失败)\n\n**错误**: ${e?.message || "无效的 JSON"}\n\n**内容预览**:\n\`\`\`\n${preview}\n\`\`\``
  }
}

export default tool({
  description: "将多份批评报告和读者感受合并为一份审校报告. 直接整合文件内容, 无需代理手动读取并重写.",
  args: {
    article: tool.schema.string().optional().describe("文章路径, 如 ./output/xxx.txt"),
    sources: tool.schema.array(tool.schema.string()).describe("批评报告路径列表"),
    readers: tool.schema.array(tool.schema.string()).optional().describe("读者感受报告路径列表"),
    critic_summaries: tool.schema.array(tool.schema.string()).optional().describe("'批评'子代理返回摘要行列表"),
    reader_summaries: tool.schema.array(tool.schema.string()).optional().describe("'读者'子代理返回摘要行列表"),
    output: tool.schema.string().describe("输出文件路径, 如 tmp/review-report.md"),
    verdict: tool.schema.string().optional().describe("最终判定文本"),
  },
  async execute(args, context) {
    const srcs = args.sources
    if (!srcs || srcs.length === 0) throw new Error("sources 不能为空")
    if (!args.output) throw new Error("output 不能为空")

    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const resolve = (p: string) => isAbsolute(p) ? p : path.join(base, p)

    const parts: string[] = ["# 审校报告"]
    parts.push("\n\n## 概览")

    let passCount = 0, rejectCount = 0
    const criticScores: number[] = []
    for (const sp of srcs.map(resolve)) {
      if (!fs.existsSync(sp)) {
        rejectCount++
        continue
      }
      try {
        const content = fs.readFileSync(sp, "utf-8")
        const data = JSON.parse(content)
        if (data.verdict === "PASS") passCount++
        else rejectCount++
        if (typeof data.score === "number" && !isNaN(data.score)) {
          criticScores.push(data.score)
        }
      } catch {
        rejectCount++
      }
    }

    const readerScores: number[] = []
    if (args.readers) {
      for (const rp of args.readers.map(resolve)) {
        if (!fs.existsSync(rp)) continue
        try {
          const content = fs.readFileSync(rp, "utf-8")
          const data = JSON.parse(content)
          if (typeof data.score === "number" && !isNaN(data.score)) {
            readerScores.push(data.score)
          }
        } catch {
          // skip unparseable reader files
        }
      }
    }

    const totalCritics = srcs.length
    const finalVerdict = args.verdict ?? (rejectCount === 0 ? "全部通过" : `${rejectCount} 项未通过 (${rejectCount}/${totalCritics})`)

    const avgScore = (() => {
      if (readerScores.length === 0) return null
      const avgReader = readerScores.reduce((a, b) => a + b, 0) / readerScores.length
      if (criticScores.length === 0) return Math.round(avgReader)
      // Non-linear penalty: use the lowest critic score with ^0.7 curve.
      // A perfect 100 → multiplier 1.0 (no penalty). The curve is gentle
      // (95→0.964, 90→0.928, 85→0.892, 80→0.855) — penalizing but not
      // overwhelming. No threshold — smooth continuous function.
      const minCritic = Math.min(...criticScores)
      const multiplier = Math.pow(minCritic / 100, 0.7)
      return Math.round(avgReader * multiplier)
    })()

    parts.push("\n\n| 项目 | 内容 |")
    parts.push("\n|------|------|")
    if (args.article) parts.push(`\n| 文章 | \`${args.article}\` |`)
    parts.push(`\n| 最终判定 | ${finalVerdict} |`)
    parts.push(`\n| 批评结果 | [PASS] ${passCount}/${totalCritics} | [FAIL] ${rejectCount}/${totalCritics} |`)
    if (avgScore !== null) {
      parts.push(`\n| 读者评分 | ${avgScore}/100 |`)
    }

    if (args.critic_summaries && args.critic_summaries.length > 0) {
      parts.push("\n\n### 批评摘要")
      parts.push("\n\n| 检察员 | 判定 | 存疑 | 简述 |")
      parts.push("\n|--------|------|------|------|")
      for (const line of args.critic_summaries) {
        const parsed = parseCriticSummary(line)
        if (parsed) {
          const tag = parsed.verdict === "PASS" ? "PASS" : "REJECT"
          parts.push(`\n| ${parsed.id} | ${tag} | ${parsed.doubts} | ${parsed.note} |`)
        }
      }
    }

    if (args.reader_summaries && args.reader_summaries.length > 0) {
      parts.push("\n\n### 读者摘要")
      parts.push("\n\n| 编号 | 风格 | 总评 | 评价 |")
      parts.push("\n|------|------|------|------|")
      for (const line of args.reader_summaries) {
        const parsed = parseReaderSummary(line)
        if (parsed) {
          const level = evaluationLevel(parsed.evaluation)
          const tag = level === "高" ? "[高]" : level === "中" ? "[中]" : level === "低" ? "[低]" : "[?]"
          parts.push(`\n| ${parsed.id} | ${parsed.style} | ${parsed.note} | ${tag} ${parsed.evaluation} |`)
        }
      }
    }

    parts.push("\n\n---\n\n## 批评报告详情")
    for (const sp of srcs.map(resolve)) {
      if (!fs.existsSync(sp)) {
        parts.push(`\n\n(文件不存在: ${sp})`)
        continue
      }
      const content = fs.readFileSync(sp, "utf-8")
      parts.push(`\n\n${renderCriticJson(content)}`)
    }

    if (args.readers && args.readers.length > 0) {
      parts.push("\n\n---\n\n## 读者感受")
      for (const rp of args.readers.map(resolve)) {
        if (!fs.existsSync(rp)) {
          parts.push(`\n\n(文件不存在: ${rp})`)
          continue
        }
        const content = fs.readFileSync(rp, "utf-8").trim()
        parts.push(`\n\n${renderReaderJson(content)}`)
      }
    }

    // --- metadata summary (structured data for append-metadata) ---
    {
      parts.push("\n\n---\n\n## 元数据摘要")
      parts.push("\n\n以下结构化数据可直接用于 `append-metadata` 工具参数.\n")

      // Extract deductions from critic reports
      const allDeductions: string[] = []
      for (const sp of srcs.map(resolve)) {
        if (!fs.existsSync(sp)) continue
        try {
          const content = fs.readFileSync(sp, "utf-8")
          const data = JSON.parse(content)
          if (data.deductions && data.deductions.length > 0) {
            for (const d of data.deductions) {
              allDeductions.push(JSON.stringify(d, null, 4))
            }
          }
        } catch { /* skip unparseable */ }
      }

      if (allDeductions.length > 0) {
        parts.push("\n### deductions")
        parts.push("\n```json\n[\n" + allDeductions.join(",\n") + "\n]\n```")
      }

      // Extract highlights from reader reports
      const allHighlights: string[] = []
      if (args.readers) {
        for (const rp of args.readers.map(resolve)) {
          if (!fs.existsSync(rp)) continue
          try {
            const content = fs.readFileSync(rp, "utf-8")
            const data = JSON.parse(content)
            if (data.metadata_highlights && data.metadata_highlights.length > 0) {
              for (const h of data.metadata_highlights) {
                allHighlights.push(JSON.stringify(h, null, 4))
              }
            }
          } catch { /* skip unparseable */ }
        }
      }

      if (allHighlights.length > 0) {
        parts.push("\n### highlights")
        parts.push("\n```json\n[\n" + allHighlights.join(",\n") + "\n]\n```")
      }
    }

    parts.push(`\n\n---\n\n## 最终判定\n\n${finalVerdict}`)

    const outputPath = resolve(args.output)
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    fs.writeFileSync(outputPath, parts.join(""), "utf-8")
    return args.output
  },
})