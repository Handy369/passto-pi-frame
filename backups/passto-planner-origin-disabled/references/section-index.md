# Section Index Creation

**任务**：基于 `passto-plan.md` 的深度分析，设计实施分段。
**输入**：`<planning_dir>/passto-plan.md`
**输出**：`<planning_dir>/sections/index.md`

## 1. 核心设计原则 (必须严格执行)
在划分每个 Section 时，**必须**逐一审查以下四个维度，确保该分段在运行时是闭环的：

1.  **输入 (Inputs)**：该分段需要什么前置数据、用户输入或中间态？
2.  **输出 (Outputs)**：该分段结束时应产出什么文件、数据状态或持久化结果？
3.  **运行时依赖 (Runtime Env)**：该分段是否依赖特定的环境变量、配置或外部服务？
4.  **界面映射 (UI/Interaction)**：该分段的运行状态或结果是否需要通过**界面组件**呈现？是否需要触发**用户交互界面**？

## 2. SECTION_MANIFEST (机器解析)
文件**必须**以 HTML 注释开头。Section 数量由**项目实际复杂度**决定，**严禁**照抄示例，也**禁止**只生成通用的 "foundation" 等占位符。

```markdown
<!-- SECTION_MANIFEST
section-01-<根据业务逻辑命名>
section-02-<根据业务逻辑命名>
... (复杂项目可多达 10+ 个分段)
END_MANIFEST -->
```

## 3. 人类可读索引 (必须中文)
Manifest 之后，必须用**中文**为每个 Section 编写**四维契约**摘要：

### 示例结构：

```markdown
### section-01-数据库迁移设计
- **职责**: 定义 Schema 迁移脚本及回滚策略。
- **Input**: 现有的 `schema.sql` 及业务需求文档。
- **Output**: 生成的 `migration_*.sql` 文件。
- **Env/Deps**: 需要 `DATABASE_URL` 环境变量及 CLI 工具。
- **UI/Interaction**: 在设置面板提供“执行迁移”按钮，运行期间显示进度条组件。

### section-02-认证中间件开发
...
```

**注意：**
- **不要**把“环境配置”单独写成一个 section，除非它是一个独立运行的服务。
- **必须**在每个 section 的描述中显式回答上述四个维度的问题。
- 确保 section 之间没有循环依赖，依赖图清晰。
