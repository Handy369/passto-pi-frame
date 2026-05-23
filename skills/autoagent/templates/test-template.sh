#!/bin/bash
set -e

# {{TASK_NAME}} 验证脚本
# 
# 检查输出是否满足要求

{{VERIFICATION_LOGIC}}

# 写入结果
echo "{{REWARD}}" > /logs/verifier/reward.txt
