import { tool } from "@opencode-ai/plugin"
import { readdirSync, readFileSync, existsSync } from "fs"
import { join } from "path"

// 视觉宽度: CJK 字符计 2
function visWidth(s: string): number {
  let w = 0
  for (const c of s) {
    const code = c.codePointAt(0)!
    w += (code >= 0x1100 && code <= 0x115F) ||
      (code >= 0x2E80 && code <= 0xA4CF) ||
      (code >= 0xA960 && code <= 0xA97F) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFE10 && code <= 0xFE1F) ||
      (code >= 0xFF01 && code <= 0xFF60) ||
      (code >= 0xFFE0 && code <= 0xFFE6) ? 2 : 1
  }
  return w
}

function visPad(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - visWidth(s)))
}

interface ArticleMetadata {
  title: string
  score: number | null
  deductions?: Array<{
    id: string
    content: string
    severity: "low" | "medium" | "high"
    citation?: string
  }>
  highlights?: Array<{
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

interface ArticleEntry {
  score: number
  title: string
  fname: string
  body: string
  highlight: string
  deduction: string
}

export default tool({
  description: "高分优秀范文工具. 支持: 1) 按分数列出优秀文章列表; 2) 指定文章名获取完整原文; 3) 列出所有可用文章.",
  args: {
    name: tool.schema.string().optional().describe("文章文件名(不含路径), 如:'词的归处'. 指定后将返回该文章完整原文."),
    limit: tool.schema.number().default(3).describe("最多输出篇数, 默认 3 篇, 0 表示全部. 仅在不指定 name 时生效."),
    minScore: tool.schema.number().default(80).describe("最低入选分数, 默认 80 分."),
    list: tool.schema.boolean().default(false).describe("仅列出所有可用文章清单, 不显示内容."),
  },
  async execute(args, context) {
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const outputDir = join(base.replace(/[\\/]+$/, ""), "output")
    const limit = args.limit ?? 3
    const minScore = args.minScore ?? 80

    if (!existsSync(outputDir)) {
      return "output/ 目录不存在"
    }

    // 模式 1: 指定文章名, 返回完整原文
    if (args.name) {
      const fname = args.name.endsWith('.txt') ? args.name : args.name + '.txt'
      const fp = join(outputDir, fname)

      if (!existsSync(fp)) {
        // 尝试模糊匹配
        const files = readdirSync(outputDir).filter(f => f.endsWith('.txt') && !f.startsWith('_'))
        const matches = files.filter(f => f.toLowerCase().includes(fname.toLowerCase().replace('.txt', '')))

        if (matches.length === 1) {
          const exactFp = join(outputDir, matches[0])
          const text = readFileSync(exactFp, 'utf-8')
          return `==== ${matches[0]} ====\n\n${text}`
        } else if (matches.length > 1) {
          return `找到 ${matches.length} 篇匹配的文章:\n${matches.map(m => `  - ${m}`).join('\n')}\n\n请指定更精确的文件名.`
        }

        return `未找到文件: ${fname}\n\n可用文章:\n${files.map(f => `  - ${f}`).join('\n')}`
      }

      const text = readFileSync(fp, 'utf-8')
      return `==== ${fname} ====\n\n${text}`
    }

    // 读取所有文章
    const entries: ArticleEntry[] = []

    try {
      const files = readdirSync(outputDir).sort()
      for (const fname of files) {
        if (fname.startsWith('_')) continue
        if (!fname.endsWith('.txt')) continue
        const fp = join(outputDir, fname)
        const metaPath = join(outputDir, fname.replace('.txt', '.meta.json'))
        try {
          const text = readFileSync(fp, 'utf-8')

          // 必须从独立 JSON 文件读取元数据（不再向后兼容）
          if (!existsSync(metaPath)) {
            continue // 没有元数据，跳过
          }

          const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as ArticleMetadata
          const title = meta.title
          const score = meta.score ?? 0

          // 格式化高亮与扣分内容用于显示
          const highlightStr = (meta.highlights ?? []).length > 0
            ? JSON.stringify((meta.highlights ?? []).map(h => ({ id: h.id, content: h.content, citation: h.citation.substring(0, 50) })), null, 2)
            : ''

          const deductionStr = (meta.deductions ?? []).length > 0
            ? JSON.stringify((meta.deductions ?? []).map(d => ({ id: d.id, content: d.content, severity: d.severity })), null, 2)
            : ''

          // 文章正文（txt 文件已干净，无需去除元数据块）
          const body = text

          entries.push({ score, title, fname, body, highlight: highlightStr, deduction: deductionStr })
        } catch {
          continue
        }
      }
    } catch {
      return "无法读取 output/ 目录"
    }

    // 模式 2: 仅列出所有文章清单
    if (args.list) {
      if (entries.length === 0) return "output/ 目录下暂无文章"

      const lines: string[] = []
      lines.push(`==== 文章清单 (共 ${entries.length} 篇) ====`)
      lines.push('')
      lines.push(`${'分数'.padStart(4)}  ${visPad('标题', 20)}  ${'文件名'}`)
      lines.push('-'.repeat(60))
      entries.sort((a, b) => b.score - a.score).forEach(e => {
        lines.push(`${String(e.score).padStart(4)}  ${visPad(e.title, 20)}  ${e.fname}`)
      })
      lines.push('')
      lines.push('[提示] 使用 essence(name="文件名") 查看完整原文')
      return lines.join('\n')
    }

    // 模式 3: 按分数筛选列出范文（默认）
    const filtered = entries.filter(e => e.score >= minScore)
    filtered.sort((a, b) => b.score - a.score || a.fname.localeCompare(b.fname))

    const display = limit === 0 ? filtered : filtered.slice(0, Math.min(limit, filtered.length))
    if (display.length === 0) {
      return `output/ 目录下暂无评分 >= ${minScore} 分的文章\n当前有 ${entries.length} 篇文章, 分数范围: ${entries.length > 0 ? Math.min(...entries.map(e => e.score)) + '-' + Math.max(...entries.map(e => e.score)) : '无'}`
    }

    const lines: string[] = []
    lines.push(`==== 高分优秀范文 (≥${minScore}分, 共 ${display.length}/${filtered.length} 篇) ====`)
    lines.push('')
    lines.push(`${'排名'.padStart(4)}  ${'分数'.padStart(4)}  ${visPad('标题', 20)}  文件`)
    lines.push('-'.repeat(60))
    display.forEach((e, i) => {
      lines.push(`${String(i + 1).padStart(4)}  ${String(e.score).padStart(4)}  ${visPad(e.title, 20)}  ${e.fname}`)
    })
    lines.push('')
    lines.push('='.repeat(60))

    display.forEach((e, i) => {
      lines.push('')
      lines.push(`--- 第 ${i + 1} 篇:${e.title} (${e.fname}) ---`)
      lines.push('')
      lines.push(e.body)
      if (e.deduction) {
        lines.push('')
        lines.push(`[扣分理由] ${e.deduction}`)
      }
      if (e.highlight) {
        lines.push('')
        lines.push(`[亮点] ${e.highlight}`)
      }
      lines.push('')
    })

    lines.push('')
    lines.push('使用 essence(name="文件名") 查看指定文章完整原文')
    lines.push('使用 essence(list=true) 查看所有文章清单')

    return lines.join('\n')
  }
})
