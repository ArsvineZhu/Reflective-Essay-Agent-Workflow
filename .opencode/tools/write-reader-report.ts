import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

function isAbsolute(p: string): boolean {
  return /^([A-Za-z]:[/\\]|\/|\\)/.test(p)
}

function nextReaderNumber(base: string): string {
  const tmpDir = path.join(base, "tmp")
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true })
    return "001"
  }

  const files = fs.readdirSync(tmpDir)
  const readerFiles = files.filter(f => /^reader-(\d+)\.json$/.test(f))
  if (readerFiles.length === 0) return "001"

  const maxNum = Math.max(
    ...readerFiles.map(f => {
      const m = f.match(/^reader-(\d+)\.json$/)
      return m ? parseInt(m[1], 10) : 0
    })
  )

  return String(maxNum + 1).padStart(3, "0")
}

const VALID_LEVELS = ["高", "中", "低"]

const highlightSchema = tool.schema.object({
  content: tool.schema.string().describe("文章亮点描述, 如 '编辑低头看下一篇稿子的细节 -- 用动作留白代替情绪描写'"),
  citation: tool.schema.string().describe("原文引用, 必须是文中出现的精确文字"),
  technique: tool.schema.string().optional().describe("写作技法名称, 如 '动作锚定', '细节锚定'"),
})

const weaknessSchema = tool.schema.object({
  content: tool.schema.string().describe("文章缺点或可改进点描述"),
  citation: tool.schema.string().describe("原文引用, 必须是文中出现的精确文字"),
})

export default tool({
  description: "写入读者读后感, 返回文件路径和摘要行. 读者必须使用此工具, 禁止手动写文件. highlights 和 weaknesses 必须传入结构化对象(含 content/citation/technique).",
  args: {
    article: tool.schema.string().describe(
      "文章路径, 如 `./output/xxx.txt`. 读者已读取该文件, 此参数用于记录来源."
    ),
    style: tool.schema.string().describe(
      "读者风格名称, 如 `感性读者`, `怀疑论者`, `审美型读者`, `普通路人`, `AI 审查者` 等. 必须与分配的风格一致."
    ),
    highlights: tool.schema.array(highlightSchema).describe(
      "文章亮点列表. 每条必须包含 content(亮点描述) 和 citation(原文引用), 可选 technique(写作技法). 至少 2 条."
    ),
    weaknesses: tool.schema.array(weaknessSchema).describe(
      "文章缺点列表. 每条必须包含 content(问题描述) 和 citation(原文引用). 至少 2 条, 没有明显缺点也要写可改进之处."
    ),
    free_response: tool.schema.string().optional().describe(
      "自由感受补充. 简短写下读完的直觉感受或联想到的个人经历. 不要长篇大论, 3 句话以内."
    ),
    ai_suspicion: tool.schema.array(tool.schema.string()).optional().describe(
      "觉得文章像是 AI 写的吗? 哪里像? 为什么? 关注: 结构是否太工整, 举例是否太通用, 语言是否有个人质感. 没有怀疑可传空数组 []."
    ),
    overall_evaluation: tool.schema.string().describe(
      "整体感受总结. 一句话概括读完后的核心感受, 10-20 字. 例如: '被击中了, 像是看了一把自己的日记', '有观察的起点但停在表面'."
    ),
    evaluation: tool.schema.string().describe(
      "评价维度: 程度. 根据风格对应的维度填写, 如 `共情程度：高`, `逻辑漏洞：低`, `语言质感：中`. 程度分三档: 高/中/低. 参考评价维度对照表."
    ),
    score: tool.schema.number().describe(
      "评分, 满分 100. 根据你的真实感受打分: 80+ 优秀, 60-79 合格, <60 有问题. 不必精确, 诚实即可."
    ),
  },
  async execute(args, context) {
    // --- validation ---
    if (!args.style) throw new Error("style 不能为空")
    if (args.highlights && !Array.isArray(args.highlights)) {
      throw new Error("highlights 必须是数组")
    }
    if (args.weaknesses && !Array.isArray(args.weaknesses)) {
      throw new Error("weaknesses 必须是数组")
    }
    if (!args.overall_evaluation) throw new Error("overall_evaluation 不能为空")
    if (!args.evaluation) throw new Error("evaluation 不能为空")

    if (typeof args.score !== "number" || isNaN(args.score)) {
      throw new Error("score 必须是有效数字")
    }
    if (args.score < 0 || args.score > 100) {
      throw new Error(`score 超出范围: ${args.score}, 允许 0-100`)
    }

    const evalParts = args.evaluation.split("：")
    if (evalParts.length !== 2) {
      throw new Error(`evaluation 格式错误: "${args.evaluation}", 应为 "维度：程度" (如 "共情程度：高")`)
    }
    const level = evalParts[1].trim()
    if (!VALID_LEVELS.includes(level)) {
      throw new Error(`evaluation 程度错误: "${level}", 允许值: 高/中/低`)
    }

    // Validate highlights structure
    for (const h of args.highlights ?? []) {
      if (!h.content) throw new Error("highlights 每条必须包含 content 字段")
      if (!h.citation) throw new Error("highlights 每条必须包含 citation 字段")
    }

    // Validate weaknesses structure
    for (const w of args.weaknesses ?? []) {
      if (!w.content) throw new Error("weaknesses 每条必须包含 content 字段")
      if (!w.citation) throw new Error("weaknesses 每条必须包含 citation 字段")
    }

    // --- write ---
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const resolve = (p: string) => isAbsolute(p) ? p : path.join(base, p)

    const number = nextReaderNumber(base)
    const filename = `reader-${number}.json`
    const filePath = resolve(path.join("tmp", filename))

    const report = {
      article: args.article,
      style: args.style,
      free_response: args.free_response || "",
      ai_suspicion: args.ai_suspicion || [],
      overall_evaluation: args.overall_evaluation,
      evaluation: args.evaluation,
      score: args.score,
      metadata_highlights: args.highlights.map((h, i) => ({
        id: `RH${String(i + 1).padStart(2, "0")}`,
        content: h.content,
        citation: h.citation,
        technique: h.technique || undefined,
      })),
      metadata_weaknesses: args.weaknesses.map((w, i) => ({
        id: `RW${String(i + 1).padStart(2, "0")}`,
        content: w.content,
        citation: w.citation,
      })),
    }

    const tmpDir = path.dirname(filePath)
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8")

    const summaryLine = `tmp/${filename} | ${number} - ${args.style} | ${args.overall_evaluation} | ${args.evaluation}`

    return summaryLine
  },
})
