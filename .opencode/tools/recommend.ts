import { tool } from "@opencode-ai/plugin"
import { readdirSync, readFileSync, existsSync, writeFileSync, statSync } from "fs"
import { join } from "path"
import {
  loadLexicon,
  calculateTopicMatchScore,
  detectTechniques,
  detectIssues,
  simpleChineseSegment,
  expandKeywordsWithConcepts
} from "./lexicon-loader"

// ============== 类型定义 ==============

interface ArticleIndex {
  version: "1.0"
  generatedAt: string
  articles: ArticleMeta[]
}

interface ArticleMeta {
  filename: string
  title: string
  score: number
  topics: string[]
  categories: string[]  // 主题分类标签
  techniques: Array<{ name: string; confidence: number; evidence: string[] }>
  metaphors: string[]
  strengths: string[]
  weaknesses: string[]
  detectedIssues: Array<{ category: string; issues: Array<{ name: string; severity: string; count: number }> }>
  keywords: string[]
  structure: string
  wordCount: number
  fileModified: number
}

interface MatchResult {
  article: ArticleMeta
  score: number
  matchReasons: string[]
  matchedCategories: string[]
}

// ============== 索引生成 ==============

function buildIndex(outputDir: string, basePath: string): ArticleIndex {
  const lexicon = loadLexicon(basePath)
  const articles: ArticleMeta[] = []

  const files = readdirSync(outputDir).sort()
  for (const fname of files) {
    if (fname.startsWith('_') || !fname.endsWith('.txt')) continue

    const fp = join(outputDir, fname)
    try {
      const stat = statSync(fp)
      const text = readFileSync(fp, 'utf-8')

      // 解析元数据
      const sm = text.match(/^Score:\s*(\d+)/m)
      if (!sm) continue
      const score = parseInt(sm[1], 10)
      if (isNaN(score)) continue

      const tm = text.match(/^Title:\s*"(.+?)"/m)
      const title = tm ? tm[1] : fname.replace('.txt', '')

      const sepIdx = text.indexOf('\n---\n')
      const body = sepIdx === -1 ? text : text.substring(0, sepIdx)
      const meta = sepIdx === -1 ? '' : text.substring(sepIdx + 5)

      // 提取 Highlight 和 Deduction
      const highlights: string[] = []
      const hlMatch = meta.match(/Highlight:\s*\[([\s\S]*?)\]/m)
      if (hlMatch) {
        const quotes = hlMatch[1].match(/"([^"]*)"/g)
        if (quotes) highlights.push(...quotes.map(q => q.slice(1, -1)))
      }

      const deductions: string[] = []
      const dedMatch = meta.match(/Reason for deduction:\s*\[([\s\S]*?)\]/m)
      if (dedMatch) {
        const quotes = dedMatch[1].match(/"([^"]*)"/g)
        if (quotes) deductions.push(...quotes.map(q => q.slice(1, -1)))
      }

      // 提取关键词
      const keywords = simpleChineseSegment(title + ' ' + body, lexicon.stopWords)

      // 提取主题
      const abstractMatch = meta.match(/Abstract:\s*\{([\s\S]*?)\}/m)
      const abstract = abstractMatch ? abstractMatch[1] : ''
      const topicMatch = meta.match(/Topic:\s*\{([\s\S]*?)\}/m)
      const topicField = topicMatch ? topicMatch[1] : ''
      const topics = simpleChineseSegment(title + ' ' + abstract + ' ' + topicField, lexicon.stopWords).slice(0, 8)

      // 使用技法词库识别使用的技法
      const detectedTechniques = detectTechniques(body, highlights, lexicon)

      // 识别问题模式
      const detectedIssues = detectIssues(body, deductions, lexicon)

      // 识别核心意象
      const metaphors = extractMetaphors(body)

      // 识别结构类型
      const structure = detectStructureType(body)

      // 提取优点摘要
      const strengths = extractStrengths(highlights, detectedTechniques)

      // 提取缺点摘要
      const weaknesses = extractWeaknesses(deductions, detectedIssues)

      // 计算主题分类匹配
      const topicMatchResult = calculateTopicMatchScore(topics, topics, keywords, lexicon)
      const categories = topicMatchResult.matchedCategories

      articles.push({
        filename: fname,
        title,
        score,
        topics,
        categories,
        techniques: detectedTechniques.slice(0, 4),
        metaphors,
        strengths,
        weaknesses,
        detectedIssues,
        keywords,
        structure,
        wordCount: body.length,
        fileModified: stat.mtime.getTime()
      })
    } catch (e) {
      console.error('处理文章失败:', fname, e)
      continue
    }
  }

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    articles
  }
}

// 加载或生成索引
function loadOrBuildIndex(outputDir: string, basePath: string): ArticleIndex {
  const indexPath = join(outputDir, '.article-index.json')

  // 检查缓存
  if (existsSync(indexPath)) {
    try {
      const cached = JSON.parse(readFileSync(indexPath, 'utf-8')) as ArticleIndex

      // 检查是否需要更新
      let needsUpdate = false
      const cachedFiles = new Set(cached.articles.map(a => a.filename))
      const cachedTimes = new Map(cached.articles.map(a => [a.filename, a.fileModified]))

      const files = readdirSync(outputDir).filter(f => f.endsWith('.txt') && !f.startsWith('_'))

      for (const f of files) {
        if (!cachedFiles.has(f)) {
          needsUpdate = true
          break
        }
        const stat = statSync(join(outputDir, f))
        if (stat.mtime.getTime() > (cachedTimes.get(f) || 0)) {
          needsUpdate = true
          break
        }
      }

      if (!needsUpdate) return cached
    } catch (e) {
      // 缓存损坏, 重新生成
    }
  }

  // 生成新索引
  const index = buildIndex(outputDir, basePath)
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
  return index
}

// ============== 辅助函数 ==============

function extractMetaphors(body: string): string[] {
  const metaphors: string[] = []
  // 简单的隐喻提取模式
  const patterns = [
    /像([^,.,.]{1, 6})/g,
    /如([^,.,.]{1, 6})/g,
    /似([^,.,.]{1, 6})/g,
    /是一把([^,.,.]{1, 8})/g,
    /是一座([^,.,.]{1, 8})/g
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(body)) !== null) {
      const word = match[1].trim()
      if (word.length >= 1 && word.length <= 6 && !metaphors.includes(word)) {
        metaphors.push(word)
      }
    }
  }

  return metaphors.slice(0, 4)
}

function detectStructureType(body: string): string {
  const paragraphs = body.split('\n\n').filter(p => p.trim().length > 10)
  if (paragraphs.length < 3) return "短篇"

  // 检查是否有大量转折
  const butCount = (body.match(/但|但是|然而|可是|不过/g) || []).length
  if (butCount >= paragraphs.length / 2) return "螺旋递进"

  // 检查是否有大量场景化描写
  const timeMarkers = body.match(/记得|那天|那年|小时候|那时候/g) || []
  if (timeMarkers.length >= 3) return "回忆式"

  // 检查是否有并列结构
  const parallelCount = (body.match(/没有|不必|不要/g) || []).length
  if (parallelCount >= 3) return "排比推进"

  return "线性展开"
}

function extractStrengths(
  highlights: string[],
  techniques: Array<{ name: string; confidence: number; evidence: string[] }>
): string[] {
  const strengths: string[] = []

  // 技法亮点
  for (const tech of techniques) {
    if (tech.confidence >= 0.5) {
      strengths.push(`运用"${tech.name}"技法: ${tech.evidence.join(', ')}`)
    }
  }

  // 金句亮点
  for (const hl of highlights) {
    if (hl.length > 10 && hl.length < 60) {
      strengths.push(`金句示例: "${hl.substring(0, 40)}${hl.length > 40 ? '...' : ''}"`)
    }
  }

  return strengths.slice(0, 3)
}

function extractWeaknesses(
  deductions: string[],
  issues: Array<{ category: string; issues: Array<{ name: string; severity: string; count: number }> }>
): string[] {
  const weaknesses: string[] = []

  // 从扣分理由提取
  for (const ded of deductions) {
    if (ded.length > 8 && ded.length < 80) {
      weaknesses.push(ded.substring(0, 60) + (ded.length > 60 ? '...' : ''))
    }
  }

  // 从检测到的问题提取
  for (const cat of issues) {
    for (const issue of cat.issues.slice(0, 2)) {
      if (issue.severity === 'high' || issue.count >= 3) {
        weaknesses.push(`${cat.category}: ${issue.name} (x${issue.count})`)
      }
    }
  }

  return weaknesses.slice(0, 3)
}

// ============== 匹配算法 ==============

function matchArticles(
  topicInput: string,
  index: ArticleIndex,
  minScore: number,
  limit: number,
  basePath: string
): MatchResult[] {
  const lexicon = loadLexicon(basePath)
  const inputKeywords = simpleChineseSegment(topicInput, lexicon.stopWords)

  // 扩展关键词
  const expandedInput = expandKeywordsWithConcepts(inputKeywords, lexicon)

  const results: MatchResult[] = []

  for (const article of index.articles) {
    if (article.score < minScore) continue

    // 1. 主题匹配得分 (50%)
    const topicMatch = calculateTopicMatchScore(
      expandedInput,
      article.topics,
      article.keywords,
      lexicon
    )

    // 2. 质量加分 (25%)
    const qualityBonus = Math.max(0, (article.score - 70) / 30) * 0.25

    // 3. 技法丰富度加分 (15%)
    const techniqueScore = Math.min(article.techniques.length * 0.05, 0.15)

    // 4. 分类匹配加成 (10%)
    const categoryBonus = topicMatch.matchedCategories.length > 0 ? 0.1 : 0

    // 综合得分
    const totalScore = topicMatch.score * 0.5 + qualityBonus + techniqueScore + categoryBonus

    // 构建匹配理由
    const matchReasons = [...topicMatch.matchReasons]

    if (article.techniques.length > 0) {
      matchReasons.push(`使用技法: ${article.techniques.slice(0, 2).map(t => t.name).join(', ')}`)
    }

    if (totalScore > 0.1 || topicInput.length === 0) {
      results.push({
        article,
        score: totalScore,
        matchReasons,
        matchedCategories: topicMatch.matchedCategories
      })
    }
  }

  // 按得分排序
  results.sort((a, b) => b.score - a.score)

  // 多样性优化: 避免同一分类的文章排在一起
  if (results.length > limit) {
    const finalResults: MatchResult[] = []
    const usedCategories = new Set<string>()

    for (const result of results) {
      // 如果有新分类, 优先选择
      const hasNewCategory = result.matchedCategories.some(c => !usedCategories.has(c))
      if (hasNewCategory || finalResults.length < limit / 2) {
        finalResults.push(result)
        result.matchedCategories.forEach(c => usedCategories.add(c))
      } else if (finalResults.length < limit) {
        finalResults.push(result)
      }

      if (finalResults.length >= limit) break
    }

    return finalResults
  }

  return results.slice(0, limit)
}

// ============== 输出格式化 ==============

function formatOutput(matches: MatchResult[], mode: string, topic: string, totalArticles: number): string {
  const lines: string[] = []

  lines.push(`『 范文推荐 —— 主题:${topic || "全部分类"} 』`)
  lines.push(`[统计] 共检索 ${totalArticles} 篇文章, 匹配 ${matches.length} 篇`)
  lines.push('')

  if (matches.length === 0) {
    lines.push('未找到匹配的范文, 建议:')
    lines.push('  1. 降低最低分数要求（当前默认 70 分）')
    lines.push('  2. 扩大主题关键词范围')
    lines.push('  3. 调用 essence() 查看高分文章列表')
    return lines.join('\n')
  }

  for (let i = 0; i < matches.length; i++) {
    const { article, matchReasons, matchedCategories, score } = matches[i]

    lines.push(`=== 范文 ${i + 1}/${matches.length}:"${article.title}" (${article.score}分, 匹配度 ${Math.round(score * 100)}%) ===`)
    lines.push('')

    // 主题分类标签
    if (matchedCategories.length > 0) {
      lines.push(`[主题分类] ${matchedCategories.join(' · ')}`)
    }

    // 结构类型
    lines.push(`[结构类型] ${article.structure}`)

    // 核心意象
    if (article.metaphors.length > 0) {
      lines.push(`[核心意象] ${article.metaphors.join(', ')}`)
    }

    // 匹配理由
    if (matchReasons.length > 0) {
      lines.push(`[匹配理由] ${matchReasons.slice(0, 2).join(';')}`)
    }

    // 可学习技法
    if (article.strengths.length > 0 || article.techniques.length > 0) {
      lines.push('')
      lines.push('[可学习技法]')
      for (const tech of article.techniques.slice(0, 3)) {
        const confPercent = Math.round(tech.confidence * 100)
        lines.push(`  [技法] ${tech.name} (置信度 ${confPercent}%)`)
      }
      for (const strength of article.strengths.slice(0, 2)) {
        lines.push(`  [优势] ${strength}`)
      }
    }

    // 需规避问题
    if (article.weaknesses.length > 0) {
      lines.push('')
      lines.push('[需规避问题]')
      for (const weak of article.weaknesses) {
        lines.push(`  [劣势] ${weak}`)
      }
    }

    // 完整模式下添加文章节选
    if (mode === 'full') {
      lines.push('')
      lines.push(`[文件] ${article.filename} (${article.wordCount}字)`)
    }

    lines.push('')
  }

  lines.push('---')
  lines.push('[提示] 使用 essence(name="文件名") 查看指定文章完整原文')
  lines.push('[提示] 使用 essence(list=true) 查看所有文章清单')
  lines.push('[提示] 可指定 minScore=60 降低分数门槛, 获取更多匹配结果')

  return lines.join('\n')
}

// ============== 工具入口 ==============

export default tool({
  description: "根据写作主题智能推荐相关范文, 输出技法摘要. 使用内置词库进行语义匹配, 自动识别文章使用的写作技法和常见问题.",
  args: {
    topic: tool.schema.string().describe("写作命题/主题关键词, 用于语义匹配. 支持多关键词, 用空格分隔."),
    limit: tool.schema.number().default(3).describe("推荐篇数, 默认 3 篇, 最多 10 篇."),
    minScore: tool.schema.number().default(70).describe("最低入选分数, 默认 70 分."),
    mode: tool.schema.string().default("technique").describe("输出模式:technique(仅技法摘要) / full(含文件信息)"),
    techniques: tool.schema.array(tool.schema.string()).optional().describe("指定需要学习的技法, 如:['螺旋结构', '细节锚定']. 仅推荐使用了指定技法的文章."),
    categories: tool.schema.array(tool.schema.string()).optional().describe("指定主题分类, 如:['家庭与亲情', '互联网与文化']."),
    rebuildIndex: tool.schema.boolean().default(false).describe("强制重建文章索引, 默认 false."),
  },
  async execute(args, context) {
    const base = (context.worktree && context.worktree !== "/") ? context.worktree : process.cwd()
    const outputDir = join(base.replace(/[\\/]+$/, ""), "output")

    if (!existsSync(outputDir)) {
      return "output/ 目录不存在, 请先完成至少一篇文章的写作."
    }

    // 强制重建索引
    if (args.rebuildIndex) {
      const indexPath = join(outputDir, '.article-index.json')
      if (existsSync(indexPath)) {
        writeFileSync(indexPath, '', 'utf-8') // 清空缓存
      }
    }

    // 加载词库和索引
    const index = loadOrBuildIndex(outputDir, base)
    const totalArticles = index.articles.length

    if (totalArticles === 0) {
      return "output/ 目录下暂无有效文章, 请先完成至少一篇带完整元数据的文章."
    }

    const topic = args.topic || ""
    const limit = Math.max(1, Math.min(10, args.limit ?? 3))
    const minScore = args.minScore ?? 70
    const mode = args.mode || "technique"

    // 执行匹配
    let matches = matchArticles(topic, index, minScore, limit, base)

    // 如果指定了技法过滤
    if (args.techniques && args.techniques.length > 0) {
      matches = matches.filter(m =>
        m.article.techniques.some(t =>
          args.techniques!.some(req =>
            t.name.includes(req) || req.includes(t.name)
          )
        )
      )
    }

    // 如果指定了分类过滤
    if (args.categories && args.categories.length > 0) {
      matches = matches.filter(m =>
        m.matchedCategories.some(c =>
          args.categories!.some(req =>
            c.includes(req) || req.includes(c)
          )
        )
      )
    }

    return formatOutput(matches, mode, topic, totalArticles)
  }
})
