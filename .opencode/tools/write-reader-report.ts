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

function toPosixPath(p: string): string {
  return p.split(path.sep).join("/")
}

function articleNameFromPath(value: string): string {
  const normalized = value.replace(/\\/g, "/")
  const base = path.posix.basename(normalized)
  return base.replace(/\.txt$/i, "")
}

function resolveArticle(base: string, input: string): { name: string, path: string } {
  const article = (input || "").trim()
  if (!article) throw new Error("article 不能为空")

  const outputDir = path.join(base, "output")
  if (!fs.existsSync(outputDir)) {
    throw new Error(`未找到 output 目录: ${outputDir}`)
  }

  const exactPath = isAbsolute(article) ? article : path.join(base, article)
  if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
    return {
      name: articleNameFromPath(exactPath),
      path: toPosixPath(path.relative(base, exactPath)),
    }
  }

  const wantedName = articleNameFromPath(article)
  const txtFiles = fs.readdirSync(outputDir).filter(f => f.toLowerCase().endsWith(".txt"))
  const matches = txtFiles.filter(f => path.basename(f, path.extname(f)) === wantedName)

  if (matches.length === 0) {
    const titleMatches = txtFiles.filter(f => {
      const fullPath = path.join(outputDir, f)
      const firstLine = fs.readFileSync(fullPath, "utf-8").split(/\r?\n/, 1)[0]?.trim() || ""
      return firstLine.replace(/^#\s*/, "") === wantedName
    })
    matches.push(...titleMatches)
  }

  const uniqueMatches = [...new Set(matches)]
  if (uniqueMatches.length === 0) {
    throw new Error(`未在 output/ 中找到文章: ${article}. 请传入文章标题, 如 "我是公派的嘛"`)
  }
  if (uniqueMatches.length > 1) {
    throw new Error(`文章名称不唯一: ${article}. 匹配到: ${uniqueMatches.join(", ")}`)
  }

  const filePath = path.join(outputDir, uniqueMatches[0])
  return {
    name: path.basename(uniqueMatches[0], path.extname(uniqueMatches[0])),
    path: toPosixPath(path.relative(base, filePath)),
  }
}

const VALID_LEVELS = ["高", "中", "低"]

const STYLE_DIMENSIONS = "感性读者=共情程度, 怀旧型读者=怀旧强度, 共情型读者=共情深度, 怀疑论者=逻辑漏洞, 哲学型读者=前提审视, 实用主义者=实用价值, 审美型读者=语言质感, 翻译耳读者=中文自然度, 节奏型读者=节奏感, 普通路人=留存度, 亲历者型=真实感, 文化比较者=文化自觉, 锐度审查者=内容锐度, 套路督察官=套路密度, 权力审视者=操控痕迹, 庸俗读者=注意力留存, 完整性审查者=论证完整度"

const highlightSchema = tool.schema.object({
  content: tool.schema.string().describe("文章亮点描述"),
  citation: tool.schema.string().optional().describe("原文引用, 必须是文中出现的精确文字"),
  technique: tool.schema.string().optional().describe("写作技法名称, 如 '动作锚定', '细节锚定'"),
})

const weaknessSchema = tool.schema.object({
  content: tool.schema.string().describe("文章缺点或可改进点描述"),
  citation: tool.schema.string().optional().describe("原文引用, 必须是文中出现的精确文字"),
})

export default tool({
  description: "写入读者读后感报告, 保存到 tmp/reader-NNN.json, 并返回可交给编排器的摘要行.",
  args: {
    article: tool.schema.string().describe(
      "文章名称. 不传路径, 不带 .txt 后缀. 例如收到 ./output/我是公派的嘛.txt 时传 `我是公派的嘛`. 工具会自动解析 output/ 下的同名 .txt 文件, 也兼容旧式路径输入."
    ),
    style: tool.schema.string().describe(
      `读者风格名称. 必须与分配的风格或风格描述匹配; 如上游只给风格描述, 自行归类为最贴近的风格名称. 风格与评价维度: ${STYLE_DIMENSIONS}.`
    ),
    highlights: tool.schema.array(highlightSchema).describe(
      "文章亮点列表. 必须是数组. 每条至少包含 content; 可选 citation/technique. citation 必须是文章中出现的精确短句."
    ),
    weaknesses: tool.schema.array(weaknessSchema).describe(
      "文章缺点列表. 必须是数组. 每条至少包含 content; 可选 citation. citation 必须是文章中出现的精确短句."
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
      `评价维度: 程度. 必须写成 "维度：程度", 如 "共情程度：高", "逻辑漏洞：低", "语言质感：中"; 程度只能是 高/中/低. 工具兼容全角和半角冒号. 风格对应维度: ${STYLE_DIMENSIONS}.`
    ),
    score: tool.schema.number().describe(
      "评分, 满分 100. 根据你的真实感受打分: 80+ 优秀, 60-79 合格, <60 有问题. 不必精确, 诚实即可."
    ),
  },
  async execute(args, context) {
    // --- validation ---
    if (!args.style) throw new Error("style 不能为空")
    if (!Array.isArray(args.highlights)) {
      throw new Error("highlights 必须是数组")
    }
    if (!Array.isArray(args.weaknesses)) {
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

    const evalParts = args.evaluation.split(/[:：]/)
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
    }

    // Validate weaknesses structure
    for (const w of args.weaknesses ?? []) {
      if (!w.content) throw new Error("weaknesses 每条必须包含 content 字段")
    }

    // --- write ---
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const resolve = (p: string) => isAbsolute(p) ? p : path.join(base, p)
    const articleRef = resolveArticle(base, args.article)

    const number = nextReaderNumber(base)
    const filename = `reader-${number}.json`
    const filePath = resolve(path.join("tmp", filename))

    const report = {
      article: articleRef.name,
      article_path: articleRef.path,
      style: args.style,
      free_response: args.free_response || "",
      ai_suspicion: args.ai_suspicion || [],
      overall_evaluation: args.overall_evaluation,
      evaluation: args.evaluation,
      score: args.score,
      metadata_highlights: args.highlights.map((h, i) => ({
        id: `RH${String(i + 1).padStart(2, "0")}`,
        content: h.content,
        ...(h.citation ? { citation: h.citation } : {}),
        ...(h.technique ? { technique: h.technique } : {}),
      })),
      metadata_weaknesses: args.weaknesses.map((w, i) => ({
        id: `RW${String(i + 1).padStart(2, "0")}`,
        content: w.content,
        ...(w.citation ? { citation: w.citation } : {}),
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
