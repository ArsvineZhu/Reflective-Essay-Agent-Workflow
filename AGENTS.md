# AGENTS.md

Project guidance for Codex when working with this repository.

## Project Overview

**Multi-agent writing workflow** on OpenCode for Chinese 思想随笔 (reflective essays). Agents communicate through files in `tmp/` and `plan/`.

Core philosophy: spiral essays (not linear), "we" voice (not "you" preaching), anchor abstractions in sensory details, never borrow examples from reference sources.

## Architecture

### Agent Roles — 9 agents

| Agent | Mode | Role |
|-------|------|------|
| **Priestess** | primary | Research + delivery/archive. Writes `tmp/research-brief.md`, generates metadata JSON, archives to `archive/` |
| **Esperanta** | primary | Writer. Reads `tmp/` + ref sources, writes to `output/`. Also handles revision. |
| **Kaltsit** | primary | Review orchestrator. Delegates to 4 critics + 5 readers, aggregates via `aggregate-report` |
| **Civilight Eterna** | primary | Code analysis & planning. Outputs implementation plans to `plan/` |
| **critic-originality** | subagent | Checks A1-A4: sentence/material/metaphor/ending reuse against `ref/` |
| **critic-structure** | subagent | Checks B1-B12: spiral structure, golden sentences, metaphor, parallelism, anchoring |
| **critic-voice** | subagent | Checks C1-C9: "we" voice, exclamation marks, preaching, citations, scaffolding, emoji |
| **critic-ai** | subagent | Checks D1-D8: burstiness, syntactic repetition, transition scaffolding, emotional flatness |
| **Reader** | subagent | 5 reader types across emotion/reason/language/experience/safety. Loads style by ID via tool |

### Context Passing

All `task()` calls pass only file paths — no conversation history.

- `tmp/research-brief.md` — Priestess → Esperanta
- `tmp/_all-analysis.md` — `load-references` tool → Esperanta
- `tmp/review-report.md` — Kaltsit → Priestess / Esperanta
- `tmp/revision-notes.md` — Priestess → Esperanta
- `plan/implementation-plan.md` — Civilight Eterna → user/any agent
- `tmp/` cleared each session; `archive/` permanent; `plan/` persistent

## Reader System

Each style has **固有偏见警示** — acknowledging inherent predisposition with compensation mechanisms.

| Category | Styles | Dimension |
|----------|--------|-----------|
| Emotion | 感性读者, 怀旧型, 共情型 | Emotional impact / memory trigger / empathy depth |
| Reason | 怀疑论者, 哲学型, 实用主义者 | Logic holes / premise scrutiny / utility |
| Language | 审美型, 翻译耳, 节奏型 | Language quality / Chinese naturalness / rhythm |
| Experience | 普通路人, 亲历者型, 文化比较者 | Retention / authenticity / cultural awareness |
| Safety | 锐度审查者, 套路督察官, 权力审视者, 庸俗读者, 完整性审查者 | Sharpness / cliche density / power dynamics / attention / completeness |

Kaltsit selects 1+ per category by article theme. Readers load full style text via `load-reader-style` tool by ID.

## Key Paths

- Agents: `.opencode/agents/*.md` (9)
- Tools: `.opencode/tools/*.ts` (11 + `lexicon-loader.ts` lib)
- Lexicon: `.opencode/lexicon/` (cilin.txt + 8 JSON: concept-mapping, topic, technique, issue-patterns, structure, stop-words, reader-styles, personas)
- Output: `output/` (`.txt` + `.meta.json`)
- Context: `tmp/` (cleared between sessions)
- Plans: `plan/`
- Archives: `archive/YYYY-MM-DD-HHMM/`
- References: `ref/*/`
- Config: `opencode.json`

## Critical Constraints

- Priestess writes only to `tmp/`; Kaltsit + subagents never write to `output/`
- Civilight Eterna writes only to `plan/`
- `common.md` auto-loaded for essay-writing agents via frontmatter
- Subagent doubt count >= 2 → overall REJECT
- Persona text loaded via `load-persona` tool (non-work only), not embedded
- Word count penalty: 5pts if outside ±10% of requiredWords

## Code & Configuration Guidelines

- Use English double quotes "". Space after punctuation only if more content follows. No trailing spaces.
- Minimize Chinese quotation marks in config/code files.
- Runtime: **Bun** for TypeScript tools, `@opencode-ai/plugin` framework, **Exa** MCP for deep search.
