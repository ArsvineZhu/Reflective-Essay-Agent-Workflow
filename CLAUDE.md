# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **multi-agent writing workflow** built on OpenCode for crafting Chinese 思想随笔 (reflective essays), with an additional code analysis & planning agent. It runs as a series of coordinated agent sessions — each agent has a specific role and communicates primarily through files in `tmp/` and `plan/`.

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
#    Type: --agent civilight-eterna

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

# Clear plan files (清理方案文件)
rm -rf plan/*

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

### Agent Roles (defined in `.opencode/agents/`) — 9 agents total

| Agent | Mode | Model | Color | Role |
|-------|------|-------|-------|------|
| **Priestess** | primary | ds-v4-flash | `#b5d2e9` 淡蓝灰白 | Research + delivery/archive. Talks to user, writes `tmp/research-brief.md`, generates metadata JSON for finished articles, archives to `archive/YYYY-MM-DD-HHMM/` |
| **Esperanta** | primary | ds-v4-pro (max) | `#7CFF5E` 浅荧光绿 | Writer. Reads `tmp/` + ref sources, writes to `output/`. Also handles revision. |
| **Kaltsit** | primary | ds-v4-flash | `#7CFF5E` 浅荧光绿 | Review orchestrator. Selects readers by compact style ID table (no full descriptions). Delegates to 4 critics + 5 readers in two waves, aggregates via `aggregate-report` tool → `tmp/review-report.md` |
| **Civilight Eterna** | primary | ds-v4-flash | `#deb3bd` 浅粉 | Code analysis & planning (魔王). Empathetic requirement clarification, auto prompt optimization, produces implementation plans to `plan/implementation-plan.md`. |
| **critic-originality** | subagent | ds-v4-flash | — | Checks A1-A4: sentence reuse, material borrowing, metaphor overlap, ending similarity against `ref/` |
| **critic-structure** | subagent | ds-v4-flash | — | Checks B1-B12: spiral naturalness, golden sentences, metaphor consistency, parallelism, anchoring, open endings |
| **critic-voice** | subagent | ds-v4-flash | — | Checks C1-C8: "we" voice, exclamation marks, preaching, academic citations, scaffolding, language compliance |
| **critic-ai** | subagent | ds-v4-flash | — | Checks D1-D8: burstiness, syntactic repetition, transition scaffolding, token probability, emotional flatness, golden sentence patterns, example specificity, safety zone overuse |
| **Reader** | subagent | ds-v4-flash | — | 5 reader types across emotion/reason/language/experience/safety categories. Loads full style via `load-reader-style` tool by ID. Writes reports via `write-reader-report` tool. |

### Context Passing (file-based, never via conversation history)

- `tmp/research-brief.md` — Priestess → Esperanta
- `tmp/_all-analysis.md` — `load-references` tool → Esperanta
- `tmp/review-report.md` — Kaltsit → Priestess / Esperanta
- `tmp/revision-notes.md` — Priestess → Esperanta
- `plan/implementation-plan.md` — Civilight Eterna → user/any agent
- `tmp/` is **cleared** each new session; `archive/` is permanent; `plan/` is persistent

### Critical Constraints

- Priestess writes only to `tmp/`, never to `output/`
- Kaltsit + subagents never write to `output/` (judge/writer separation)
- Civilight Eterna writes only to `plan/`, never to `tmp/` or `output/`
- Esperanta reads `tmp/` for context (`task()` does NOT carry conversation history)
- `common.md` is auto-loaded via `prompt: "{file:./.opencode/prompts/common.md}"` frontmatter
- Plugins fire automatically: `word-count-hook` on `write`/`edit` to `output/*.txt`
- Subagent doubt count >= 2 → overall REJECT (review discipline)
- Finished articles get a separate metadata JSON file (`output/<name>.meta.json`) with Title/Score/Reason/WordCount/Abstract/Highlight/Approach/Topic

### Reference Sources (`ref/`)

6 categories: 南方周末, 明日方舟, 理想/未来/存续, 游戏深度文案, 中国悼文, 中文非虚构. Each has `analysis.md` loaded by Esperanta via `load-references`.

### Thematic Lexicon (`.opencode/lexicon/`)

9 files: `cilin.txt` (synonym groups), 8 JSON lexicons for concept-mapping, topic-classification, technique-detection, issue-patterns, structure-patterns, stop-words, reader-styles, and agent-personas.

### Custom Tools (`.opencode/tools/`)

Written in TypeScript via Bun. Auto-discovered. `lexicon-loader.ts` is a library module.

| Tool | Caller | Purpose |
|------|--------|---------|
| `aggregate-report` | Kaltsit | Merge critic + reader reports → `tmp/review-report.md` |
| `append-metadata` | Priestess | Generate `output/<name>.meta.json` with title/score/wordCount/etc |
| `archive` | Priestess | Archive article + intermediates to `archive/`, clear `tmp/` |
| `count` | Priestess / plugin | Count Chinese chars in `output/*.txt` (excludes title) |
| `essence` | Esperanta | Browse high-score articles by score/tag/name |
| `load-persona` | Priestess, Kaltsit | Load character persona by agent ID (kaltsit/priestess) |
| `load-reader-style` | Reader | Load full reader style by style ID |
| `load-references` | Esperanta | Load all 6 `analysis.md` → `tmp/_all-analysis.md` |
| `recommend` | Esperanta | Topic-matched article recommendation with technique analysis |
| `write-critic-report` | critic-* | Write critic review JSON with scoring and verdict |
| `write-reader-report` | Reader | Write reader report JSON with structured feedback |

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

Optional — Civilight Eterna (魔王):
   Use before coding to analyze requirements, explore codebase, clarify edge cases, and produce implementation plans to plan/.
   Can be invoked at any point where a code task needs structured planning.
```

## Key Paths

- Agent definitions: `.opencode/agents/*.md` (9 agents)
- Style rules (auto-loaded): `.opencode/prompts/common.md`
- Custom tools: `.opencode/tools/*.ts` (11 tools + 1 library module `lexicon-loader.ts`)
- Lexicon databases: `.opencode/lexicon/` (9 files: cilin.txt + 8 JSON lexicons)
- Output directory: `output/` (all articles as `.txt` with separate `.meta.json` metadata)
- Temp context: `tmp/` (cleared between sessions)
- Plans: `plan/` (implementation plans from Civilight Eterna)
- Archives: `archive/YYYY-MM-DD-HHMM/` (6 archives)
- Reference sources: `ref/*/`
- Plugins: `.opencode/plugins/word-count-hook.ts`
- Config: `opencode.json`

## Reader Categories

Each reader style includes **固有偏见警示** — acknowledging its inherent predisposition and providing compensation mechanisms.

| Category | Available Styles | Evaluation Dimension |
|----------|-----------------|---------------------|
| Emotion | 感性读者, 怀旧型读者, 共情型读者 | 共情程度 / 怀旧强度 / 共情深度 |
| Reason | 怀疑论者, 哲学型读者, 实用主义者 | 逻辑漏洞 / 前提审视 / 实用价值 |
| Language | 审美型读者, 翻译耳读者, 节奏型读者 | 语言质感 / 中文自然度 / 节奏感 |
| Experience | 普通路人, 亲历者型, 文化比较者 | 留存度 / 真实感 / 文化自觉 |
| Safety | 锐度审查者, 套路督察官, 权力审视者, 庸俗读者, 完整性审查者 | 话题锐度 / 套路密度 / 操控痕迹 / 注意力留存 / 论证完整度 |

Kaltsit must select at least 1 per category; can select more based on article theme.

## Code & Configuration Guidelines

- **Punctuation in code/config files**: Minimize Chinese-specific quotation marks in all configuration files, markdown documentation, and code.
- **Quote style**: Use English double quotes "". A space must follow the closing quote only if content follows.
- **Spacing rule**: All English punctuation must be followed by a space only if there is more content after the punctuation. No trailing space at end of line.

## Tool Runtime

- Runtime: **Bun** (all `.ts` tools in `.opencode/tools/`)
- Dependency: `@opencode-ai/plugin`
- MCP: **Exa** (deep web search, used by Priestess and Civilight Eterna)
- Run `bun install` in `.opencode/` if tool dependencies change

## Article Metadata

`output/<name>.meta.json` generated by Priestess via `append-metadata`. Fields: title, score, deductions, highlights, wordCount, requiredWords, abstract, approach, topic. Word count penalty: 5pts if outside ±10% of requiredWords.
