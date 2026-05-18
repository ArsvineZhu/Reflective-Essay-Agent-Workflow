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
  const withoutTitle = text.startsWith("# ") && text.includes("\n")
    ? text.substring(text.indexOf("\n") + 1)
    : text
  const m = withoutTitle.match(/[一-鿿]/g)
  return m ? m.length : 0
}

interface ArticleMetadata {
  title: string
  score: number | null
  deductions: Array<{
    id: string
    content: string
    severity: "low" | "medium" | "high"
    citation?: string
  }>
  highlights: Array<{
    id: string
    content: string
    citation: string
    technique?: string
  }>
  wordCount: number
  requiredWords: string
  abstract?: string
  approach?: string
  topic?: {
    original: string
    keywords: string[]
    analysis?: string
  }
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
  description: "为文章生成独立的元数据 JSON 文件. 自动提取标题与字数, 从审校报告读取综合评分, 其余字段由参数传入. 禁止手动估算字数.",
  args: {
    article: tool.schema.string().describe("文章路径, 如 output/xxx.txt"),
    score: tool.schema.number().optional().describe("综合评分 (0-100). 不建议自行传递，系统会自动从 tmp/review-report.md 读取"),
    requiredWords: tool.schema.string().optional().describe("要求字数, 如 '800', '700-900', 'Unspec'"),
    deductions: tool.schema.array(
      tool.schema.object({
        id: tool.schema.string().describe("唯一标识, 如 C1, D2"),
        content: tool.schema.string().describe("评价内容"),
        severity: tool.schema.enum(["low", "medium", "high"]).describe("严重程度"),
        citation: tool.schema.string().optional().describe("原文引用"),
      })
    ).optional().describe("扣分理由对象数组"),
    highlights: tool.schema.array(
      tool.schema.object({
        id: tool.schema.string().describe("唯一标识, 如 H1, H2"),
        content: tool.schema.string().describe("评价内容"),
        citation: tool.schema.string().describe("原文引用"),
        technique: tool.schema.string().optional().describe("写作技法"),
      })
    ).optional().describe("亮点点评对象数组"),
    abstract: tool.schema.string().optional().describe("文章摘要"),
    approach: tool.schema.string().optional().describe("创作方法与过程"),
    topic: tool.schema.object({
      original: tool.schema.string().describe("命题原文"),
      keywords: tool.schema.array(tool.schema.string()).describe("分类话题关键词"),
      analysis: tool.schema.string().optional().describe("分析解读"),
    }).optional().describe("主题相关信息"),
  },
  async execute(args, context) {
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const articlePath = resolve(args.article, base)

    if (!fs.existsSync(articlePath)) {
      throw new Error(`文章文件不存在: ${articlePath}`)
    }

    const articleDir = path.dirname(articlePath)
    const articleName = path.basename(articlePath, '.txt')
    const metaPath = path.join(articleDir, `${articleName}.meta.json`)

    // Check if metadata already exists
    if (fs.existsSync(metaPath)) {
      throw new Error(`元数据文件已存在: ${metaPath}. 请确认后直接进入归档步骤.`)
    }

    const text = fs.readFileSync(articlePath, "utf-8")

    const title = extractTitle(text)
    const wordCount = countChinese(text)

    // Score: parameter > review-report.md > null
    let score: number | null = args.score ?? null
    if (score === null) {
      score = extractScore(path.join(base, "tmp", "review-report.md"))
    }

    const requiredStr = args.requiredWords ?? "Unspec"

    // Build metadata JSON
    const metadata: ArticleMetadata = {
      title,
      score,
      deductions: args.deductions ?? [],
      highlights: args.highlights ?? [],
      wordCount,
      requiredWords: requiredStr,
      abstract: args.abstract,
      approach: args.approach,
      topic: args.topic,
    }

    // Write JSON file
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + "\n", "utf-8")

    const summary = [
      `元数据已生成: ${metaPath}`,
      `  Title: ${title}`,
      `  Score: ${score ?? "N/A"}`,
      `  Word Count: ${wordCount} - Required: ${requiredStr}`,
    ]
    if (args.deductions && args.deductions.length > 0) {
      summary.push(`  Deductions: ${args.deductions.length} 项`)
    }
    if (args.highlights && args.highlights.length > 0) {
      summary.push(`  Highlights: ${args.highlights.length} 项`)
    }

    return summary.join("\n")
  },
})
