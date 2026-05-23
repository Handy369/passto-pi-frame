# Passto Desk Export → Modify → Import Smoke

> 目的：用真实 Excalidraw shared room 验证 `export_domain_json -> 修改 -> import_domain_json -> export_domain_json` 闭环是否成立。

## Scope

本 smoke 重点验证两件事：

1. `export_domain_json` 是否能从真实 shared room 稳定读回结构语义
2. `import_scene_json` / `import_domain_json` 是否是 **replace**，而不是 append

不验证：
- agent 路由是否命中 `passto-desk`
- UI 可用性或视觉细节
- 高并发多人协作冲突

## Command

### A. Shared room export/import smoke

```bash
cd /Users/handy/dev/passto-ai
./extensions/passto-desk/scripts/smoke-export-import.sh
```

这条 smoke 依赖真实 Excalidraw shared room，重点验证：
- `export_domain_json`
- `import_domain_json`
- `import_scene_json`
- replace / append 语义

### B. Runtime minimal regression smoke

```bash
cd /Users/handy/dev/passto-ai/extensions/passto-desk
npm run runtime:smoke
```

这条 smoke 不依赖真实 shared room，重点验证：
- `runtime:smoke:merge`
- `runtime:smoke:commit`
- `runtime:smoke:reverse`
- `runtime:smoke:forward`

也就是验证：
- shared state merge helper
- `commitTransformResult(...)`
- forward / reverse transform 的最小 runtime 闭环

## Expected pass signal

至少应同时满足：

- 第一次 export：`nodeCount=2`、`edgeCount=1`
- 修改 label 后再次 import
- 第二次 export：`nodeCount` 不增加、`edgeCount` 不增加
- 第二次 export 中对应 label 已更新
- 脚本最终输出：`SMOKE_OK`

也就是说：
- import 语义必须是 **replace**
- 不能出现“旧图保留 + 新图追加”

## Expected failure signals

以下都应视为失败：

- 第一次 export 读回 `0 nodes / 0 edges`
- 第二次 export 变成 `4 nodes / 2 edges` 之类的翻倍结果
- label 未变，仍然是旧值
- 脚本末尾出现 `LABEL_EDIT_NOT_PERSISTED`
- 脚本末尾出现 `NODE_COUNT_CHANGED` / `EDGE_COUNT_CHANGED`

## Runtime lessons captured from real smoke

### 1. `import_*` 必须是 replace

真实 smoke 已证明：
- `append_elements` / `paste_clipboard_payload` 是 append
- `import_scene_json` / `import_domain_json` 必须是 replace

如果 `import_*` 仍然走 clipboard paste，会导致：
- 第二次导入后节点和边翻倍
- `export -> modify -> import` 闭环失真

### 2. persistence verify 不能用“同 session 立刻 reload”

真实 smoke 已证明：
- 同一个浏览器 session 里 paste 后立刻 reload，可能读到空 scene
- 这会误判成“持久化失败”

因此 `verifyPersistence` 的正确策略应为：
- 原 session 负责写入
- 新 verify session 打开同一 room 做读回复核

验证目标应是：
- **shared room 是否真的持久化**
而不是：
- 当前页面 reload 后瞬时本地状态是否还在

## Current contract summary

- `append_elements` = append
- `paste_clipboard_payload` = append
- `import_scene_json` = replace
- `import_domain_json` = replace

如果未来这四个 action 的语义发生变化，必须同步更新：
- `README.md`
- `references/runtime-surface.md`
- `SKILL.md`
- 本文件
