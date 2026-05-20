import { tool } from "@opencode-ai/plugin"
import * as path from "path"

interface PersonasData {
  personas: Record<string, {
    name: string
    fullName: string
    text: string
  }>
}

let cache: PersonasData | null = null

function getProjectRoot(context: any): string {
  return (context.worktree && context.worktree !== "/")
    ? context.worktree
    : process.cwd()
}

async function loadPersonas(context: any): Promise<PersonasData> {
  if (cache) return cache

  const root = getProjectRoot(context)
  const filePath = path.join(root, ".opencode", "lexicon", "personas.json")

  try {
    const raw = Bun.file(filePath)
    if (!await raw.exists()) {
      throw new Error(`personas.json 不存在: ${filePath}`)
    }
    const text = await raw.text()
    cache = JSON.parse(text) as PersonasData
    return cache
  } catch (e: any) {
    throw new Error(`无法加载 personas.json: ${e?.message || "未知错误"}`)
  }
}

export default tool({
  description: "按代理 ID 加载人设风格完整描述, 仅在非工作交流时调用——工作模式（派遣, 聚合, 输出报告, 研究等）不需要人设.",
  args: {
    agentId: tool.schema.string().describe("代理 ID, 例如 kaltsit, priestess"),
  },
  async execute(args, context) {
    const id = args.agentId?.trim()
    if (!id) throw new Error("agentId 不能为空")

    const data = await loadPersonas(context)
    const persona = data.personas[id]

    if (!persona) {
      const available = Object.keys(data.personas).join(", ")
      throw new Error(`未找到代理 "${id}" 的人设. 可用 ID: ${available}`)
    }

    return persona.text
  },
})
