---
name: source-driven-development
description: Grounds every implementation decision in official documentation. Use when you want authoritative, source-cited code free from outdated patterns. Use when building with any framework or library where correctness matters.
---

# Source-Driven Development

## Top-level Boundary Pack

### current main output
- 基于官方文档验证过的实现决策
- 带来源引用的框架/库相关代码或改进建议
- 被显式核实过的版本相关模式，而不是凭记忆写出的实现

### current main action
- 检测技术栈与版本
- 获取对应官方文档
- 按文档模式实现或改进代码
- 引用来源并对未验证部分显式标记

### should-trigger
当当前主任务满足以下任一项时，优先进入本 Skill：
- 正在实现依赖具体框架/库推荐模式的代码
- 用户明确要求“基于官方文档”“要可引用来源”“不要靠记忆”
- 正在写可复制的 boilerplate、starter、模式性代码
- 正在审查或修复框架相关代码，且正确性高度依赖版本与官方推荐方式

### should-not-trigger
以下请求不应由本 Skill 接管：
- 纯逻辑问题，与特定框架/库版本无关
- 变量改名、移动文件、修 typo 等无需文档验证的小动作
- 用户明确要求只求速度，不需要查证来源
- 当前主任务是产品定义、任务拆解或纯安全边界分析，而不是框架实现正确性

### adjacent destination
- 技术文档查询 / API 用法问答 → `/Users/handy/.claude/skills/doc-lookup/SKILL.md`
- 代码实现主路径 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 上下文装配与 rules/context 组织 → `/Users/handy/.claude/skills/context-engineering/SKILL.md`
- 安全边界主风险 → `/Users/handy/.claude/skills/security-and-hardening/SKILL.md`

### non-goals
- 不替代普通实现主路径
- 不把所有代码都强行升级成重文档验证流程
- 不用博客、论坛或训练数据冒充一手来源
- 不在查不到官方文档时假装已经验证

### first action after hit
先检测技术栈与版本，再获取对应官方文档页面；如果没有先完成“版本 + 文档”两步，就不算真正 adopt 本 Skill。

### positive examples
- “用 React 19 的官方推荐方式帮我写这个表单提交逻辑，并给出来源。”
  - why should trigger: 正在写高度依赖框架当前推荐模式的实现
  - expected adopt signal: 先检测版本，再抓官方文档，再实现并引用来源
- “这个 Next.js 路由写法我不想靠记忆，按当前官方文档来。”
  - why should trigger: 用户明确要求 source-driven correctness
  - expected adopt signal: 先查官方 docs，再按文档模式落代码

### negative examples
- “帮我把这几个变量名改清楚一点。”
  - why should not trigger: 不依赖特定框架/版本文档
  - correct destination: 直接在主实现路径处理即可
- “先帮我写这块功能的 spec 和 success criteria。”
  - why should not trigger: 主任务是定义，不是框架实现正确性
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`
- “这个 webhook 先帮我看 trust boundary 和滥用路径。”
  - why should not trigger: 主风险是安全边界，而不是文档来源正确性
  - correct destination: `/Users/handy/.claude/skills/security-and-hardening/SKILL.md`

## Overview

Every framework-specific code decision must be backed by official documentation. Don't implement from memory — verify, cite, and let the user see your sources. Training data goes stale, APIs get deprecated, best practices evolve. This skill ensures the user gets code they can trust because every pattern traces back to an authoritative source they can check.

## When to Use

- The user wants code that follows current best practices for a given framework
- Building boilerplate, starter code, or patterns that will be copied across a project
- The user explicitly asks for documented, verified, or "correct" implementation
- Implementing features where the framework's recommended approach matters (forms, routing, data fetching, state management, auth)
- Reviewing or improving code that uses framework-specific patterns
- Any time you are about to write framework-specific code from memory

**When NOT to use:**

- Correctness does not depend on a specific version (renaming variables, fixing typos, moving files)
- Pure logic that works the same across all versions (loops, conditionals, data structures)
- The user explicitly wants speed over verification ("just do it quickly")

## The Process

```
DETECT ──→ FETCH ──→ IMPLEMENT ──→ CITE
  │          │           │            │
  ▼          ▼           ▼            ▼
 What       Get the    Follow the   Show your
 stack?     relevant   documented   sources
            docs       patterns
```

### Step 1: Detect Stack and Versions

Read the project's dependency file to identify exact versions:

```
package.json    → Node/React/Vue/Angular/Svelte
composer.json   → PHP/Symfony/Laravel
requirements.txt / pyproject.toml → Python/Django/Flask
go.mod          → Go
Cargo.toml      → Rust
Gemfile         → Ruby/Rails
```

State what you found explicitly:

```
STACK DETECTED:
- React 19.1.0 (from package.json)
- Vite 6.2.0
- Tailwind CSS 4.0.3
→ Fetching official docs for the relevant patterns.
```

If versions are missing or ambiguous, **ask the user**. Don't guess — the version determines which patterns are correct.

### Step 2: Fetch Official Documentation

Fetch the specific documentation page for the feature you're implementing. Not the homepage, not the full docs — the relevant page.

**Source hierarchy (in order of authority):**

| Priority | Source | Example |
|----------|--------|---------|
| 1 | Official documentation | react.dev, docs.djangoproject.com, symfony.com/doc |
| 2 | Official blog / changelog | react.dev/blog, nextjs.org/blog |
| 3 | Web standards references | MDN, web.dev, html.spec.whatwg.org |
| 4 | Browser/runtime compatibility | caniuse.com, node.green |

**Not authoritative — never cite as primary sources:**

- Stack Overflow answers
- Blog posts or tutorials (even popular ones)
- AI-generated documentation or summaries
- Your own training data (that is the whole point — verify it)

**Be precise with what you fetch:**

```
BAD:  Fetch the React homepage
GOOD: Fetch react.dev/reference/react/useActionState

BAD:  Search "django authentication best practices"
GOOD: Fetch docs.djangoproject.com/en/6.0/topics/auth/
```

After fetching, extract the key patterns and note any deprecation warnings or migration guidance.

When official sources conflict with each other (e.g. a migration guide contradicts the API reference), surface the discrepancy to the user and verify which pattern actually works against the detected version.

### Step 3: Implement Following Documented Patterns

Write code that matches what the documentation shows:

- Use the API signatures from the docs, not from memory
- If the docs show a new way to do something, use the new way
- If the docs deprecate a pattern, don't use the deprecated version
- If the docs don't cover something, flag it as unverified

**When docs conflict with existing project code:**

```
CONFLICT DETECTED:
The existing codebase uses useState for form loading state,
but React 19 docs recommend useActionState for this pattern.
(Source: react.dev/reference/react/useActionState)

Options:
A) Use the modern pattern (useActionState) — consistent with current docs
B) Match existing code (useState) — consistent with codebase
→ Which approach do you prefer?
```

Surface the conflict. Don't silently pick one.

### Step 4: Cite Your Sources

Every framework-specific pattern gets a citation. The user must be able to verify every decision.

**In code comments:**

```typescript
// React 19 form handling with useActionState
// Source: https://react.dev/reference/react/useActionState#usage
const [state, formAction, isPending] = useActionState(submitOrder, initialState);
```

**In conversation:**

```
I'm using useActionState instead of manual useState for the
form submission state. React 19 replaced the manual
isPending/setIsPending pattern with this hook.

Source: https://react.dev/blog/2024/12/05/react-19#actions
"useTransition now supports async functions [...] to handle
pending states automatically"
```

**Citation rules:**

- Full URLs, not shortened
- Prefer deep links with anchors where possible (e.g. `/useActionState#usage` over `/useActionState`) — anchors survive doc restructuring better than top-level pages
- Quote the relevant passage when it supports a non-obvious decision
- Include browser/runtime support data when recommending platform features
- If you cannot find documentation for a pattern, say so explicitly:

```
UNVERIFIED: I could not find official documentation for this
pattern. This is based on training data and may be outdated.
Verify before using in production.
```

Honesty about what you couldn't verify is more valuable than false confidence.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'm confident about this API" | Confidence is not evidence. Training data contains outdated patterns that look correct but break against current versions. Verify. |
| "Fetching docs wastes tokens" | Hallucinating an API wastes more. The user debugs for an hour, then discovers the function signature changed. One fetch prevents hours of rework. |
| "The docs won't have what I need" | If the docs don't cover it, that's valuable information — the pattern may not be officially recommended. |
| "I'll just mention it might be outdated" | A disclaimer doesn't help. Either verify and cite, or clearly flag it as unverified. Hedging is the worst option. |
| "This is a simple task, no need to check" | Simple tasks with wrong patterns become templates. The user copies your deprecated form handler into ten components before discovering the modern approach exists. |

## Red Flags

- Writing framework-specific code without checking the docs for that version
- Using "I believe" or "I think" about an API instead of citing the source
- Implementing a pattern without knowing which version it applies to
- Citing Stack Overflow or blog posts instead of official documentation
- Using deprecated APIs because they appear in training data
- Not reading `package.json` / dependency files before implementing
- Delivering code without source citations for framework-specific decisions
- Fetching an entire docs site when only one page is relevant

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | source-driven 主入口；负责版本识别、文档抓取顺序、实现与引用闭环 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；核心方法已完整写在 `SKILL.md` 中 |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在来源验证方法与引用纪律，不在脚本层 |
| `templates/` | forbidden | runtime | 当前输出形状稳定，不需要模板目录 |

## Verification

After implementing with source-driven development:

- [ ] Framework and library versions were identified from the dependency file
- [ ] Official documentation was fetched for framework-specific patterns
- [ ] All sources are official documentation, not blog posts or training data
- [ ] Code follows the patterns shown in the current version's documentation
- [ ] Non-trivial decisions include source citations with full URLs
- [ ] No deprecated APIs are used (checked against migration guides)
- [ ] Conflicts between docs and existing code were surfaced to the user
- [ ] Anything that could not be verified is explicitly flagged as unverified
