/**
 * 词库加载器
 * 集中管理所有词库文件的加载和访问
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

let lexiconCache: any = null
let cachePath: string = ''

// 词库类型
export interface Lexicon {
  stopWords: Set<string>
  topicLexicon: any
  techniqueLexicon: any
  conceptMapping: any
  issuePatterns: any
}

/**
 * 加载所有词库文件
 */
export function loadLexicon(basePath: string): Lexicon {
  const lexiconDir = join(basePath, '.opencode', 'lexicon')

  // 缓存命中检查
  if (lexiconCache && cachePath === lexiconDir) {
    return lexiconCache
  }

  try {
    // 停用词
    const stopWordsData = JSON.parse(
      readFileSync(join(lexiconDir, 'stop-words.json'), 'utf-8')
    )
    const stopWords = new Set(stopWordsData.all || [])

    // 主题词库
    const topicLexicon = JSON.parse(
      readFileSync(join(lexiconDir, 'topic-lexicon.json'), 'utf-8')
    )

    // 技法词库
    const techniqueLexicon = JSON.parse(
      readFileSync(join(lexiconDir, 'technique-lexicon.json'), 'utf-8')
    )

    // 概念映射
    const conceptMapping = JSON.parse(
      readFileSync(join(lexiconDir, 'concept-mapping.json'), 'utf-8')
    )

    // 问题模式
    const issuePatterns = JSON.parse(
      readFileSync(join(lexiconDir, 'issue-patterns.json'), 'utf-8')
    )

    lexiconCache = {
      stopWords,
      topicLexicon,
      techniqueLexicon,
      conceptMapping,
      issuePatterns
    }
    cachePath = lexiconDir

    return lexiconCache
  } catch (e) {
    console.error('词库加载失败:', e)
    // 返回空的默认词库
    return {
      stopWords: new Set(),
      topicLexicon: { categories: {} },
      techniqueLexicon: { techniques: {} },
      conceptMapping: { mappings: {} },
      issuePatterns: { issueCategories: {} }
    }
  }
}

/**
 * 主题匹配增强: 使用概念映射扩展关键词
 */
export function expandKeywordsWithConcepts(
  keywords: string[],
  lexicon: Lexicon
): string[] {
  const expanded = new Set(keywords)

  // 查找相关概念
  for (const conceptName of Object.keys(lexicon.conceptMapping.mappings)) {
    const concept = lexicon.conceptMapping.mappings[conceptName]
    const hasMatch = keywords.some(k =>
      concept. 同义词.includes(k) ||
      concept. 近义词.includes(k) ||
      concept. 相关词.includes(k) ||
      concept. 核心词 === k
    )

    if (hasMatch) {
      // 扩展整个概念的所有词
      concept. 同义词.forEach((w: string) => expanded.add(w))
      concept. 近义词.forEach((w: string) => expanded.add(w))
      concept. 相关词.forEach((w: string) => expanded.add(w))
    }
  }

  return Array.from(expanded)
}

/**
 * 计算主题匹配得分
 */
export function calculateTopicMatchScore(
  inputKeywords: string[],
  articleTopics: string[],
  articleKeywords: string[],
  lexicon: Lexicon
): { score: number; matchedCategories: string[]; matchReasons: string[] } {
  const matchedCategories: string[] = []
  const matchReasons: string[] = []

  // 扩展输入关键词
  const expandedInput = expandKeywordsWithConcepts(inputKeywords, lexicon)

  // 与所有主题分类进行匹配
  let totalScore = 0
  let matchedCount = 0

  for (const [catKey, category] of Object.entries(lexicon.topicLexicon.categories) as any) {
    const categoryKeywords = category.keywords
    const intersection = expandedInput.filter(k =>
      categoryKeywords.some((ck: string) => ck.includes(k) || k.includes(ck)) ||
      articleTopics.includes(k) ||
      articleKeywords.includes(k)
    )

    if (intersection.length > 0) {
      const weight = category.weight || 1.0
      const matchScore = Math.min(intersection.length * 0.1 * weight, weight)
      totalScore += matchScore
      matchedCount++
      matchedCategories.push(category.name)
      matchReasons.push(`${category.name}匹配: ${intersection.slice(0, 3).join('、')}`)
    }
  }

  // 基础 Jaccard 相似度
  const allArticleWords = [...articleTopics, ...articleKeywords]
  const jaccard = calculateJaccardSimilarity(expandedInput, allArticleWords)

  // 综合得分: 分类匹配 + Jaccard 相似度
  const finalScore = Math.min(totalScore * 0.7 + jaccard * 0.3, 1.0)

  return {
    score: finalScore,
    matchedCategories,
    matchReasons
  }
}

/**
 * 计算 Jaccard 相似度
 */
export function calculateJaccardSimilarity(setA: string[], setB: string[]): number {
  const a = new Set(setA)
  const b = new Set(setB)
  const intersection = new Set([...a].filter(x => b.has(x)))
  const union = new Set([...a, ...b])
  return union.size === 0 ? 0 : intersection.size / union.size
}

/**
 * 识别文章使用的技法
 */
export function detectTechniques(
  content: string,
  highlights: string[],
  lexicon: Lexicon
): Array<{ name: string; confidence: number; evidence: string[] }> {
  const results: Array<{ name: string; confidence: number; evidence: string[] }> = []
  const allText = content + ' ' + highlights.join(' ')

  for (const [techKey, technique] of Object.entries(lexicon.techniqueLexicon.techniques) as any) {
    const evidence: string[] = []
    let matchCount = 0

    // 关键词匹配
    for (const keyword of technique.keywords) {
      if (allText.includes(keyword)) {
        matchCount++
        evidence.push(keyword)
      }
    }

    // 句式匹配
    for (const indicator of technique.indicators || []) {
      if (allText.includes(indicator)) {
        matchCount += 2 // 句式权重更高
        evidence.push(indicator)
      }
    }

    // 高亮出有关键词加分
    for (const highlight of highlights) {
      for (const keyword of technique.keywords) {
        if (highlight.includes(keyword)) {
          matchCount += 1.5
        }
      }
    }

    const confidence = Math.min(matchCount / 5, 1.0)
    if (confidence >= 0.3) {
      results.push({
        name: technique.name,
        confidence,
        evidence: evidence.slice(0, 3)
      })
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}

/**
 * 检测文章中的问题模式
 */
export function detectIssues(
  content: string,
  deductions: string[],
  lexicon: Lexicon
): Array<{ category: string; issues: Array<{ name: string; severity: string; count: number }> }> {
  const results: Array<{ category: string; issues: Array<{ name: string; severity: string; count: number }> }> = []

  for (const [catKey, category] of Object.entries(lexicon.issuePatterns.issueCategories) as any) {
    const categoryIssues: Array<{ name: string; severity: string; count: number }> = []

    for (const pattern of category.patterns) {
      let count = 0
      for (const keyword of pattern.keywords) {
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        const matches = content.match(regex)
        count += matches ? matches.length : 0
      }

      // 扣分理由中提到的问题权重加倍
      for (const deduction of deductions) {
        if (pattern.keywords.some((k: string) => deduction.includes(k))) {
          count += 3
        }
      }

      if (count > 0) {
        categoryIssues.push({
          name: pattern.name,
          severity: pattern.severity,
          count
        })
      }
    }

    if (categoryIssues.length > 0) {
      results.push({
        category: category.name,
        issues: categoryIssues.sort((a, b) => b.count - a.count)
      })
    }
  }

  return results
}

/**
 * 简单中文分词
 */
export function simpleChineseSegment(text: string, stopWords: Set<string>): string[] {
  const cleaned = text.replace(/[^\w一-龥]/g, ' ')
  const words: string[] = []

  // 2-4 字词
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i + len <= cleaned.length; i++) {
      const word = cleaned.substring(i, i + len)
      if (/^[一-龥]{2, 4}$/.test(word) && !stopWords.has(word)) {
        words.push(word)
      }
    }
  }

  // 去重并返回高频词
  const freq: Record<string, number> = {}
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([k]) => k)
}
