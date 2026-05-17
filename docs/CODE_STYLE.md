# 代码规范

## 概述

本项目采用 TypeScript 开发，基于 OpenCode 工具框架。所有代码需遵循本规范，保持代码风格一致性。

---

## 标点规范

### 核心原则

**所有代码中的描述性文字（注释、字符串、配置）使用中文描述，但标点符号统一使用英文标点。**

### 具体要求

| 中文标点 | 英文标点 | 说明 |
|---------|---------|------|
| `。` | `.` | 句号使用英文句点 |
| `，` | `,` | 逗号使用英文逗号 |
| `；` | `;` | 分号使用英文分号 |
| `：` | `:` | 冒号使用英文冒号 |
| `！` | `!` | 感叹号使用英文感叹号 |
| `？` | `?` | 问号使用英文问号 |
| `（` `）` | `(` `)` | 括号使用英文括号 |
| `【` `】` | `[` `]` | 方括号使用英文方括号 |

**适用范围补充**：
- 代码中的所有中文描述性文字（注释、字符串、工具描述）统一使用英文标点
- Markdown 文档中的中文内容也遵循英文标点规范
- 正则表达式和代码语法本身的标点不受此规则限制

### 正反示例

✅ **正确写法**：
```typescript
description: "将多份批评报告和读者感受合并为一份审校报告. 直接整合文件内容, 无需代理手动读取并重写."

args: {
  article: tool.schema.string().describe("文章路径, 如 ./output/xxx.txt"),
  limit: tool.schema.number().default(3).describe("最多输出篇数, 默认 3 篇")
}

// 缓存命中检查
// 如果文件不存在, 返回空结果
```

❌ **错误写法**：
```typescript
description: "将多份批评报告和读者感受合并为一份审校报告。直接整合文件内容，无需代理手动读取并重写。"

args: {
  article: tool.schema.string().describe("文章路径，如 ./output/xxx.txt"),
  limit: tool.schema.number().default(3).describe("最多输出篇数，默认 3 篇")
}

// 缓存命中检查。
// 如果文件不存在，返回空结果
```

---

## Emoji 禁止规则

### 核心原则

所有代码文件和输出文本禁止使用 emoji 或其他 Unicode 图形符号. 表达应依靠文字本身的力量, 而非图形符号.

### 禁止范围

| 类别 | 示例 | 说明 |
|------|------|------|
| 表情符号 | 😀 😂 🤔 😊 | 所有面部表情类 emoji |
| 符号类 | 💡 ✅ ❌ 📊 ✓ ✗ | 灯泡、对勾、叉号等 |
| 物品类 | 🔧 📁 💾 🎯 | 工具、文件、图标等 |
| 天气/箭头 | ☀️ ❄️ ↓ → | 天气符号和箭头类 |

### 允许例外

- 第三方依赖文件（`node_modules/` 等外部库）
- 用户输入的文章内容本身（仅代码和工具输出受限制）
- 测试数据中用于验证 emoji 检测功能的用例

### 正反示例

✅ **正确写法**：
```typescript
lines.push('[统计] 共检索 100 篇文章')
lines.push('[提示] 使用 essence() 查看完整原文')
lines.push('[匹配] 关键词命中')
```

❌ **错误写法**：
```typescript
lines.push('📊 共检索 100 篇文章')
lines.push('💡 使用 essence() 查看完整原文')
lines.push('✓ 关键词命中')
```

---

## 空格规范

### 核心原则

合理使用空格提升可读性, 但避免多余空格. 一致性优于个人偏好.

### 具体要求

| 场景 | 规则 | 正确 | 错误 |
|------|------|------|------|
| 中文与英文/数字之间 | 留空格 | `使用 React 框架`, `共有 100 篇` | `使用React框架`, `共有100篇` |
| 中文与英文标点之间 | 留空格 | `重要提示. 注意事项` | `重要提示.注意事项` |
| 英文标点之后 | 留空格 | `a, b, c`, `x + y = z` | `a,b,c`, `x + y=z` |
| 英文标点之前 | 不留空格 | `hello world.` | `hello world .` |
| 运算符前后 | 留空格 | `a = b + c`, `x === y` | `a=b+c`, `x===y` |
| 逗号/分号之后 | 留空格 | `a, b, c`, `for (let i = 0; i < n; i++)` | `a,b,c`, `for(let i=0;i<n;i++)` |
| 括号内侧 | 不留空格 | `(a + b)`, `[1, 2, 3]` | `( a + b )`, `[ 1, 2, 3 ]` |
| 函数调用括号 | 前面不留空格 | `fn()`, `tool.schema()` | `fn ()`, `tool.schema ()` |

### 正反示例

✅ **正确写法**：
```typescript
// 中文与英文之间留空格
description: "集成 OpenCode 工具框架, 支持 5 种配置"

// 运算符前后留空格
const result = a + b * c
if (x === y && z > 0) {

// 逗号后留空格
const arr = [1, 2, 3]
function add(a, b) { return a + b }
```

❌ **错误写法**：
```typescript
// 中文与英文之间无空格
description: "集成OpenCode工具框架,支持5种配置"

// 运算符前后无空格
const result=a+b*c
if(x===y&&z>0) {

// 逗号后无空格
const arr=[1,2,3]
function add(a,b) {return a+b}
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `lexicon-loader.ts` |
| 类型/接口 | PascalCase | `interface ArticleMeta` |
| 函数/方法 | camelCase | `function loadLexicon()` |
| 常量 | UPPER_SNAKE_CASE | `const STOP_WORDS` |
| 变量 | camelCase | `let matchedCount` |
| 私有成员 | _camelCase | `private _cache` |

### 类型定义

```typescript
// 使用 interface 而非 type 定义对象结构
interface ArticleMeta {
  filename: string
  title: string
  score: number
  topics: string[]
}

// 使用 type 定义联合类型和函数签名
type MatchResult = ArticleMeta & {
  score: number
  matchedCategories: string[]
}

// 导出所有需要外部使用的类型
export { ArticleMeta, MatchResult }
```

### 导入规范

```typescript
// 标准库导入在前
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// 然后是第三方库
import { tool } from "@opencode-ai/plugin"

// 最后是内部模块
import { loadLexicon, calculateTopicMatchScore } from "./lexicon-loader"

// 避免使用 * 导入，明确导入需要的内容
```

### 注释规范

```typescript
/**
 * 加载所有词库文件.
 * @param basePath - 项目根目录路径
 * @returns 词库集合对象
 */
export function loadLexicon(basePath: string): Lexicon {
  // 单行注释前面空一格
  const lexiconDir = join(basePath, '.opencode', 'lexicon')
  
  // 不同逻辑块之间空行分隔
  // 缓存命中检查
  if (lexiconCache && cachePath === lexiconDir) {
    return lexiconCache
  }
}
```

---

## 工具函数规范

### 工具定义模板

```typescript
import { tool } from "@opencode-ai/plugin"
import { someUtil } from "./utils"

interface ToolArgs {
  // 参数定义
}

interface ToolResult {
  // 返回值定义
}

export default tool({
  description: "工具功能描述. 清晰简洁, 使用英文标点.",
  args: {
    param1: tool.schema.string()
      .describe("参数1说明. 清晰描述参数用途."),
    param2: tool.schema.number().optional()
      .describe("参数2说明. 可选参数需注明.")
  },
  async execute(args, context): Promise<string | ToolResult> {
    // 1. 参数校验
    // 2. 核心逻辑
    // 3. 异常处理
    // 4. 返回结果
  }
})
```

### 参数校验

```typescript
async execute(args, context) {
  // 必需参数校验
  if (!args.article) {
    throw new Error("article 参数不能为空.")
  }

  // 范围校验
  if (args.limit && (args.limit < 1 || args.limit > 10)) {
    throw new Error("limit 范围应为 1-10.")
  }
}
```

### 错误处理

```typescript
try {
  // 可能出错的操作
} catch (e) {
  // 处理错误并返回用户友好的提示
  const message = e instanceof Error ? e.message : "未知错误"
  return `操作失败: ${message}`
}
```

---

## 词库文件规范

### JSON 格式要求

```json
{
  "name": "topic-lexicon",
  "version": "1.0",
  "description": "主题词库. 按领域分类的核心关键词.",
  "categories": {
    "family": {
      "name": "家庭与亲情",
      "keywords": ["父亲", "母亲", "家庭"],
      "weight": 1.5
    }
  }
}
```

### 词库维护原则

1. **版本号**：语义化版本号（MAJOR.MINOR.PATCH）
2. **描述**：清晰说明词库的用途和覆盖范围
3. **关键词**：按使用频率排序，高频在前
4. **中文内容**：词库中的中文词汇保持中文标点（如关键词本身）

---

## 文档规范

### Markdown 格式

- 标题层级：`#` `##` `###` 依次递进，不跳级
- 列表：无序列表使用 `-`，有序列表使用 `1.`
- 代码块：指定语言类型 ````typescript`
- 表格：对齐美观，内容完整

### 文档分类

| 文档 | 位置 | 说明 |
|------|------|------|
| 项目说明 | `README.md` | 项目概览，快速开始 |
| 工具使用 | `docs/XXX_TOOL.md` | 单个工具的详细使用说明 |
| 系统指南 | `docs/XXX_GUIDE.md` | 系统模块的完整文档 |
| 代码规范 | `docs/CODE_STYLE.md` | 本文件 |

---

## Git 提交规范

### 提交信息格式

```
<type>(<scope>): <subject>
```

### 类型说明

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响代码运行的变动） |
| `refactor` | 重构（既不是新增功能，也不是修复 bug 的代码变动） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建过程或辅助工具的变动 |

### 示例

```
feat(recommend): 集成词库系统, 提升匹配准确率
fix(lexicon): 修复概念扩展时的数组越界问题
docs(code-style): 新增代码规范文档
chore(tools): 更新所有工具描述的中文标点为英文标点
```

---

## 检查清单

提交代码前, 请确认:

- [ ] 所有注释和字符串描述使用英文标点
- [ ] 代码中无任何 emoji 或 Unicode 图形符号
- [ ] 中文与英文/数字之间有空格
- [ ] 命名符合规范, 含义清晰
- [ ] 类型定义完整, 避免使用 `any`
- [ ] 错误处理完善, 错误信息友好
- [ ] 关键逻辑有注释说明
- [ ] 代码格式化完成（缩进统一为 2 空格）
- [ ] 文档同步更新

---

## 自动化检查

建议配置 Git 钩子, 在提交前自动运行:

```bash
# 检查中文标点
grep -n "[。，；：！？]" src/*.ts

# 检查 emoji
grep -n "[\u{1F300}-\u{1F9FF}][\u{2600}-\u{26FF}][\u{2700}-\u{27BF}]" .opencode/**/*.ts
```
