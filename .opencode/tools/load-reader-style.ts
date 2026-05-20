import { tool } from "@opencode-ai/plugin"
import * as path from "path"

interface ReaderStylesData {
  "reader-styles": {
    version: string
    description: string
  }
  styles: Record<string, {
    category: string
    name: string
    description: string
  }>
}

let stylesCache: ReaderStylesData | null = null

function getProjectRoot(context: any): string {
  return (context.worktree && context.worktree !== "/")
    ? context.worktree
    : process.cwd()
}

async function loadStyles(context: any): Promise<ReaderStylesData> {
  if (stylesCache) return stylesCache

  const root = getProjectRoot(context)
  const filePath = path.join(root, ".opencode", "lexicon", "reader-styles.json")

  try {
    const raw = Bun.file(filePath)
    if (!await raw.exists()) {
      throw new Error(`reader-styles.json 不存在: ${filePath}`)
    }
    const text = await raw.text()
    stylesCache = JSON.parse(text) as ReaderStylesData
    return stylesCache
  } catch (e: any) {
    throw new Error(`无法加载 reader-styles.json: ${e?.message || "未知错误"}`)
  }
}

export default tool({
  description: "按 ID 加载读者风格的完整描述文本.",
  args: {
    styleId: tool.schema.string().describe("读者风格 ID, 例如 sensible, skeptic, aesthetic 等."),
  },
  async execute(args, context) {
    const id = args.styleId?.trim()
    if (!id) throw new Error("styleId 不能为空")

    const data = await loadStyles(context)
    const style = data.styles[id]

    if (!style) {
      const available = Object.keys(data.styles).join(", ")
      throw new Error(`未找到 styleId "${id}". 可用 ID: ${available}`)
    }

    return `[${style.category} · ${style.name}]\n${style.description}`
  },
})
