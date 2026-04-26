# Analysis Protocol

本阶段的目标是把目标系统抽象成：

```text
用户输入 -> 运行时节点 + 当前节点加载输入 -> 输出 -> 下一节点输入 -> ... -> 最终产出物
```

## 必须产出
- 用户输入清单
- 环境变量 / 配置 / 依赖输入清单
- 中间态输入输出清单
- 最终产出物清单
- 运行时节点表
- 不可简化节点清单

## 分析方法
1. 先由 LLM 判断 target nature（不要依赖硬编码类型规则）
2. 先列最终产出物
3. 从最终产出物倒推运行时节点与输入来源
4. 抽取所有显式输入与隐式输入
5. 标记不可简化节点
6. 写入 `analysis.md`

## 产品模式

产品模式不是由目标类型硬编码决定，而是：
- 由 LLM 基于目标材料先判断
- 再允许客户显式选择

当前只允许两种模式：
- **独立产品**
- **PI 生态产品**

要求：
- 不要写死“某类输入一定进入某种模式”
- 如果目标材料不足以唯一判断，应向用户确认产品模式
- 如果用户已明确选择模式，以用户选择为准

## 目标类型建议读取顺序

### 本地路径
优先读取：
- `README*`
- `SKILL.md`
- `package.json`
- `*.sh`
- `docs/`
- 配置文件

### URL
优先读取：
- URL 指向的主文档
- 其索引页 / README
- 相关 linked docs（如明显存在）

## 输出格式建议

`analysis.md` 至少包含：
- # Target Overview
- # User Inputs
- # Env / Config / Dependencies
- # Runtime Nodes
- # Intermediate Inputs and Outputs
- # Final Artifacts
- # Non-negotiable Contracts

参考：
- `../../llm-migration-playbook/01-analyze-target-system.md`
- `pi-capabilities.md`（仅在 product mode = PI 生态产品，或明确依赖 PI 时使用）
