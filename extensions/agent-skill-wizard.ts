import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

interface SkillConfig {
  name: string;
  pattern: "tool_wrapper" | "generator" | "reviewer" | "inversion" | "pipeline";
  description: string;
  tools?: string[];
  outputFormat?: string;
  validationCriteria?: string[];
  steps?: string[];
}

const PATTERN_INFO = {
  tool_wrapper: {
    name: "Tool Wrapper（工具包装）",
    description: "将特定服务或框架的使用规则封装成技能模块，让 AI 代理人在需要时才载入会相关技能。适用于：API 调用、库使用、工具集成等场景。",
    example: `## Skill: FastAPI Conventions

### 使用场景
当您需要生成 FastAPI 端点、模型或处理请求/响应模式时。

### 使用说明
- 始终使用 Pydantic v2 语法定义模型
- 使用 @router 装饰器组织端点
- 包含 response_model 以提供类型提示
- 为所有端点添加文档字符串`,
  },
  generator: {
    name: "Generator（生成器）",
    description: "通过固定的输出结构与模板，解决 AI 代理人产生的文件格式不一致的问题。适用于：代码生成、文档创建、报告产出等场景。",
    example: `## Skill: JSON Schema Generator

### 使用场景
当用户要求根据需求生成 JSON schema 时。

### 输出格式
\`\`\`json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "{title}",
  "type": "object",
  "properties": { ... },
  "required": []
}
\`\`\`

### 使用说明
1. 从用户输入中提取字段名称和类型
2. 确定必填字段
3. 添加适当的验证规则`,
  },
  reviewer: {
    name: "Reviewer（审查者）",
    description: "将「检查什么」与「怎么检查」分开，通过 SKILL.md 定义审查流程，将检查标准独立维护。适用于：代码审查、质量检查、合规验证等场景。",
    example: `## Skill: Code Review

### 检查内容
- 安全漏洞
- 性能问题
- 代码风格一致性
- 错误处理完整性

### 检查方法
1. 扫描硬编码的密钥
2. 检查 N+1 查询模式
3. 验证错误信息是否用户友好
4. 确保适当的日志记录`,
  },
  inversion: {
    name: "Inversion（反转收集）",
    description: "将传统的「用户驱动提示」反转为「AI 先询问用户」。在执行任务前，先通过对话收集必要信息。适用于：复杂任务初始化、需求澄清、多选项决策等场景。",
    example: `## Skill: Project Setup

### 需要询问的问题 (按顺序)
1. 项目名称是什么？
2. 您想使用哪个框架？(React/Vue/Angular)
3. 需要认证功能吗？(是/否)
4. 使用什么样式解决方案？(CSS/Tailwind/Styled)

### 流程
一次只问一个问题。等待用户回答后再继续下一个问题。`,
  },
  pipeline: {
    name: "Pipeline（流水线）",
    description: "通过明确定义工作流程与「放行条件」，来处理复杂且不能跳步骤的任务。适用于：CI/CD、部署流程、数据处理管道等场景。",
    example: `## Skill: Deploy to Production

### 流水线步骤
1. **代码检查** - 运行代码质量检查
   - 通过条件: 无错误
   
2. **测试** - 执行单元和集成测试
   - 通过条件: 所有测试通过
   
3. **构建** - 创建生产版本
   - 通过条件: 构建完成且无错误
   
4. **部署** - 推送到生产环境
   - 通过条件: 部署成功

### 回滚
如果任何步骤失败，自动回滚到上一个版本。`,
  },
};

function generateSkillMd(config: SkillConfig): string {
  const pattern = PATTERN_INFO[config.pattern];
  
  let content = `# ${config.name}

> 由 Agent Skill 向导生成
> 模式: ${pattern.name}
> 描述: ${config.description}

`;

  switch (config.pattern) {
    case "tool_wrapper":
      content += `## 使用场景
${config.tools?.map(t => `- 使用 ${t} 时`).join("\n") || "- 需要封装特定工具/库规范时"}

## 使用说明
${config.description}

### 最佳实践
- 保持说明简洁且可操作
- 包含常见模式的示例
- 定义清晰的输入/输出格式`;
      break;

    case "generator":
      content += `## 使用场景
- ${config.description}

## 输出格式
\`\`\`
${config.outputFormat || "// 您的输出格式在这里"}
\`\`\`

### 生成规则
1. 始终遵循指定的格式
2. 包含必要的元数据
3. 返回前验证输出`;
      break;

    case "reviewer":
      content += `## 检查内容
${(config.validationCriteria || []).map(c => `- ${c}`).join("\n")}

## 检查方法
1. 对照每个标准进行审查
2. 为失败项提供具体反馈
3. 提出改进建议

### 输出格式
\`\`\`
## 审查结果
✅ 通过: [列表]
❌ 失败: [列表及原因]
💡 建议: [列表]
\`\`\``;
      break;

    case "inversion":
      content += `## 目的
${config.description}

### 需要询问的问题 (按顺序)
${(config.steps || []).map((s, i) => `${i + 1}. ${s}`).join("\n")}

### 流程
一次只问一个问题。等待用户回答后再继续下一个问题。
收集所有答案后再生成输出。`;
      break;

    case "pipeline":
      content += `## 流水线概述
${config.description}

### 步骤
${(config.steps || []).map((s, i) => `${i + 1}. ${s}`).join("\n")}

### 通过条件
每个步骤必须通过才能继续下一个。
如果任何步骤失败，停止并报告失败。

### 错误处理
- 记录每个步骤的结果
- 提供清晰的错误信息
- 包含回滚指令（如适用）`;
      break;
  }

  content += `

---

*此技能使用 Google 的 5 大 Agent Skill 设计模式创建*
*了解更多: https://adventofagents.com/agent-skill-design-patterns*
`;

  return content;
}

export default function (pi: ExtensionAPI) {
  // Register the main command
  pi.registerCommand("skill-create", {
    description: "🎯 交互式创建新的 Agent Skill",
    handler: async (_args, ctx) => {
      await ctx.waitForIdle();
      
      ctx.ui.notify("🚀 启动 Agent Skill 向导...", "info");
      
      // Step 1: Select pattern
      const patternOptions = [
        "🔧 Tool Wrapper（工具包装）- 封装工具/库的使用规范",
        "📝 Generator（生成器）- 生成一致的输出格式",
        "🔍 Reviewer（审查者）- 验证和审查输出结果",
        "❓ Inversion（反转收集）- 先询问用户再执行任务",
        "🏭 Pipeline（流水线）- 定义多步骤工作流程",
      ];

      const patternChoice = await ctx.ui.select(
        "请选择最适合您使用场景的设计模式",
        patternOptions
      );
      
      if (!patternChoice) {
        ctx.ui.notify("已取消", "info");
        return;
      }

      let pattern: SkillConfig["pattern"] | undefined;
      if (patternChoice.includes("Tool Wrapper")) pattern = "tool_wrapper";
      else if (patternChoice.includes("Generator")) pattern = "generator";
      else if (patternChoice.includes("Reviewer")) pattern = "reviewer";
      else if (patternChoice.includes("Inversion")) pattern = "inversion";
      else if (patternChoice.includes("Pipeline")) pattern = "pipeline";

      if (!pattern) {
        ctx.ui.notify(`无法识别所选设计模式: ${patternChoice}`, "error");
        return;
      }

      const patternInfo = PATTERN_INFO[pattern];
      if (!patternInfo) {
        ctx.ui.notify(`设计模式配置缺失: ${pattern}`, "error");
        return;
      }
      
      // Step 2: Get skill name
      const name = await ctx.ui.input(
        "技能名称",
        "请输入技能名称 (例如: 'FastAPI 规范', 'JSON Schema 生成器'):"
      );
      
      if (!name) {
        ctx.ui.notify("技能名称是必填项", "error");
        return;
      }

      // Step 3: Get description
      const description = await ctx.ui.input(
        "描述",
        `请描述这个技能的功能（留空将使用默认描述）`
      );
      
      let config: SkillConfig = {
        name,
        pattern: pattern as SkillConfig["pattern"],
        description: description || patternInfo.description,
      };

      // Step 4: Pattern-specific questions
      switch (pattern) {
        case "tool_wrapper": {
          const toolsInput = await ctx.ui.input(
            "工具/库",
            "请输入此技能封装的工具或库 (用逗号分隔，例如: FastAPI, Pydantic)"
          );
          config.tools = toolsInput?.split(",").map(t => t.trim()) || [];
          break;
        }
        
        case "generator": {
          const outputFormat = await ctx.ui.input(
            "输出格式",
            "请输入预期的输出格式 (例如: JSON schema, TypeScript 接口)"
          );
          config.outputFormat = outputFormat || "";
          break;
        }
        
        case "reviewer": {
          const criteriaInput = await ctx.ui.input(
            "验证标准",
            "请输入验证标准 (用逗号分隔，例如: 安全性, 性能, 代码风格)"
          );
          config.validationCriteria = criteriaInput?.split(",").map(c => c.trim()) || [];
          break;
        }
        
        case "inversion": {
          const stepsInput = await ctx.ui.input(
            "需要询问的问题",
            "请输入需要询问用户的问题 (用逗号分隔，例如: 项目名称是什么?, 使用哪个框架?, 需要认证功能吗?)"
          );
          config.steps = stepsInput?.split(",").map(s => s.trim()) || [];
          break;
        }
        
        case "pipeline": {
          const stepsInput = await ctx.ui.input(
            "流水线步骤",
            "请输入流水线步骤 (用逗号分隔，例如: 代码检查, 测试, 构建, 部署)"
          );
          config.steps = stepsInput?.split(",").map(s => s.trim()) || [];
          break;
        }
      }

      // Step 5: Confirm and generate
      const confirmMsg = `
📋 技能摘要:
• 名称: ${config.name}
• 模式: ${patternInfo.name}
• 描述: ${config.description}
${config.tools ? `• 工具: ${config.tools.join(", ")}` : ""}
${config.steps ? `• 步骤: ${config.steps.join(" → ")}` : ""}

生成 SKILL.md 文件?`;

      const confirmed = await ctx.ui.confirm(
        "确认",
        confirmMsg
      );

      if (!confirmed) {
        ctx.ui.notify("已取消", "info");
        return;
      }

      // Generate the skill content
      const skillContent = generateSkillMd(config);
      
      // Show preview
      ctx.ui.notify(`✅ 已为 "${config.name}" 生成 SKILL.md`, "success");
      
      // Display the generated content
      await ctx.ui.editor(
        "SKILL.md 预览",
        skillContent,
        { readonly: false }
      );
    },
  });

  // Register a tool that LLM can call to create skills
  pi.registerTool({
    name: "create_agent_skill",
    label: "创建 Agent Skill",
    description: "使用 Google 的 5 大设计模式与用户交互式创建新的 Agent Skill",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      // Send command as follow-up to trigger interactive wizard
      pi.sendUserMessage("/skill-create", { deliverAs: "followUp" });
      
      return {
        content: [{
          type: "text",
          text: "我已触发 Agent Skill 向导。请根据提示创建您的技能。"
        }],
        details: {},
      };
    },
  });

  // Register a quick-start command for specific patterns
  pi.registerCommand("skill-quick", {
    description: "⚡ 从模板快速创建技能",
    handler: async (args, ctx) => {
      const pattern = args || "tool_wrapper";
      
      if (!PATTERN_INFO[pattern as keyof typeof PATTERN_INFO]) {
        ctx.ui.notify(`未知模式: ${pattern}`, "error");
        return;
      }
      
      const name = await ctx.ui.input(
        "技能名称",
        "请输入技能名称:"
      );
      
      if (!name) return;
      
      const config: SkillConfig = {
        name,
        pattern: pattern as SkillConfig["pattern"],
        description: PATTERN_INFO[pattern as keyof typeof PATTERN_INFO].description,
      };
      
      const content = generateSkillMd(config);
      
      ctx.ui.notify(`✅ 已创建 "${name}"`, "success");
    },
  });

  // Info command
  pi.registerCommand("skill-patterns", {
    description: "📚 显示 5 大 Agent Skill 设计模式",
    handler: async (_args, ctx) => {
      const info = `
🎯 Google Cloud Tech 的 5 大 Agent Skill 设计模式:

1. 🔧 Tool Wrapper（工具包装）
   - 将特定服务或框架的使用规则封装成技能模块
   - 适用：API 调用、库使用、工具集成

2. 📝 Generator（生成器）  
   - 通过固定的输出结构与模板
   - 适用：代码生成、文档创建、报告产出

3. 🔍 Reviewer（审查者）
   - 将「检查什么」与「怎么检查」分开
   - 适用：代码审查、质量检查、合规验证

4. ❓ Inversion（反转收集）
   - AI 先询问用户，收集必要信息后再执行
   - 适用：复杂任务初始化、需求澄清

5. 🏭 Pipeline（流水线）
   - 定义工作流程与放行条件
   - 适用：CI/CD、部署流程、数据处理管道

📖 官方文档: https://adventofagents.com/agent-skill-design-patterns
      `;
      
      ctx.ui.notify(info, "info");
    },
  });

 
}