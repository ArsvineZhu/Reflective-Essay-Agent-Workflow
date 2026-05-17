import { tool } from "@opencode-ai/plugin"
import * as path from "path"

function isAbsolute(p: string): boolean {
  return /^([A-Za-z]:[/\\]|\/|\\)/.test(p)
}

function countChinese(text: string): number {
  const body = text.split('\n---')[0]
  const withoutTitle = body.startsWith('# ') && body.includes('\n')
    ? body.substring(body.indexOf('\n') + 1)
    : body
  const m = withoutTitle.match(/[一-鿿]/g)
  return m ? m.length : 0
}

export default tool({
  description: "统计中文文章字数. 传入 output/ 目录下的 .txt 文件路径, 返回纯中文字符数(已排除元数据和标题行).",
  args: {
    filepath: tool.schema.string().describe("文章文件路径, 如 output/<filename>.txt"),
  },
  async execute(args, context) {
    const input = args.filepath
    if (!input) throw new Error("filepath 不能为空")

    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const fullPath = isAbsolute(input) ? input : path.join(base, input)

    let text: string
    try {
      text = await Bun.file(fullPath).text()
    } catch (e: any) {
      throw new Error(`无法读取文件: ${input} — ${e?.message || "未知错误"}`)
    }

    if (text.length === 0) {
      throw new Error(`文件为空: ${input}`)
    }

    return String(countChinese(text))
  },
})