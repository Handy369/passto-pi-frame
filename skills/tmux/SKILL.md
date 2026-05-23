---
name: tmux
description: 通过自然语言控制 tmux 会话。涵盖会话/窗口/面板管理、实时状态查询、命令发送、布局调整。当用户提及 tmux、会话、窗口、面板、分割、切换时触发。
---

# Agent TMUX — tmux 会话控制技能

> **last_verified: 2026-05-16**

## Top-level Boundary Pack

### current main output
- 对现有 tmux 会话 / 窗口 / 面板的结构化状态说明
- 明确的 tmux 操作结果：创建、切换、分割、发送命令、调整布局、关闭

### current main action
- 查询 tmux 状态
- 创建 / 删除 tmux 会话、窗口、面板
- 切换 / 导航 tmux 会话、窗口、面板
- 向指定 pane 发送命令或特殊键
- 调整 tmux 布局

### should-trigger
当用户当前主目标是以下任一项时，优先进入本 Skill：
- 控制 tmux 会话 / 窗口 / 面板
- 查询 tmux 当前结构、状态、布局或 pane 信息
- 在 tmux pane 中发送命令、启动进程、停止进程
- 用自然语言完成分屏、切换、重命名、附加、分离等 tmux 操作

### should-not-trigger
以下请求不应由本 Skill 接管：
- 普通 shell 命令执行，但不涉及 tmux 会话管理
- 写代码、改代码、调试业务逻辑、跑测试
- 浏览器自动化、网页测试、DevTools 调试
- 只是在问 tmux 概念或配置原理，而不是要做具体会话操作

### adjacent destination
- 普通实现 / 调试 / 测试工作流 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 浏览器自动化 / 页面验证 → `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- 若只是回答通用 tmux 概念且无需具体操作 → 直接简答，不必 adopt 本 Skill

### non-goals
即使命中本 Skill，也不要顺手扩做：
- 把 tmux 操作任务扩成完整开发实施任务
- 因为用户提到终端，就接管与 tmux 无关的 shell 工作
- 在未确认目标 session / window / pane 时直接做破坏性操作

### first action after hit
先判断用户主动作是“查状态 / 改结构 / 发命令”中的哪一类；如涉及切换、删除、发送命令到特定 pane，先列出或确认目标对象，再执行操作。

### positive examples
- “列出当前 tmux 会话和每个窗口的结构。”
  - why should trigger: 主输出物是 tmux 状态查询结果
  - expected adopt signal: 先用 `tmux list-*` 查询，再结构化返回
- “帮我新建一个 dev 会话，分成左右两个 pane，并在右边跑 npm run dev。”
  - why should trigger: 主动作是 tmux 会话搭建与 pane 命令发送
  - expected adopt signal: 先创建会话 / pane，再向目标 pane 发送命令
- “切到 backend 窗口，把当前 pane 停掉。”
  - why should trigger: 主动作是 tmux 导航与 pane 控制
  - expected adopt signal: 先定位目标，再发送对应控制键或命令

### negative examples
- “直接帮我修这个 Node 报错并跑测试。”
  - why should not trigger: 主目标是代码调试与测试，不是 tmux 会话控制
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- “打开这个页面做一轮 UI 测试。”
  - why should not trigger: 主目标是浏览器验证，不是 tmux
  - correct destination: `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- “tmux 和 screen 有什么区别？”
  - why should not trigger: 这是知识问答，不一定需要 adopt 操作型 Skill
  - correct destination: 直接回答即可

## Overview

通过自然语言控制 tmux 会话，包括：
- 会话（Session）管理：创建、切换、分离、删除
- 窗口（Window）管理：新建、切换、重命名、关闭
- 面板（Pane）管理：分割、切换、调整大小、关闭
- 实时信息查询：当前状态、进程、布局
- 复制模式操作：搜索、复制历史输出

## Quick Reference

| 任务 | 命令示例 | 详细文档 |
|------|----------|----------|
| 查看会话列表 | `tmux ls` | → `references/tmux-commands.md` |
| 创建新会话 | `tmux new -s name` | → `references/tmux-commands.md` |
| 切换/附加会话 | `tmux attach -t name` | → `references/tmux-commands.md` |
| 新建窗口 | `tmux new-window -n name` | → `references/tmux-commands.md` |
| 垂直分割面板 | `tmux split-window -h` | → `references/tmux-commands.md` |
| 水平分割面板 | `tmux split-window -v` | → `references/tmux-commands.md` |
| 发送命令到面板 | `tmux send-keys "cmd" C-m` | → `references/tmux-commands.md` |
| 查询当前状态 | `tmux list-*`, `tmux display-message` | → `references/tmux-commands.md` |

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 顶层入口；负责判断是否真的是 tmux 会话控制任务，以及先查状态还是直接执行 |
| `references/` | required | runtime | 保留 tmux CLI 速查材料，支持最小命令查阅 |
| `references/tmux-commands.md` | required | runtime | 承载主要命令速查表；比把全部命令堆进 `SKILL.md` 更窄更稳 |
| `scripts/` | forbidden | runtime | 当前 Skill 不需要脚本层；脚本会让 agent 误以为应优先跑本地辅助程序 |
| `references/tmux-helpers.sh` | forbidden | runtime | 本地辅助脚本未被 runtime 路径使用，且会把 Skill 漂移成脚本工具包 |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |

## 路由决策树

### Q1: 用户想做什么？

- **查询状态**（列出会话/窗口/面板）
  → 直接执行 `tmux list-*` 命令

- **创建/删除**
  - 创建新会话 → `tmux new -s <name>`
  - 创建新窗口 → `tmux new-window -n <name>`
  - 删除会话 → `tmux kill-session -t <name>`
  - 删除窗口 → `tmux kill-window -t <window-id>`

- **切换/导航**
  - 切换会话 → `tmux switch-client -t <session>`
  - 切换窗口 → `tmux select-window -t <window>`
  - 切换面板 → `tmux select-pane -<U|D|L|R>`

- **分割/布局**
  - 垂直分割 → `tmux split-window -h`
  - 水平分割 → `tmux split-window -v`
  - 调整布局 → `tmux select-layout <layout>`

- **发送命令**
  - 在面板中执行命令 → `tmux send-keys "command" C-m`
  - 发送特殊键 → `tmux send-keys C-c` (Ctrl+C)

### Q2: 是否有嵌套/模糊请求？

```
用户: "在底部面板运行 htop"
→ 先确定面板 (tmux list-panes)
→ 再发送命令 (tmux send-keys "htop" C-m)
```

```
用户: "创建一个前端开发环境"
→ 执行一系列命令创建会话、分割面板、安装依赖等
```

## 使用约束

- **执行前先确认**：`tmux` 命令可能有破坏性操作（kill-session、kill-window），执行前先列出当前状态确认目标
- **异步执行**：长时间运行的命令（如编译、安装）建议用 `send-keys` 发送后立即返回
- **会话命名**：优先使用有意义的会话名，避免使用 `-t` 指定数字 ID

## 示例对话流

```
用户: 新建一个叫 dev 的会话
→ tmux new -s dev

用户: 在里面开两个窗口，一个叫 frontend 一个叫 backend
→ tmux new-window -n frontend -t dev
→ tmux new-window -n backend -t dev

用户: frontend 窗口里执行 npm run dev
→ tmux send-keys -t dev:frontend "npm run dev" C-m

用户: 把当前布局改成 even-horizontal
→ tmux select-layout -t dev even-horizontal

用户: 显示当前所有会话和窗口的树状结构
→ 执行 tmux list-sessions + tmux list-windows 输出结构化信息
```
