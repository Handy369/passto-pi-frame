# TMUX 命令参考手册

> 完整的 tmux CLI 命令速查表，适用于 tmux 3.x+

---

## 1. 会话管理 (Session)

### 列出所有会话
```bash
tmux ls                    # 列出所有 tmux 会话
tmux list-sessions         # 同上
```

### 创建会话
```bash
tmux new                   # 创建新会话（自动命名）
tmux new -s <name>         # 创建并命名会话
tmux new -d                # 创建并分离（后台运行）
tmux new -s <name> -d      # 创建命名会话并分离
tmux new -c <directory>     # 在指定目录创建
tmux new -s <name> -c /path # 命名且指定目录
```

### 附加/切换会话
```bash
tmux attach                # 附加到最后一个会话
tmux attach -t <name>      # 附加到指定会话
tmux a -t <name>           # 简写
tmux switch-client -t <name>  # 切换到指定会话（保留当前位置）
```

### 分离会话
```bash
tmux detach               # 从当前会话分离 (prefix+d)
```

### 删除会话
```bash
tmux kill-session          # 关闭当前会话
tmux kill-session -t <name>  # 关闭指定会话
tmux kill-session -a       # 关闭除当前外的所有会话
tmux kill-server           # 关闭 tmux 服务器（所有会话）
```

### 重命名会话
```bash
tmux rename-session -t <old> <new>  # 重命名会话
tmux rename -t <old> <new>          # 简写
```

### 会话信息
```bash
tmux display-message -p '#{session_name}'  # 显示当前会话名
tmux show-options -g              # 显示全局选项
tmux show-options -t <session>    # 显示会话选项
```

---

## 2. 窗口管理 (Window)

tmux 的窗口等同于 terminal tab。

### 列出窗口
```bash
tmux list-windows           # 列出当前会话所有窗口
tmux list-windows -a         # 列出所有会话的窗口
```

### 创建窗口
```bash
tmux new-window              # 创建新窗口
tmux new-window -n <name>     # 创建并命名
tmux new-window -t <session>   # 在指定会话创建
tmux new-window -a            # 在当前窗口后创建
```

### 切换窗口
```bash
tmux select-window -t <name-or-num>  # 切换到指定窗口
tmux select-window -t :0             # 切换到窗口 0
tmux next-window                      # 下一窗口
tmux previous-window                  # 上一窗口
tmux last-window                      # 上次窗口
```

### 重命名窗口
```bash
tmux rename-window <name>    # 重命名当前窗口
tmux rename-window -t <id> <name>  # 重命名指定窗口
```

### 关闭窗口
```bash
tmux kill-window            # 关闭当前窗口
tmux kill-window -t <id>     # 关闭指定窗口
tmux kill-window -a          # 关闭所有窗口
```

### 窗口布局
```bash
tmux select-layout           # 切换布局
tmux select-layout -t <id> <layout>  # 指定窗口应用布局
```

---

## 3. 面板管理 (Pane)

tmux 的面板是窗口内的分割区域。

### 分割面板
```bash
tmux split-window                # 水平分割（上下）
tmux split-window -v              # 同上
tmux split-window -h              # 垂直分割（左右）
tmux split-window -c <directory>  # 在指定目录分割
tmux split-window -b              # 在当前面板下方分割
tmux split-window -l <size>       # 指定大小（行数或列数）
```

### 切换面板
```bash
tmux select-pane -U           # 上
tmux select-pane -D           # 下
tmux select-pane -L           # 左
tmux select-pane -R           # 右
tmux select-pane -l            # 上次面板
tmux select-pane -t <id>       # 选择指定面板
```

### 面板导航快捷键 (tmux 内)
```
prefix + Up/Down/Left/Right    # 切换面板
prefix + o                      # 按顺序切换
prefix + ;                      # 上次使用的面板
prefix + q                      # 显示面板编号
prefix + z                      # 放大/缩小当前面板
```

### 调整面板大小
```bash
tmux resize-pane -U <n>         # 向上扩大 n 格
tmux resize-pane -D <n>         # 向下
tmux resize-pane -L <n>         # 向左
tmux resize-pane -R <n>         # 向右
tmux resize-pane -t <id> -x <width> -y <height>  # 指定尺寸
tmux resize-pane -Z             # 最大化/恢复当前面板
```

### 关闭面板
```bash
tmux kill-pane              # 关闭当前面板
tmux kill-pane -t <id>      # 关闭指定面板
```

### 交换面板
```bash
tmux swap-pane -U            # 与上方面板交换
tmux swap-pane -D            # 与下方面板交换
tmux swap-pane -s <src> -t <dst>  # 交换指定两个面板
```

### 显示面板信息
```bash
tmux list-panes              # 列出当前窗口所有面板
tmux list-panes -s           # 列出指定窗口所有面板
tmux display-panes           # 显示面板编号（短暂）
tmux show-panes              # 显示面板配置
tmux show-options -p          # 当前面板选项
```

---

## 4. 发送命令到面板

### 发送按键
```bash
tmux send-keys "text" C-m        # 发送文字并回车
tmux send-keys "text" Enter       # 同上
tmux send-keys "ls" C-m           # 发送 ls 命令

# 特殊键
tmux send-keys C-c                # Ctrl+C (中断)
tmux send-keys C-d                # Ctrl+D (EOF)
tmux send-keys C-z                # Ctrl+Z (挂起)
tmux send-keys M-x                # Alt+x
tmux send-keys F1                 # 功能键
tmux send-keys Tab                # Tab 键
tmux send-keys Up                 # 上箭头
tmux send-keys "string"           # 发送字符串

# 组合键
tmux send-keys "C-b" "d"          # 发送 prefix+d (detach)
```

### 发送选择内容
```bash
tmux send-keys -t <id> "command" C-m  # 指定面板发送命令
```

### 清空面板内容
```bash
tmux send-keys -t <id> C-l             # 发送 Ctrl+L (清屏)
```

---

## 5. 布局预设

```bash
tmux select-layout even-vertical      # 垂直均匀分布
tmux select-layout even-horizontal     # 水平均匀分布
tmux select-layout main-horizontal     # 主面板在上
tmux select-layout main-vertical       # 主面板在左
tmux select-layout tiled               # 拼贴布局
tmux select-layout -t <id> <layout>    # 指定窗口应用布局
```

---

## 6. 复制模式 (Copy Mode)

### 进入复制模式
```bash
tmux copy-mode               # 进入复制模式
tmux copy-mode -u            # 向上滚动一页
tmux send-keys -t <id> PageUp  # 同上
```

### 复制模式快捷键 (tmux 内)
```
prefix + [                    # 进入复制模式
prefix + ]                    # 粘贴
q                              # 退出复制模式
Space                          # 开始选择
Enter                          # 复制选择
v                              # 字符选择模式
V                              # 行选择模式
C-b                            # 向前翻页
C-f                            # 向后翻页
/                              # 向下搜索
?                              # 向上搜索
n                              # 下一个匹配
N                              # 上一个匹配
```

### 保存历史输出
```bash
tmux capture-pane -t <id> -p > file.txt   # 捕获面板内容到文件
tmux capture-pane -t <id> -p | less       # 查看历史
tmux capture-pane -t <id> -S -100         # 捕获前100行
```

---

## 7. 常用组合操作示例

### 创建开发环境
```bash
# 创建一个前端开发会话
tmux new -s dev -d
tmux new-window -n editor -t dev
tmux split-window -h -t dev:editor
tmux split-window -v -t dev:editor
tmux send-keys -t dev:editor "vim" C-m
tmux send-keys -t dev:editor.right "npm run dev" C-m
tmux attach -t dev
```

### 批量发送命令
```bash
# 在所有面板执行同一命令
tmux list-panes -F "#{pane_id}" | xargs -I{} tmux send-keys -t {} "echo done" C-m
```

### 多会话管理
```bash
# 创建工作会话并分离
tmux new -s work -d -c ~/projects
tmux new-window -n server -t work
tmux new-window -n db -t work
tmux send-keys -t work:server "cd ~/projects && npm start" C-m
tmux send-keys -t work:db "mysql -u root" C-m

# 稍后附加
tmux attach -t work
```

---

## 8. tmux 选项速查

### 全局设置
```bash
tmux set -g mouse on              # 启用鼠标（滚动、选择面板）
tmux set -g mouse off             # 禁用鼠标
tmux set -g prefix C-a            # 改 prefix 为 Ctrl+a
tmux set -g base-index 1          # 窗口从 1 开始编号
tmux set -g pane-base-index 1     # 面板从 1 开始编号
tmux set -g history-limit 50000   # 历史记录上限
tmux set -g default-terminal "screen-256color"  # 256色支持
```

---

## 9. 特殊变量/占位符

| 变量 | 说明 |
|------|------|
| `#S` | 会话名 |
| `#W` | 窗口名 |
| `#P` | 面板编号 |
| `#T` | 面板标题 |
| `#{session_name}` | 完整变量形式 |
| `#{pane_id}` | 面板 ID（如 `%1`） |
| `#{window_index}` | 窗口索引 |

### 使用示例
```bash
tmux display-message "当前会话: #S, 窗口: #W, 面板: #P"
```

---

## 10. 常用快捷键 (tmux 内)

| 快捷键 | 功能 |
|--------|------|
| `prefix d` | 分离会话 |
| `prefix c` | 创建新窗口 |
| `prefix ,` | 重命名窗口 |
| `prefix &` | 关闭窗口 |
| `prefix %` | 垂直分割 |
| `prefix "` | 水平分割 |
| `prefix x` | 关闭面板 |
| `prefix z` | 最大化/恢复面板 |
| `prefix space` | 切换布局 |
| `prefix ?` | 显示所有快捷键 |
| `prefix :` | 进入命令模式 |
