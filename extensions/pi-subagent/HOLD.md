# HOLD: pi-subagent

当前 `pi-subagent` 被暂时移出 `extensions/`，原因不是功能本身失效，而是它在当前仓库结构下仍依赖未迁入的新路径外部模块：

```ts
../../lib/passto-agent-runtime/index.ts
```

## 当前状态
- `~/.pi` runtime 已成功切换到 `~/dev/pi` 作为第一批稳定资源源
- 为避免阻塞整体迁移验证，`pi-subagent` 暂时放入 `_hold/`
- `pi-subagent` 不应在未补齐依赖前重新移回 `extensions/`

## 缺失依赖
当前主要缺少：
- `passto-agent-runtime`
- 相关 `lib/` 目录及其边界设计

## 后续处理建议
可选方向：

### 方案 A：把 `passto-agent-runtime` 也迁入同仓
优点：实现直接
缺点：会把资源仓与 runtime 增强层再次耦合

### 方案 B：为 `pi-subagent` 改造成可注入 runtime 根路径
优点：解耦更好
缺点：改造成本较高

### 方案 C：将 `passto-agent-runtime` 独立成单独仓库或 package
优点：长期结构最清晰
缺点：本次迁移阶段不适合立即做

## 恢复条件
在以下条件满足前，不建议恢复加载：
- 明确 `passto-agent-runtime` 的最终归属
- 去掉对旧目录结构的隐式依赖
- 确认 `index.ts` 中 import 能在新仓结构下解析
