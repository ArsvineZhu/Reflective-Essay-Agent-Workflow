# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **multi-agent writing workflow** built on OpenCode for crafting Chinese 思想随笔 (reflective essays). It runs as a series of coordinated agent sessions — each agent has a specific role and communicates exclusively through files in `tmp/`.

Core philosophy: essays should be spiral explorations (not linear arguments), use "we" voice (not "you" preaching), anchor abstractions in sensory details, and never borrow examples from reference sources.

## Commonly Used Commands

### Core Workflow
```bash
# 1. Start OpenCode (进入写作工作流)
opencode

# 2. List available agents (查看可用代理)
opencode agent list

# 3. Switch to specific agent (切换到指定代理，在 OpenCode TUI 中按 Tab)
#    Type: --agent priestess
#    Type: --agent esperanta
#    Type: --agent kaltsit

# 4. Show agent help (在 TUI 中输入命令)
#    Type: /help
```

### Tool Maintenance
```bash
# Install/update tool dependencies (安装/更新工具依赖)
cd .opencode && bun install

# Verify TypeScript compilation (验证 TypeScript 编译，需在 .opencode/ 目录下执行)
cd .opencode && bunx --bun tsc --noEmit

# List all custom tools (列出所有自定义工具)
ls -la .opencode/tools/
```

### Project Maintenance
```bash
# Clear temp files (清理临时文件)
rm -rf tmp/*

# List archives (查看历史归档)
ls -la archive/

# List output articles (查看已完成文章)
ls -la output/
```

### Troubleshooting
```bash
# Start with pure mode (无插件模式，排查问题)
opencode --pure

# Check OpenCode version
opencode --version

# Update OpenCode CLI
npm install -g opencode-ai@latest
```

## OpenCode 1.15.x Important Changes

**Critical: Configuration format changed in 1.15.x**
- ❌ Agents are NO LONGER declared in `opencode.json`
- ❌ Tools are NO LONGER declared in `opencode.json`
- ❌ Plugins are NO LONGER declared in `opencode.json`
- ✅ Agents are auto-discovered from `.opencode/agents/*.md`
- ✅ Tools are auto-discovered from `.opencode/tools/*.ts`
- ✅ Plugins are managed via `opencode plugin` command

The minimal `opencode.json` now only contains MCP configurations (like Exa search).

## Architecture

### Agent Roles (defined in `.opencode/agents/`) — 8 agents total

| Agent | Mode | Model | Color | Role |
|-------|------|-------|-------|------|
| **Priestess** | primary | ds-v4-flash | `#b5d2e9` 淡蓝灰白 | Research + delivery/archive. Talks to user, writes `tmp/research-brief.md`, generates metadata JSON for finished articles, archives to `archive/YYYY-MM-DD-HHMM/` |
| **Esperanta** | primary | ds-v4-pro (max) | `#7CFF5E` 浅荧光绿 | Writer. Reads `tmp/` + ref sources, writes to `output/`. Also handles revision. |
| **Kaltsit** | primary | ds-v4-flash | `#7CFF5E` 浅荧光绿 | Review orchestrator. Delegates to 4 critics + 5 readers in two waves, aggregates via `aggregate-report` tool → `tmp/review-report.md` |
| **critic-originality** | subagent | ds-v4-flash | — | Checks A1-A4: sentence reuse, material borrowing, metaphor overlap, ending similarity against `ref/` |
| **critic-structure** | subagent | ds-v4-flash | — | Checks B1-B12: spiral naturalness, golden sentences, metaphor consistency, parallelism, anchoring, open endings |
| **critic-voice** | subagent | ds-v4-flash | — | Checks C1-C8: "we" voice, exclamation marks, preaching, academic citations, scaffolding, language compliance |
| **critic-ai** | subagent | ds-v4-flash | — | Checks D1-D8: burstiness, syntactic repetition, transition scaffolding, token probability, emotional flatness, golden sentence patterns, example specificity, safety zone overuse |
| **Reader** | subagent | ds-v4-flash | — | 5 reader types across emotion/reason/language/experience/safety categories. Writes reader reports via `write-reader-report` tool |

### Context Passing (file-based, never via conversation history)

- `tmp/research-brief.md` — Priestess → Esperanta
- `tmp/_all-analysis.md` — `load-references` tool → Esperanta
- `tmp/review-report.md` — Kaltsit → Priestess / Esperanta
- `tmp/revision-notes.md` — Priestess → Esperanta
- `tmp/` is **cleared** each new session; `archive/` is permanent

### Critical Constraints

- Priestess writes only to `tmp/`, never to `output/`
- Kaltsit + subagents never write to `output/` (judge/writer separation)
- Esperanta reads `tmp/` for context (`task()` does NOT carry conversation history)
- `common.md` is auto-loaded via `prompt: "{file:./.opencode/prompts/common.md}"` frontmatter
- Plugins fire automatically: `word-count-hook` on `write`/`edit` to `output/*.txt`
- Subagent doubt count >= 2 → overall REJECT (review discipline)
- Finished articles get a separate metadata JSON file (`output/<name>.meta.json`) with Title/Score/Reason/WordCount/Abstract/Highlight/Approach/Topic

### Reference Sources (`ref/`)

6 categories of analysis + original texts:

| Source | Path | Technique Focus |
|--------|------|----------------|
| 南方周末新年献词 (1997-2026) | `ref/southern-weekly/` | Crowd structure, ritual tone, layered parallelism |
| 明日方舟/鹰角文案 | `ref/arknights/` | Paradox rhetoric, metaphor-as-reason, restrained lyricism |
| 理想、未来与存续 | `ref/ideals-future/` | Spiral structure, disenchantment, grounded anchoring |
| 游戏深度文案 | `ref/game-narratives/` | Grounded farewell, structural mirroring, Rashomon narrative |
| 中国悼文/纪念文 | `ref/chinese-elegies/` | Detail anchoring, ending tension, unsaid restraint |
| 中文非虚构写作 | `ref/chinese-nonfiction/` | Fragmented prose, ambiguity preservation |

Each has an `analysis.md` that Esperanta must read via `load-references` tool before writing.

### Thematic Lexicon (`.opencode/lexicon/`)

7 files powering the `recommend` tool:

| File | Type | Purpose |
|------|------|---------|
| `cilin.txt` | 17,817 synonym groups | 哈工大同义词词林扩展版, used by `recommend(updateLexicon=true)` to auto-expand concept/topic/structure lexicons |
| `concept-mapping.json` | 19 concept groups | 概念映射 (家庭/愧疚/成长/异化/孤独/焦虑/自由/意义...), each with 同义词/近义词/相关词 |
| `topic-lexicon.json` | 15 topic categories | 话题分类关键词 (家庭与亲情/互联网与文化/城市与生活/死亡与意义...), used for article indexing and auto-classification |
| `technique-lexicon.json` | 12+ technique patterns | 写作技法关键词 (螺旋结构/细节锚定/悖论修辞/排比分层...), used for technique detection |
| `issue-patterns.json` | Issue pattern library | 常见写作问题模式 (套话/空洞/跳跃/说教...), used for weakness detection |
| `structure-patterns.json` | 3 detection patterns | 结构检测种子词 + Cilin expanded words (转折词/时间标记/排比词), used by `detectStructureType()` |
| `stop-words.json` | 700+ stop words | 中文停用词, used by `simpleChineseSegment()` for keyword filtering |

### Custom Tools (`.opencode/tools/`)

Written in TypeScript, run via Bun. All tools are auto-discovered (no need to declare in `opencode.json`). `lexicon-loader.ts` is a library module (not a tool), imported by other tools.

| Tool | Caller | Purpose |
|------|--------|---------|
| `aggregate-report` | Kaltsit | Merge critic + reader reports into `tmp/review-report.md` |
| `append-metadata` | Priestess | Generate independent metadata JSON file `output/<name>.meta.json` (auto-extract title/word-count, auto-read score, optional word-count penalty) |
| `archive` | Priestess | Archive final article + all intermediate files + `.meta.json`, clear `tmp/` |
| `count` | Priestess / plugin | Count Chinese characters in `output/*.txt` (excludes title). Logic embedded in `word-count-hook` |
| `essence` | Esperanta | **High-score article browser**. `essence()` → score >80 listing; `essence(list=true)` → all articles; `essence(name="filename")` → full text |
| `load-references` | Esperanta | Load all 6 `analysis.md` → `tmp/_all-analysis.md` |
| `recommend` | Esperanta | **Recommendation engine**: semantic topic matching + technique analysis. Args: `topic`, `limit`, `minScore`, `techniques`, `categories`, `updateLexicon` (uses Cilin to auto-expand lexicons). |
| `write-critic-report` | critic-* | Write critic review JSON with auto-numbering, auto-scoring (100 - deductions), verdict (PASS/REJECT) |
| `write-reader-report` | Reader | Write reader response JSON with structured reader style, sentiments, strengths/weaknesses |

### Plugins (`.opencode/plugins/`)

| Plugin | Trigger | Purpose |
|--------|---------|---------|
| `word-count-hook` | After every `write`/`edit` to `output/*.txt` | Counts Chinese characters (excluding title) and appends `[字数统计] N` to tool output |

## Workflow Sequence

**Important: Each agent step requires a NEW OpenCode session. Do NOT switch agents within the same session.**

```
Session 1 (Priestess):
   User provides topic → research → confirm → write tmp/research-brief.md
   → User starts NEW session

Session 2 (Esperanta):
   Read tmp/ + load-references + essence() → write → self-check
   → output/{topic}.txt (word-count-hook fires automatically)
   → User starts NEW session

Session 3 (Kaltsit):
   Review orchestration:
   ├─ Wave 1 (parallel): 4 critics + 1 reader (emotional)
   ├─ Wave 2 (after wave 1): 4 more readers (reason/language/experience/safety)
   └─ aggregate-report tool → tmp/review-report.md

Decision point:
   ├─ IF PASS: return to Priestess session → append-metadata → archive
   └─ IF REJECT: Priestess writes tmp/revision-notes.md → Esperanta revises → Kaltsit re-reviews (unlimited iterations)
```

## Key Paths

- Agent definitions: `.opencode/agents/*.md` (8 agents)
- Style rules (auto-loaded): `.opencode/prompts/common.md`
- Custom tools: `.opencode/tools/*.ts` (9 tools + 1 library module `lexicon-loader.ts`)
- Lexicon databases: `.opencode/lexicon/` (7 files: cilin.txt + 6 JSON lexicons)
- Output directory: `output/` (all articles as `.txt` with separate `.meta.json` metadata)
- Temp context: `tmp/` (cleared between sessions)
- Archives: `archive/YYYY-MM-DD-HHMM/` (6 archives)
- Reference sources: `ref/*/`
- Plugins: `.opencode/plugins/word-count-hook.ts`
- Config: `opencode.json`

## Reader Categories

| Category | Available Styles | Evaluation Dimension |
|----------|-----------------|---------------------|
| Emotion | 感性读者, 怀旧型读者, 共情型读者 | 共情程度 / 怀旧强度 / 共情深度 |
| Reason | 怀疑论者, 哲学型读者, 实用主义者 | 逻辑漏洞 / 前提审视 / 实用价值 |
| Language | 审美型读者, 翻译耳读者, 节奏型读者 | 语言质感 / 中文自然度 / 节奏感 |
| Experience | 普通路人, 亲历者型, 文化比较者 | 留存度 / 真实感 / 文化自觉 |
| Safety | 锐度审查者, 套路督察官, 权力审视者, 庸俗读者, 完整性审查者 | 话题锐度 / 套路密度 / 操控痕迹 / 注意力留存 / 论证完整度 |

Kaltsit must select at least 1 per category; can select more based on article theme.

## Code & Configuration Guidelines

- **Punctuation in code/config files**: Minimize Chinese-specific quotation marks (「」『』) in all configuration files, markdown documentation, and code.
- **Quote style**: Use English double quotes "" uniformly. A space must follow the closing quote only if content follows (example: "quote", not "quote").
- **Spacing rule**: All English punctuation (, . : ; () "" '' ? !) must be followed by a space **only if there is more content after the punctuation**. No trailing space at end of line.

## Tool Runtime

- Runtime: **Bun** (for all `.ts` tools in `.opencode/tools/`)
- Dependency: `@opencode-ai/plugin` (for tool/plugin framework)
- MCP: **Exa** (deep web search, used by Priestess)
- Run `bun install` in `.opencode/` if tool dependencies change

## Article Metadata Format

Finished articles have a separate metadata JSON file at `output/<name>.meta.json`, generated by Priestess via `append-metadata` tool. The JSON contains:

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Article title (extracted from `# Title`) |
| `score` | number\|null | Comprehensive score (0-100, null if N/A) |
| `deductions` | array | Deduction reasons with id/content/severity/citation |
| `highlights` | array | Highlighted sentences with content/citation/technique |
| `wordCount` | number | Chinese character count (excludes title) |
| `requiredWords` | string | Required word count (e.g. `"1200"`, `"700-900"`, `"Unspec"`) |
| `abstract` | string | Article summary |
| `approach` | string | Creative process and writing decisions |
| `topic` | object | `original` (topic text), `keywords` (categories), `analysis` (optional) |

If `requiredWords` is a single number (e.g. "1200") or a range ("1000-1200") and actual word count deviates beyond 10% (or outside range), 5 points are deducted from score automatically.

## Style Principles (from `common.md`, summary)

1. **Gravity rhetoric**: Power from subject weight, not exclamation marks
2. **朴素崇高**: Use everyday units (一口饭, 一束光) for heavy topics
3. **Spiral论证**: 立→破→困→转→再立, not linear A→B→C
4. **Disenchanted idealism**: Acknowledge darkness fully, then still choose
5. **We-voice**: "我们" not "你" — shoulder-to-shoulder, not teacher-to-student
6. **Grounded anchoring**: Every abstraction → sensory anchor
7. **Paradox tension**: Keep contradictions unresolved
8. **Functional parallelism**: Each parallel serves argument, not decoration
9. **Metaphor承载**: Core metaphor carries structural weight, not decoration
10. **Detail anchoring**: Show, never tell with adjectives
11. **Don't conclude for reader**: Leave the bow unstrung

## Quick Reference

### Agent Switching (in OpenCode TUI)
Press `Tab` to open the agent selector, or type at the prompt:
```
--agent priestess    # Research & orchestration (color: 淡蓝灰白 #b5d2e9)
--agent esperanta    # Writing & revision (color: 浅荧光绿 #7CFF5E)
--agent kaltsit      # Review orchestration (color: 浅荧光绿 #7CFF5E)
```

### Common Prompt Patterns
```
# Priestess
"命题：愧疚教育，字数：1200"
"继续研究，补充更多案例"
"确认简报，进入写作"
"文章已完成，开始交付"

# Esperanta
"研究简报已就绪：tmp/research-brief.md，开始写作"
"根据 tmp/revision-notes.md 修改以下段落..."
"查看高分范文推荐：recommend(主题='教育')"
"更新词库后推荐：recommend(主题='愧疚教育', updateLexicon=true)"

# Kaltsit
"审校：output/愧疚教育.txt"
"重新审校修改后的版本"
```

### File Navigation
```
# List temp context files
ls tmp/

# View research brief
cat tmp/research-brief.md

# View review report
cat tmp/review-report.md

# View finished articles
ls output/
cat output/*.txt

# List lexicon databases
ls .opencode/lexicon/

# List plugins
ls .opencode/plugins/
```

### Important Files to Know
- `.opencode/prompts/common.md` — Core style rules, auto-loaded into ALL agents
- `.opencode/lexicon/` — 7 lexicon files: cilin.txt (Cilin), concept-mapping.json, topic-lexicon.json, technique-lexicon.json, issue-patterns.json, structure-patterns.json, stop-words.json
- `.opencode/plugins/` — word-count-hook.ts (write/edit hook)
- `.opencode/commands/` — Custom command definitions
