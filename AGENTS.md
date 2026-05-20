# AGENTS.md

Project guidance for OpenCode sessions working in this repository.

## Project Overview

**Multi-agent writing workflow** for Chinese 思想随笔 (reflective essays). Agents communicate through files in `tmp/` and `plan/` -- never through conversation history.

Core philosophy: spiral essays (not linear), "we" voice (not "you" preaching), anchor abstractions in sensory details, never borrow examples from reference sources.

## Session Discipline

**Each agent step requires a NEW OpenCode session.** Do not switch agents within the same session. Every `task()` call passes only file paths -- no conversation history is carried.

## Architecture

### Agent Roles -- 9 agents, auto-discovered from `.opencode/agents/*.md`

| Agent | Mode | Model | Role |
|-------|------|-------|------|
| **Priestess** | primary | ds-v4-flash | Research + delivery/archive. Writes `tmp/research-brief.md`, metadata JSON, archives to `archive/` |
| **Esperanta** | primary | ds-v4-pro | Writer. Reads `tmp/` + ref sources, writes to `output/`. Also handles revision. |
| **Kaltsit** | primary | ds-v4-flash | Review orchestrator. Dispatches in **two waves**: wave 1 (4 critics + 1 reader in parallel), then wave 2 (4 readers). Aggregates via `aggregate-report` tool. |
| **Civilight Eterna** | primary | ds-v4-flash | Code analysis & planning. Outputs implementation plans to `plan/` |
| **critic-originality** | subagent | ds-v4-flash | A1-A4: sentence/material/metaphor/ending reuse against `ref/` |
| **critic-structure** | subagent | ds-v4-flash | B1-B12: spiral structure, golden sentences, metaphor, parallelism, anchoring |
| **critic-voice** | subagent | ds-v4-flash | C1-C8: "we" voice, exclamation marks, preaching, citations, scaffolding, emoji |
| **critic-ai** | subagent | ds-v4-flash | D1-D8: burstiness, syntactic repetition, transition scaffolding, emotional flatness |
| **Reader** | subagent | ds-v4-flash | 5 reader types across emotion/reason/language/experience/safety. Loads style by ID via `load-reader-style` tool. |

### Config Auto-Discovery (OpenCode 1.15.x+)

- Agents are auto-discovered from `.opencode/agents/*.md` -- **not** declared in `opencode.json`
- Tools are auto-discovered from `.opencode/tools/*.ts` -- **not** declared in `opencode.json`
- `opencode.json` only contains MCP configurations (Exa search)
- `common.md` is auto-loaded via `prompt: "{file:./.opencode/prompts/common.md}"` frontmatter in agent `.md` files (used by Esperanta, Kaltsit, critic-structure, critic-voice)

## Workflow Sequence

```
Session 1 (Priestess):  research -> confirm -> write tmp/research-brief.md
Session 2 (Esperanta):  read tmp/ + load-references -> write -> output/{topic}.txt
Session 3 (Kaltsit):    two-wave dispatch -> aggregate-report -> tmp/review-report.md
  IF PASS:   return to Priestess -> append-metadata -> archive
  IF REJECT: Priestess writes tmp/revision-notes.md -> Esperanta revises -> Kaltsit re-reviews
Session 4 (Priestess):  confirm -> append-metadata -> archive (clears tmp/)
```

## Context Passing

| File | Writer | Reader |
|------|--------|--------|
| `tmp/research-brief.md` | Priestess | Esperanta |
| `tmp/_all-analysis.md` | `load-references` tool | Esperanta |
| `tmp/review-report.md` | Kaltsit | Priestess / Esperanta |
| `tmp/revision-notes.md` | Priestess | Esperanta |
| `plan/implementation-plan.md` | Civilight Eterna | user / any agent |

`tmp/` cleared each session; `archive/` permanent; `plan/` persistent.

## Reader System

Each style has **固有偏见警示** -- acknowledging inherent predisposition with compensation mechanisms. Kaltsit selects 1+ per category by article theme. Full style text loaded via `load-reader-style` tool by ID, not embedded in prompts.

| Category | Styles | Dimension |
|----------|--------|-----------|
| Emotion | 感性读者, 怀旧型, 共情型 | Emotional impact / memory trigger / empathy depth |
| Reason | 怀疑论者, 哲学型, 实用主义者 | Logic holes / premise scrutiny / utility |
| Language | 审美型, 翻译耳, 节奏型 | Language quality / Chinese naturalness / rhythm |
| Experience | 普通路人, 亲历者型, 文化比较者 | Retention / authenticity / cultural awareness |
| Safety | 锐度审查者, 套路督察官, 权力审视者, 庸俗读者, 完整性审查者 | Sharpness / cliche density / power dynamics / attention / completeness |

## Key Paths

- Agents: `.opencode/agents/*.md` (9 files)
- Tools: `.opencode/tools/*.ts` (11 tools + `lexicon-loader.ts` library)
- Plugins: `.opencode/plugins/word-count-hook.ts` (1 plugin)
- Lexicon: `.opencode/lexicon/` (cilin.txt + 8 JSON; `.bak` files exist, ignore them)
- Style rules: `.opencode/prompts/common.md` (auto-loaded, never manually sourced)
- Output: `output/` (`.txt` + `.meta.json`)
- Context: `tmp/` (cleared between sessions)
- Plans: `plan/`
- Archives: `archive/YYYY-MM-DD-HHMM/`
- References: `ref/` (6 categories: arknights, chinese-elegies, chinese-nonfiction, game-narratives, ideals-future, southern-weekly; each has `analysis.md` + source texts)

## Critical Constraints

- Priestess writes only to `tmp/`; Kaltsit + subagents **never** write to `output/`
- Civilight Eterna writes only to `plan/`; never to `tmp/` or `output/`
- Subagent doubt count >= 2 -> overall REJECT
- Word count penalty: 5pts if outside +-10% of requiredWords
- Persona text loaded via `load-persona` tool (non-work only), not embedded in prompts
- `word-count-hook` plugin fires automatically on every `write`/`edit` to `output/*.txt`
- Arbitration: finish approving or rejecting comments promptly; do not leave conversations hanging

## Verification Commands

```bash
# Install/update tool dependencies (run in .opencode/ directory)
cd .opencode && bun install

# TypeScript type-check (run in .opencode/ directory)
cd .opencode && bunx --bun tsc --noEmit

# Start with pure mode (no plugins, for troubleshooting)
opencode --pure
```

## Development Documentation

When modifying this repository (tools, agents, plugins, lexicons, or configuration), **consult the corresponding `docs/` file first**:

| Area | Document |
|------|----------|
| Code style, naming, punctuation rules | `docs/CODE_STYLE.md` |
| Scoring algorithm, deduction tables, verdict rules | `docs/SCORING.md` |
| Essence tool behavior and output format | `docs/ESSENCE_TOOL.md` |
| Recommend tool behavior, matching algorithm | `docs/RECOMMEND_TOOL.md` |
| Lexicon structure, word lists, maintenance | `docs/LEXICON_GUIDE.md` |

These docs are the **executable source of truth** for tool contracts and scoring logic. The tool implementations (`.opencode/tools/*.ts`) implement what these docs specify.

## Code & Configuration Guidelines

- Use English double quotes "". Space after punctuation only if more content follows. No trailing spaces.
- Minimize Chinese quotation marks (" " ' ') in config/code files.
- Runtime: **Bun** for TypeScript tools, `@opencode-ai/plugin` framework.
- MCP: **Exa** for deep web search (configured in `opencode.json`).
- TS config: `moduleResolution: "bundler"`, `noEmit: true`, strict mode. Includes `tools/**/*.ts` and `plugins/**/*.ts`.
- Naming: tools/plugins use kebab-case filenames; types use PascalCase; functions use camelCase.
