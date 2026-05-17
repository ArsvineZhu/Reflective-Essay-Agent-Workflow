import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

const ANALYSIS_FILES = [
  "ref/southern-weekly/analysis.md",
  "ref/arknights/analysis.md",
  "ref/ideals-future/analysis.md",
  "ref/game-narratives/analysis.md",
  "ref/chinese-elegies/analysis.md",
  "ref/chinese-nonfiction/analysis.md",
]

function isAbsolute(p: string): boolean {
  return /^([A-Za-z]:[/\\]|\/|\\)/.test(p)
}

export default tool({
  description: "加载参考源技法分析并写入 `tmp/_all-analysis.md`, 调用后读取文件; Esperanta 写作前必须先调用此工具, 不可跳过.",
  args: {},
  async execute(_args, context) {
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const resolve = (p: string) => isAbsolute(p) ? p : path.join(base, p)

    const parts: string[] = []
    for (const fp of ANALYSIS_FILES) {
      const fullPath = resolve(fp)
      if (!fs.existsSync(fullPath)) {
        parts.push(`# 参考源: ${path.basename(path.dirname(fp))}\n\n(文件不存在)\n\n---\n`)
        continue
      }
      const dirName = path.basename(path.dirname(fp))
      const content = fs.readFileSync(fullPath, "utf-8")
      parts.push(`# 参考源: ${dirName}\n\n${content.trim()}\n\n---\n`)
    }

    const body = parts.join("\n")
    const outputPath = resolve("tmp/_all-analysis.md")
    fs.writeFileSync(outputPath, body, "utf-8")

    return `已加载 ${ANALYSIS_FILES.length} 份参考源技法分析至: \`${outputPath}\` (内容较长, 可分段查看)`
  },
})
