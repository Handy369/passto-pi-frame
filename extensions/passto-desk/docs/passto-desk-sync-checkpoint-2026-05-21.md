# passto-desk sync checkpoint

日期：2026-05-21
状态：active
目的：记录 passto-desk 在本轮收口后的真相源、注册路径、runtime surface 与验证入口，避免后续再次出现 skill / docs / scripts / extension surface 漂移。

---

## 1. 当前真相源

### Skill 真相源
当前 passto-desk 的 skill 真相源位于：

```text
/Users/handy/dev/passto-ai/extensions/passto-desk/skills/passto-desk
```

该目录包含：
- `SKILL.md`
- `references/*`
- `validation/*`

### Agent 实际使用入口
agent 实际使用的目录位于：

```text
/Users/handy/.pi/agent/skills/passto-desk
```

当前它不是独立副本，而是一个软链接，指向：

```text
/Users/handy/dev/passto-ai/extensions/passto-desk/skills/passto-desk
```

这意味着：
- repo 内 skill 目录是维护主入口
- `.pi` 目录不再单独演化
- 后续修改应优先在 repo 内 skill 目录完成

---

## 2. 当前注册路径

`package.json` 当前使用：

```json
"pi": {
  "extensions": ["./index.ts"],
  "skills": ["./skills/passto-desk/SKILL.md"]
}
```

说明：
- extension surface 来自 `index.ts`
- skill surface 来自 `skills/passto-desk/SKILL.md`
- 不再使用项目根下的 `./SKILL.md`

---

## 3. 当前 runtime surface 约定

### 主工具
- `passto_desk`

### 常用 action
- `create_room`
- `bind_room`
- `unbind_room`
- `read_scene`
- `export_scene_json`
- `export_domain_json`
- `append_elements`
- `import_scene_json`
- `import_domain_json`
- `paste_clipboard_payload`
- `save`

### 当前默认主路径
对于 agent 主导的结构更新，默认优先：

```text
export_domain_json
-> 修改 passto-desk-domain-json/v3
-> import_domain_json
```

不要默认：
- 直接手拼 Excalidraw elements
- 把 scene 当作唯一主状态
- 把 append 当作默认更新路径

### replace / append 语义
当前已通过真实 smoke 与 runtime surface 对齐：

- `import_scene_json` = replace
- `import_domain_json` = replace
- `append_elements` = append
- `paste_clipboard_payload` = append

### persistence verify 语义
`verifyPersistence` 的正确策略是：
- 原 session 负责写入
- fresh verification session 负责重新打开 room 做读回复核

不再采用：
- 同 session 立刻 reload 后直接判断

---

## 4. 当前 runtime contract 落点

当前最小 runtime contract helper 位于：

```text
scripts/runtime-contracts.mjs
```

关键 helper：
- `buildSharedStateSnapshot(...)`
- `mergeSharedStateSnapshot(...)`
- `buildValidationResult(...)`
- `buildNextRoundDecision(...)`
- `commitTransformResult(...)`

当前最小 contract 结构：
- `SharedSemanticState`
- `TransformOutput`
- `ValidationResult`
- `NextRoundDecision`

### 双向 transform 脚本
- `scripts/excalidraw-to-domain-json.mjs`
- `scripts/domain-json-to-excalidraw.mjs`

说明：
- reverse transform：scene -> domain
- forward transform：domain -> scene
- 当前最小 runtime 闭环最终统一经过 `commitTransformResult(...)`

---

## 5. 当前验证入口

### A. runtime minimal regression
标准入口：

```bash
cd /Users/handy/dev/passto-ai/extensions/passto-desk
npm run runtime:smoke
```

它会顺序执行：
- `runtime:smoke:merge`
- `runtime:smoke:commit`
- `runtime:smoke:reverse`
- `runtime:smoke:forward`

作用：
- 验证 shared state merge
- 验证 `commitTransformResult(...)`
- 验证 reverse transform
- 验证 forward transform

### B. shared room export/import smoke
入口：

```bash
cd /Users/handy/dev/passto-ai
./extensions/passto-desk/scripts/smoke-export-import.sh
```

作用：
- 验证真实 shared room 上的 export/import 闭环
- 验证 replace / append 语义
- 验证 fresh-session persistence verify 策略

---

## 6. 本轮已对齐的层

本轮收口后，以下层已完成对齐：

- skill 真相源目录
- `.pi` 到 repo 的软链接
- `package.json` skill 注册路径
- `SKILL.md`
- `references/runtime-surface.md`
- `references/runtime-control-loop.md`
- `validation/export-import-smoke.md`
- `scripts/runtime-contracts.mjs`
- forward / reverse transform scripts
- `index.ts` tool description / prompt surface

---

## 7. 后续维护规则

后续如果继续修改 passto-desk，应遵守：

1. **先改 repo 内 skill 真相源**，不要先改 `.pi` 目录副本
2. 如果 runtime contract 变了，至少同步更新：
   - `SKILL.md`
   - `references/runtime-surface.md`
   - `references/runtime-control-loop.md`
   - `validation/export-import-smoke.md`
   - `index.ts` 的 tool description / promptGuidelines
3. 如果 replace / append / verifyPersistence 语义变化，必须同步更新 docs、skill 和 smoke 文档
4. 如果新增新的主验证入口，必须明确它属于：
   - runtime minimal regression
   - 还是 real shared room smoke

---

## 8. 一句话总结

> 当前 passto-desk 的 repo 内 `skills/passto-desk` 是唯一 skill 真相源，`.pi` 入口通过软链接跟随；结构更新默认走 `export_domain_json -> 修改 v3 -> import_domain_json`，最小 runtime 闭环由 `scripts/runtime-contracts.mjs` 与 `npm run runtime:smoke` 负责证明。
