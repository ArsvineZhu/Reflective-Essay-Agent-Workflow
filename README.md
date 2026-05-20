# Reflective Essay Agent Workflow

多代理协作的中文思想随笔写作工作流，基于 OpenCode 原生代理系统构建。

## 核心哲学

- **螺旋论证**：立→破→困→转→再立，不是线性 A→B→C
- **共同体之声**：用"我们"，不说教，并肩面对
- **朴素崇高**：一口饭、一束光托住沉重话题
- **祛魅理想**：彻底承认黑暗，然后仍然选择光
- **锚定细节**：每个抽象论断绑定感官场景
- **保留悖论**：不急于化解矛盾，让读者自己拼凑真相

## 快速开始

```
新会话 (Priestess) → 命题：愧疚教育，字数：1200
  ↓ 交互研究 → 简报确认
新会话 (Esperanta) → 写作完成 → 展示路径与摘要
  ↓ 
新会话 (Kaltsit) → 审校 xxx.txt
  ↓ 通过 / 不通过
修订 → 交付 → 归档

可选的规划环节（开发相关）:
  新会话 (Civilight Eterna) → 分析代码任务 → 输出 plan/ 方案
```

## 代理角色

| 代理 | 模型 | 职责 |
|------|------|------|
| **Priestess** | ds-v4-flash | 编排者：对话研究，产出简报，协调审校，交付归档 |
| **Esperanta** | ds-v4-pro | 创作者：读 tmp/ + 参考源 → 写作 / 修订 |
| **Kaltsit** | ds-v4-flash | 审校编排：派 4 个批评者 + 5 个读者，聚合报告 |
| **Civilight Eterna** | ds-v4-flash | 代码分析规划 ：需求澄清、代码探索、输出方案至 plan/ |
| **critic-originality** | ds-v4-flash | 原创性检查（A1-A4）：句式/意象/素材相似性 |
| **critic-structure** | ds-v4-flash | 结构检查（B1-B12）：螺旋/金句/隐喻/锚定 |
| **critic-voice** | ds-v4-flash | 文风检查（C1-C8）：共同体之声/合规性/流程 |
| **critic-ai** | ds-v4-flash | AI感审查（D1-D8）：突发度/句式重复/情绪平坦度 |
| **Reader** | ds-v4-flash | 5 类读者反馈：情感/理性/语言/体验/安全 |

## 上下文传递

`task()` 不携带对话历史，上下文通过文件传递：

| 文件 | 写入者 | 读取者 |
|------|--------|--------|
| `tmp/research-brief.md` | Priestess | Esperanta |
| `tmp/_all-analysis.md` | `load-references` 工具 | Esperanta |
| `tmp/review-report.md` | Kaltsit | Priestess / Esperanta |
| `tmp/revision-notes.md` | Priestess | Esperanta |
| `plan/implementation-plan.md` | Civilight Eterna | 用户 / 任意代理 |

## 参考源（6 类）

| 参考源 | 路径 | 技巧焦点 |
|--------|------|----------|
| 南方周末新年献词 | `ref/southern-weekly/` | 人群结构、仪式感、分层排比 |
| 明日方舟文案 | `ref/arknights/` | 悖论修辞、隐喻即理由、克制抒情 |
| 理想、未来与存续 | `ref/ideals-future/` | 螺旋结构、祛魅、落地锚定 |
| 游戏深度文案 | `ref/game-narratives/` | 落地告别、结构镜像、罗生门叙事 |
| 中国悼文 | `ref/chinese-elegies/` | 细节锚定、结尾张力、未说的克制 |
| 中文非虚构 | `ref/chinese-nonfiction/` | 碎片散文、含混性保留 |

## 读者体系

每类至少选 1 个，可根据主题多选。完整风格描述通过 `load-reader-style` 工具按 ID 加载，不嵌入代理提示词以节省 token。

每种风格包含 **固有偏见警示**，提示该读者类型的预设倾向并提供补偿机制，确保公正评判。

| 类别 | 可选风格 | 评估维度 |
|------|---------|----------|
| **情感** | 感性读者、怀旧型读者、共情型读者 | 共情程度 / 怀旧强度 / 共情深度 |
| **理性** | 怀疑论者、哲学型读者、实用主义者 | 逻辑漏洞 / 前提审视 / 实用价值 |
| **语言** | 审美型读者、翻译耳读者、节奏型读者 | 语言质感 / 中文自然度 / 节奏感 |
| **体验** | 普通路人、亲历者型、文化比较者 | 留存度 / 真实感 / 文化自觉 |
| **安全** | 锐度审查者、套路督察官、权力审视者、庸俗读者、完整性审查者 | 内容锐度 / 套路密度 / 操控痕迹 / 注意力留存 / 论证完整度 |

## 自定义工具

| 工具 | 调用者 | 用途 |
|------|--------|------|
| `recommend` | Esperanta | **【增强版】根据主题智能推荐范文** → 输出技法摘要（低tokens）。内置5个词库，支持15个主题分类、12种技法识别，匹配准确率~85%） |
| `aggregate-report` | Kaltsit | 合并批评报告 + 读者感受 → 审校报告 |
| `append-metadata` | Priestess | 生成独立元数据 JSON 文件（自动提取标题/字数/评分，字数偏差扣分） |
| `archive` | Priestess | 归档终稿 + 全部中间文件，清理 tmp/ |
| `count` | Priestess | 统计中文字数（排除标题和元数据） |
| `essence` | Esperanta | **高分范文工具**：按分数列出/指定文章名获取原文/列出全部文章清单 |
| `load-persona` | Priestess, Kaltsit | 按代理 ID 加载人设风格，仅非工作交流时使用 |
| `load-reader-style` | Reader | 按 style ID 加载完整读者风格描述 |
| `load-references` | Esperanta | 加载全部 6 个参考源技法分析 |
| `write-critic-report` | critic-* | 写入批评审校报告（自动编号 + 计算分数） |
| `write-reader-report` | Reader | 写入读者印象（自动编号） |

## 关键约束

| 约束 | 原因 |
|------|------|
| Priestess 只写 tmp/，不写 output/ | 只研究不创作 |
| Kaltsit + 子代理不写 output/ | 写作与评判分离 |
| Civilight Eterna 只写 plan/，不写 tmp/ 或 output/ | 代码分析与文章写作分离 |
| Esperanta 读 tmp/ 获取上下文 | task() 不传历史 |
| common.md 对部分代理自动加载 | 零手动步骤 |
| word-count-hook 写入时触发 | 零手动计数 |
| 子代理存疑 ≥ 2 → 总体不通过 | 审校纪律 |
| 归档包含所有中间文件 | 完整可追溯 |

## 目录结构

```
reflective-essay-workflow/
├── .opencode/
│   ├── agents/              # 代理定义
│   ├── prompts/
│   │   └── common.md       # 风格定义（自动加载）
│   ├── tools/              # 自定义工具（TypeScript）
│   ├── lexicon/            # 词库 + 读者风格 + 人设（JSON）
│   ├── plugins/            # word-count-hook 插件
│   ├── package.json
│   └── tsconfig.json
├── ref/                    # 6 类参考源 + analysis.md
├── output/                 # 文章输出（.txt + 元数据）
├── tmp/                    # 临时上下文（会话间清空）
├── plan/                   # 实现方案（Civilight Eterna 产出）
├── archive/                # 历史归档（永久保存）
├── workflow.md             # 详细工作流文档
├── SCORING.md              # 评分方法详解
├── CLAUDE.md               # Claude Code 项目说明
└── README.md
```

## 已归档作品

- `2026-05-13-2257/` — 都是为了你好_v2
- `2026-05-14-2352/` — 在误解之后
- `2026-05-15-1326/` — 鞭子
- `2026-05-15-2154/` — 月亮不必每夜都圆
- `2026-05-16-1618/` — 词的归处

## 运行环境

- **OpenCode**（原生代理系统 + 自定义工具 + MCP）
- **Bun**（TypeScript 工具运行时）
- **DeepSeek**（ds-v4-flash / ds-v4-pro 模型）
- **Exa**（MCP 服务，网络深度搜索）
