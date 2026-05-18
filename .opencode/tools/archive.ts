import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

function isAbsolute(p: string): boolean {
  return /^([A-Za-z]:[/\\]|\/|\\)/.test(p)
}

function timestampDir(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const h = String(now.getHours()).padStart(2, "0")
  const min = String(now.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${d}-${h}${min}`
}

function resolve(p: string, base: string): string {
  return isAbsolute(p) ? p : path.join(base, p)
}

function tryCopy(src: string, dest: string): boolean {
  if (!fs.existsSync(src)) return false
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    return true
  } catch {
    return false
  }
}

export default tool({
  description: "归档完成文章. 创建 archive/YYYY-MM-DD-HHMM/ 目录, 将 output/ 终稿和 tmp/ 所有审校/简报/读者文件一并复制过去, 然后清理 tmp/.",
  args: {
    article: tool.schema.string().describe("文章终稿路径, 如 output/xxx.txt"),
  },
  async execute(args, context) {
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const articlePath = resolve(args.article, base)
    const archiveName = timestampDir()
    const archiveDir = path.join(base, "archive", archiveName)

    if (!fs.existsSync(articlePath)) {
      throw new Error(`文章文件不存在: ${articlePath}`)
    }

    // Ensure archive directory exists
    fs.mkdirSync(archiveDir, { recursive: true })

    const copied: string[] = []
    const skipped: string[] = []

    // 1. Copy article
    const articleName = path.basename(articlePath)
    const articleDest = path.join(archiveDir, articleName)
    if (tryCopy(articlePath, articleDest)) {
      copied.push(articleName)
    }

    // 1.5 Copy metadata JSON (if exists)
    const metaPath = articlePath.endsWith('.txt') ? articlePath.replace(/\.txt$/, ".meta.json") : articlePath + ".meta.json"
    const metaName = articleName.endsWith('.txt') ? articleName.replace(/\.txt$/, ".meta.json") : articleName + ".meta.json"
    if (tryCopy(metaPath, path.join(archiveDir, metaName))) {
      copied.push(metaName)
    }

    // 2. Copy tmp/research-brief.md
    const briefSrc = path.join(base, "tmp", "research-brief.md")
    if (tryCopy(briefSrc, path.join(archiveDir, "research-brief.md"))) {
      copied.push("research-brief.md")
    } else {
      skipped.push("research-brief.md")
    }

    // 3. Copy tmp/review-report.md
    const reportSrc = path.join(base, "tmp", "review-report.md")
    if (tryCopy(reportSrc, path.join(archiveDir, "review-report.md"))) {
      copied.push("review-report.md")
    } else {
      skipped.push("review-report.md")
    }

    // 4. Copy tmp/_all-analysis.md
    const analysisSrc = path.join(base, "tmp", "_all-analysis.md")
    if (tryCopy(analysisSrc, path.join(archiveDir, "_all-analysis.md"))) {
      copied.push("_all-analysis.md")
    } else {
      skipped.push("_all-analysis.md")
    }

    // 5. Copy tmp/review-*.json (critic reports)
    const tmpDir = path.join(base, "tmp")
    if (fs.existsSync(tmpDir)) {
      const entries = fs.readdirSync(tmpDir)
      // Copy review-*.json
      for (const entry of entries) {
        if (/^review-\d+\.json$/.test(entry)) {
          if (tryCopy(path.join(tmpDir, entry), path.join(archiveDir, entry))) {
            copied.push(entry)
          }
        }
      }
      // Copy reader-*.json
      for (const entry of entries) {
        if (/^reader-\d+\.json$/.test(entry)) {
          if (tryCopy(path.join(tmpDir, entry), path.join(archiveDir, entry))) {
            copied.push(entry)
          }
        }
      }
      // Copy revision-notes.md
      const revSrc = path.join(base, "tmp", "revision-notes.md")
      if (tryCopy(revSrc, path.join(archiveDir, "revision-notes.md"))) {
        copied.push("revision-notes.md")
      }
    }

    // 6. Clean up tmp/ (delete all files, keep directory)
    if (fs.existsSync(tmpDir)) {
      const entries = fs.readdirSync(tmpDir)
      for (const entry of entries) {
        const full = path.join(tmpDir, entry)
        try {
          fs.rmSync(full, { recursive: true })
        } catch {
          // skip files that can't be removed
        }
      }
    }

    return [
      `归档完成: archive/${archiveName}/`,
      "",
      `已复制 ${copied.length} 个文件:`,
      ...copied.map(f => `  - ${f}`),
      ...(skipped.length > 0 ? ["", `以下文件不存在 (已跳过):`, ...skipped.map(f => `  - ${f}`)] : []),
    ].join("\n")
  },
})
