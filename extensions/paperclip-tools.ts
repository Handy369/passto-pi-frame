/**
 * Paperclip Tools Extension
 *
 * 提供 Paperclip 确定性工具集
 * 用于 Agent 签发 Issue、状态更新、工作流执行等
 * 
 * 使用方式:
 *   /paperclip-issue-checkout <issue-id> <agent-id>
 *   /paperclip-issue-status <issue-id> <new-status>
 *   /paperclip-workflow <workflow-name> <parent-issue-id>
 *   /paperclip-agent-health [--company] [--auto-recover]
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

// Paperclip API 配置
const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100/api";
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY || "";

// Agent ID 映射
const AGENT_MAP: Record<string, string> = {
    "backend": "c000bb72-8632-44a3-a53f-49c3b5bf4fbd",
    "frontend": "c9ee98b6-51e4-4571-936f-c037ac5e715f",
    "qa": "71ac9024-2811-4bc7-9af5-736396156a1c",
    "devops": "03e518c4-fbfc-45b9-a1a6-a341222a77a6",
    "architect": "ef588807-1088-4ef0-8b56-8893454f0464",
    "founding": "26b84317-966a-448c-826c-3be9d22039d0",
    "product": "560cd386-ebc1-422b-be90-8e5c2a16153c",
};

const COMPANY_ID = "dcf2e544-2b82-4c43-9c41-b82ecbb333b9";

// Issue 状态机
const STATE_MACHINE: Record<string, string[]> = {
    "backlog": ["todo", "cancelled"],
    "todo": ["in_progress", "cancelled"],
    "in_progress": ["in_review", "blocked", "cancelled"],
    "blocked": ["in_progress", "todo", "cancelled"],
    "in_review": ["done", "in_progress", "blocked", "cancelled"],
    "done": [],
    "cancelled": []
};

// API 辅助函数
async function apiGet(path: string): Promise<unknown> {
    const response = await fetch(`${PAPERCLIP_API_URL}${path}`, {
        headers: {
            "Authorization": `Bearer ${PAPERCLIP_API_KEY}`,
            "Content-Type": "application/json"
        }
    });
    return response.json();
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${PAPERCLIP_API_URL}${path}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${PAPERCLIP_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    return response.json();
}

async function apiPatch(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${PAPERCLIP_API_URL}${path}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${PAPERCLIP_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    return response.json();
}

function jsonGet(data: unknown, key: string): string {
    if (!data || typeof data !== "object") return "";
    const obj = data as Record<string, unknown>;
    return String(obj[key] || "");
}

function canTransition(current: string, target: string): boolean {
    const allowed = STATE_MACHINE[current] || [];
    return allowed.includes(target);
}

export default function (pi: ExtensionAPI) {
    // ============ issue:checkout ============
    pi.registerCommand("paperclip-issue-checkout", {
        description: "签发 Issue 给 Agent (确定性操作)",
        args: {
            issueId: Type.String({ description: "Issue ID" }),
            agentId: Type.String({ description: "Agent ID 或别名 (backend/qa/devops)" }),
            force: Type.Optional(Type.Boolean({ description: "强制重新签发" }))
        },
        handler: async (args) => {
            let agentId = args.agentId;
            
            // 解析别名
            if (AGENT_MAP[agentId]) {
                agentId = AGENT_MAP[agentId];
            }
            
            // 获取 Issue 详情
            const issue = await apiGet(`/issues/${args.issueId}`) as Record<string, unknown>;
            const currentAssignee = jsonGet(issue, "assigneeAgentId");
            const currentStatus = jsonGet(issue, "status");
            
            if (currentAssignee === agentId && !args.force) {
                return `✅ Issue 已分配给该 Agent，无需更新`;
            }
            
            // 确定新状态
            let newStatus = currentStatus;
            if (currentStatus === "backlog") {
                newStatus = "todo";
            }
            
            // 执行更新
            await apiPatch(`/issues/${args.issueId}`, {
                assigneeAgentId: agentId,
                status: newStatus
            });
            
            // 唤醒 Agent
            await apiPost(`/agents/${agentId}/wakeup`, { source: "delegation" });
            
            // 添加评论
            await apiPost(`/issues/${args.issueId}/comments`, {
                body: `## 签发\n\n- 分配给: ${agentId}\n- 状态: ${newStatus}`
            });
            
            return `✅ Issue 已签发给 Agent ${agentId}`;
        }
    });

    // ============ issue:status ============
    pi.registerCommand("paperclip-issue-status", {
        description: "更新 Issue 状态 (带状态机校验)",
        args: {
            issueId: Type.String({ description: "Issue ID" }),
            newStatus: Type.String({ description: "新状态 (todo/in_progress/in_review/blocked/done/cancelled)" }),
            reason: Type.Optional(Type.String({ description: "变更原因" }))
        },
        handler: async (args) => {
            const issue = await apiGet(`/issues/${args.issueId}`) as Record<string, unknown>;
            const currentStatus = jsonGet(issue, "status");
            
            // 状态机校验
            if (!canTransition(currentStatus, args.newStatus)) {
                return `❌ 状态转换非法: ${currentStatus} → ${args.newStatus}\n允许: ${STATE_MACHINE[currentStatus]?.join(", ") || "无"}`;
            }
            
            // 执行更新
            await apiPatch(`/issues/${args.issueId}`, {
                status: args.newStatus
            });
            
            // 添加评论
            await apiPost(`/issues/${args.issueId}/comments`, {
                body: `## 状态变更\n\n- 从: ${currentStatus}\n- 到: ${args.newStatus}\n- 原因: ${args.reason || "自动变更"}\n- 时间: ${new Date().toISOString()}`
            });
            
            return `✅ 状态已更新: ${currentStatus} → ${args.newStatus}`;
        }
    });

    // ============ workflow:execute ============
    pi.registerCommand("paperclip-workflow", {
        description: "执行确定性工作流",
        args: {
            workflow: Type.String({ description: "工作流名称 (bug_fix/feature/deploy)" }),
            parentIssue: Type.String({ description: "父 Issue ID" })
        },
        handler: async (args) => {
            // 工作流模板
            const workflows: Record<string, Array<{ title: string; agentKey: string; priority: string }>> = {
                "bug_fix": [
                    { title: "[修复] Bug", agentKey: "backend", priority: "high" },
                    { title: "[QA] 验证修复", agentKey: "qa", priority: "high" },
                    { title: "[Deploy] 部署上线", agentKey: "devops", priority: "high" }
                ],
                "feature": [
                    { title: "[开发] 功能实现", agentKey: "backend", priority: "high" },
                    { title: "[QA] 功能测试", agentKey: "qa", priority: "high" },
                    { title: "[Deploy] 部署上线", agentKey: "devops", priority: "high" }
                ],
                "deploy": [
                    { title: "[Deploy] 部署", agentKey: "devops", priority: "high" }
                ]
            };
            
            const tasks = workflows[args.workflow];
            if (!tasks) {
                return `❌ 未知工作流: ${args.workflow}\n可用: ${Object.keys(workflows).join(", ")}`;
            }
            
            const parent = await apiGet(`/issues/${args.parentIssue}`) as Record<string, unknown>;
            const parentTitle = jsonGet(parent, "title") as string;
            const parentStatus = jsonGet(parent, "status") as string;
            
            // 创建子任务
            const created: string[] = [];
            for (const task of tasks) {
                const agentId = AGENT_MAP[task.agentKey];
                const issueTitle = `[${task.title.toUpperCase()}] ${parentTitle.slice(0, 40)}`;
                
                const newIssue = await apiPost(`/companies/${COMPANY_ID}/issues`, {
                    title: issueTitle,
                    status: "todo",
                    assigneeAgentId: agentId,
                    parentId: args.parentIssue,
                    priority: task.priority
                }) as Record<string, unknown>;
                
                const newId = jsonGet(newIssue, "identifier");
                created.push(newId);
                
                // 唤醒 Agent
                await apiPost(`/agents/${agentId}/wakeup`, {});
            }
            
            // 更新父 Issue 状态
            if (parentStatus === "todo" || parentStatus === "backlog") {
                await apiPatch(`/issues/${args.parentIssue}`, { status: "in_progress" });
            }
            
            return `✅ 工作流执行完成\n\n工作流: ${args.workflow}\n创建子任务: ${created.join(", ")}`;
        }
    });

    // ============ agent:health ============
    pi.registerCommand("paperclip-agent-health", {
        description: "Agent 健康检查 + 自动恢复",
        args: {
            autoRecover: Type.Optional(Type.Boolean({ description: "自动恢复 error 状态的 Agent" }))
        },
        handler: async (args) => {
            const agents = await apiGet(`/companies/${COMPANY_ID}/agents`) as Array<Record<string, unknown>>;
            
            let errorCount = 0;
            let recoveredCount = 0;
            
            for (const agent of agents) {
                const id = jsonGet(agent, "id") as string;
                const name = jsonGet(agent, "name") as string;
                const status = jsonGet(agent, "status") as string;
                
                if (status === "error" && args.autoRecover) {
                    // 自动恢复
                    await apiPost(`/agents/${id}/pause`, { reason: "health-check" });
                    await new Promise(r => setTimeout(r, 1000));
                    const resumeResult = await apiPost(`/agents/${id}/resume`, {}) as Record<string, unknown>;
                    const newStatus = jsonGet(resumeResult, "status");
                    
                    if (newStatus === "idle" || newStatus === "running") {
                        recoveredCount++;
                    }
                }
                
                if (status === "error") {
                    errorCount++;
                }
            }
            
            if (args.autoRecover) {
                return `✅ 健康检查完成\n\nError: ${errorCount} | 已恢复: ${recoveredCount}`;
            }
            
            return `Agent 状态:\n${agents.map(a => `- ${jsonGet(a, "name")}: ${jsonGet(a, "status")}`).join("\n")}`;
        }
    });
}
