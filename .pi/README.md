# pi CLI 配置参考

本目录包含 pi CLI 的配置模板。实际配置应复制到 `~/.pi/settings.json`。

## Skills 配置

Skills 目录已统一纳入工作区 `skills/`，通过 `~/.pi/settings.json` 指定路径。

当前配置:
```json
{
  "skills": [
    "/Users/handy/dev/passto-ai/skills"
  ]
}
```

## 本地生效

```bash
cp .pi/settings.json ~/.pi/settings.json
```
