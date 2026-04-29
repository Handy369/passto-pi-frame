# Environment / Constraints Entry

使用：

```ts
passto_planner_multiselect({
  title: "请确认项目依赖的环境、平台、运行约束或外部前提",
  options: [
    "PI CLI",
    "VS Code extension",
    "GitHub Actions",
    "macOS shell",
    "特定 SDK",
    "私有 API",
    "企业内网环境"
  ],
  allowOther: true,
  otherPrompt: "请输入其他环境、平台、约束或前提；多项请用 | 分隔",
  placeholder: "私有部署 | 数据驻留要求 | 内部鉴权"
})
```

记录到：
- `analysis.md`
- `passto-plan.md`
