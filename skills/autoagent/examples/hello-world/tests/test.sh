#!/bin/bash
set -e

# 验证 hello.txt 存在且内容正确
if [ -f /task/hello.txt ]; then
    CONTENT=$(cat /task/hello.txt)
    if [ "$CONTENT" = "Hello, World!" ]; then
        echo "1.0" > /logs/verifier/reward.txt
    else
        echo "Content mismatch: got '$CONTENT'" >&2
        echo "0.0" > /logs/verifier/reward.txt
    fi
else
    echo "File /task/hello.txt not found" >&2
    echo "0.0" > /logs/verifier/reward.txt
fi
