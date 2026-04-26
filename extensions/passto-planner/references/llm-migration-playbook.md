# LLM Migration Playbook Referral

本扩展应直接参考以下方法论：

1. 先将目标视为一个黑盒，从它的输入和输出分析目标系统本质
2. 从最终产出物倒推输入与节点
3. 分别设计输入方案、输出方案、运行时状态方案
4. 组合方案后回表核对，确认用户输入和最终输出完整一致

如果未完成以上四步，禁止直接生成最终 plan。

如需更详细方法，请读取：
- `../../llm-migration-playbook/index.md`
- `../../llm-migration-playbook/01-analyze-target-system.md`
- `../../llm-migration-playbook/02-design-in-pi.md`
- `../../llm-migration-playbook/03-synthesize-and-verify.md`
