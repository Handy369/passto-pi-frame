# Skill Preflight Checklist — workspace-ui-skills benchmark asset set

> **last_verified: 2026-05-15**

## 0. Meta
- owner: pi agent
- date: 2026-05-15
- target skill: workspace-ui-skills benchmark asset set（包含 definition reference 与 implementation 子 skill 的联合验证资产）
- target skill path:
  - /Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md
  - /Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md
  - /Users/handy/.claude/skills/project-definition/validation/workspace-ui-skills-benchmark-run-request.md
  - /Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md
  - /Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md
- related framework card: none
- related benchmark brief:
  - /Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md
  - /Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md

## 1. Packaging shape
- 最终采用的结构: 顶层 skill（`project-definition` / `project-implementation` / `visual-feedback-ui-qa`）+ benchmark assets
- 父目录名:
  - `project-definition/references`
  - `project-implementation/references`
- frontmatter `name`: n/a（本次新增文件均不是新的 `SKILL.md` 顶层 skill）
- `name` 是否与父目录完全一致: n/a
- 文件名是否严格为 `SKILL.md`: n/a
- 是否存在旧路径残留（旧 `.md` / 旧目录 / 大小写变体）: 未发现目标资产的旧版重复文件；旧根目录 run request 已删除

## 2. Frontmatter validity
- `description` 是否存在: n/a（本次目标是 references / benchmark briefs / run request，不是新增顶层 skill）
- `description` 长度: n/a
- `description` 是否 <= 1024: n/a
- `name` 是否满足命名规则（小写、数字、连字符）: n/a
- 是否存在其他明显 frontmatter 缺项或非法字段: 未检查到新增顶层 skill frontmatter 变更；本轮不涉及 `SKILL.md` frontmatter 新增/重写

## 3. Resource layout
- `references/` 是否放在 skill 目录内: yes
- `scripts/` 是否放在 skill 目录内: n/a
- 资源相对路径是否已检查: yes（本轮主要使用绝对路径互链，未发现悬空引用）
- 是否存在跨目录悬空引用: no（回读与检索均能命中目标文件）

## 4. Discovery / conflict check
- 是否存在同名 skill 冲突: no（`visual-feedback-ui-qa` 已作为独立顶层 skill 存在，未发现重复或大小写冲突）
- 是否存在会导致 discoverability 出问题的命名/大小写问题: no（当前文件名一致且大小写稳定）
- 是否存在根目录 stray `.md` 误当 skill 的风险: no
- 是否需要移动到标准目录型结构: no（run request 已迁移到 `project-definition/references/`）

## 5. Evidence
- 回读验证的文件:
  - /Users/handy/.claude/skills/project-definition/SKILL.md
  - /Users/handy/.claude/skills/project-implementation/SKILL.md
  - /Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md
  - /Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md
  - /Users/handy/.claude/skills/project-definition/validation/workspace-ui-skills-benchmark-run-request.md
  - /Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md
  - /Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md
- 使用的检查命令:
  - `python3` 路径存在性检查
  - `rg` 检查关键字、路由、互链、Related 段落
  - `find /Users/handy/.claude/skills -maxdepth 1 -type f -name '*.md'`
- 关键输出:
  - 所有目标文件均存在
  - `project-definition/SKILL.md` 已含 `agent-human-workspace-baseline.md` 路由
  - `project-implementation/SKILL.md` 已含 `visual-feedback-ui-qa` 子 skill 路由
  - 两个 benchmark brief 已更新为新的 run request 路径
  - run request 已迁移到：`/Users/handy/.claude/skills/project-definition/validation/workspace-ui-skills-benchmark-run-request.md`
  - `~/.claude/skills` 根目录下已无裸 `.md`
- 仍未解决的问题:
  - none

## 6. Release gate
- 是否允许进入 benchmark: yes
- 如果不允许，必须先修什么:
  - n/a
- 如果允许，下一步动作:
  - 可直接按 `/Users/handy/.claude/skills/project-definition/validation/workspace-ui-skills-benchmark-run-request.md` 执行 benchmark
