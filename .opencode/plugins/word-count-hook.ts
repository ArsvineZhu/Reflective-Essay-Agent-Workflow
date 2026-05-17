import type { Plugin } from "@opencode-ai/plugin"
import * as path from "path"
import { existsSync } from "fs"

function isAbsolute(p: string): boolean {
  return /^([A-Za-z]:[/\\]|\/|\\)/.test(p)
}

function countChinese(text: string): number {
  const body = text.split('\n---')[0]
  const withoutTitle = body.startsWith('# ') && body.includes('\n')
    ? body.substring(body.indexOf('\n') + 1)
    : body
  const m = withoutTitle.match(/[\u4e00-\u9fff]/g)
  return m ? m.length : 0
}

const WordCountHook: Plugin = async ({ worktree }) => {
  async function countFile(filePath: string): Promise<string | null> {
    const normalized = filePath.replace(/\\/g, "/")
    if (!normalized.includes("output/") || !normalized.endsWith(".txt")) return null
    try {
      const fullPath = isAbsolute(normalized) ? normalized : path.join(worktree, normalized)
      if (!existsSync(fullPath)) return null
      const text = await Bun.file(fullPath).text()
      return String(countChinese(text))
    } catch {
      return null
    }
  }

  return {
    "tool.execute.after": async (input, output) => {
      const isWrite = input.tool === "write" || input.tool === "edit"
      if (!isWrite) return

      const filePath = input.args?.filePath || input.args?.path || ""
      const count = await countFile(filePath)
      if (!count) return

      const append = `\n[字数统计] ${count}`
      if (typeof output.output === "string") {
        output.output = output.output + append
      }
    },
  }
}

// OpenCode 插件模块要求导出名为 "server"
export const server = WordCountHook
