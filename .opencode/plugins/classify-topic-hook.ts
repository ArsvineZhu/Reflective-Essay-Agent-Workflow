import type { Plugin } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"
import { loadLexicon } from "../tools/lexicon-loader"

/**
 * Classify a single output file: read, detect metadata, compute topic, append if missing.
 * Returns the topic string if appended, null if skipped.
 */
function classifyArticle(filePath: string, basePath: string): string | null {
  const text = fs.readFileSync(filePath, "utf-8")

  // Find metadata block — handle both \n and \r\n line endings
  const sepMatch = text.match(/\r?\n---\r?\n([\s\S]*)$/)
  if (!sepMatch) return null // no metadata yet

  const metaBlock = sepMatch[1]
  if (metaBlock.includes("Topic:")) return null // already has topic

  // Load lexicon
  const lexicon = loadLexicon(basePath)

  // Extract article body
  const body = text.substring(0, sepMatch.index)
  const firstLine = body.split("\n")[0].trim()
  const title = firstLine.startsWith("# ") ? firstLine.slice(2).trim() : ""

  // Skip very short bodies
  if (body.length < 200) return null

  // For each category, count how many keywords appear as substrings in the body
  const bodyText = title + " " + body
  const categoryScores: Array<{ name: string; score: number; matched: string[] }> = []

  for (const [, category] of Object.entries(lexicon.topicLexicon.categories) as any) {
    const matchedWords = category.keywords.filter((ck: string) =>
      ck.length >= 2 && bodyText.includes(ck)
    )
    // Require at least 2 matching keywords per category
    if (matchedWords.length >= 2) {
      categoryScores.push({
        name: category.name,
        score: matchedWords.length * (category.weight || 1.0),
        matched: matchedWords,
      })
    }
  }

  // Sort by score descending
  categoryScores.sort((a, b) => b.score - a.score)

  if (categoryScores.length === 0) return null

  // Build Topic field with top categories (max 3)
  const topCategories = categoryScores.slice(0, 3).map(c => c.name)
  const topicLine = `Topic: { ${topCategories.join(", ")} }\n`
  const newText = text.trimEnd() + "\n" + topicLine
  fs.writeFileSync(filePath, newText, "utf-8")

  return topCategories.join(", ")
}

/**
 * Scan all output files for missing Topic metadata and backfill them.
 */
function scanOutputFiles(base: string): number {
  const outputDir = path.join(base, "output")
  if (!fs.existsSync(outputDir)) return 0

  const files = fs.readdirSync(outputDir).filter(f => f.endsWith(".txt") && !f.startsWith("_"))
  let classifiedCount = 0

  for (const fname of files) {
    const fp = path.join(outputDir, fname)
    try {
      const topic = classifyArticle(fp, base)
      if (topic) {
        classifiedCount++
      }
    } catch {
      // skip unclassifiable files
    }
  }

  return classifiedCount
}

const ClassifyTopicHook: Plugin = async ({ worktree }) => {
  let lastScan = 0

  return {
    "tool.execute.after": async (_input, _output) => {
      const now = Date.now()
      if (now - lastScan < 1000) return // debounce 1s to avoid excessive scanning
      lastScan = now

      const count = scanOutputFiles(worktree)
      if (count > 0) {
        console.log(`[classify-topic-hook] 已为 ${count} 篇文章追加 Topic 元数据`)
      }
    },
  }
}

// OpenCode 插件模块要求导出名为 "server"
export const server = ClassifyTopicHook
