# 视频/播客

> **last_verified: 2025-04**

YouTube、B站、播客的字幕和转录。

## YouTube (yt-dlp)

### 获取视频元数据

```bash
yt-dlp --dump-json "URL"
```

### 下载字幕

```bash
# 下载字幕 (不下载视频)
yt-dlp --write-sub --write-auto-sub --sub-lang "zh-Hans,zh,en" --skip-download -o "/tmp/%(id)s" "URL"

# 然后读取 .vtt 文件
cat /tmp/VIDEO_ID.*.vtt
```

### 获取评论

```bash
# 提取评论（best-effort，不保证完整）
yt-dlp --write-comments --skip-download --write-info-json \
  --extractor-args "youtube:max_comments=20" \
  -o "/tmp/%(id)s" "URL"
# 评论在 .info.json 的 comments 字段中
```

### 搜索视频

```bash
yt-dlp --dump-json "ytsearch5:query"
```

> **字幕注意**: 手动上传的字幕提取可靠；自动生成字幕可能存在行间重复，需后处理。
> **评论注意**: `--write-comments` 基于网页抓取（非 YouTube Data API），部分评论可能丢失。

## B站 / Bilibili (yt-dlp)

> B站视频的字幕/元数据见本页面；搜索/热门/评论见 [social.md](social.md)。

### 视频元数据

```bash
yt-dlp --dump-json "https://www.bilibili.com/video/BVxxx"
```

### 字幕

```bash
yt-dlp --write-sub --write-auto-sub --sub-lang "zh-Hans,zh,en" --convert-subs vtt --skip-download -o "/tmp/%(id)s" "URL"
```

> **412 风控**: 海外 IP 必须提供 Cookie（`--cookies-from-browser chrome`），国内 IP 一般不受影响。

## 小宇宙播客 / Xiaoyuzhou Podcast

### 转录单集播客

```bash
# 输出 Markdown 文件到 /tmp/
~/.agent-reach/tools/xiaoyuzhou/transcribe.sh "https://www.xiaoyuzhoufm.com/episode/EPISODE_ID"
```

### 前置要求

1. **ffmpeg**: `brew install ffmpeg`
2. **Groq API Key** (免费): https://console.groq.com/keys
3. **配置 Key**: `agent-reach configure groq-key YOUR_KEY`
4. **首次运行**: `agent-reach install --env=auto` 安装工具

### 检查状态

```bash
agent-reach doctor
```

> 输出 Markdown 文件默认保存到 `/tmp/`。

## 选择指南

| 场景 | 推荐工具 |
|-----|---------|
| YouTube 字幕 | yt-dlp |
| YouTube 视频信息 | yt-dlp |
| B站字幕/元数据 | yt-dlp |
| 播客转录 | 小宇宙 transcribe.sh |
| 抖音视频解析 | douyin MCP（见 [social.md](social.md#抖音--douyin)）|

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器，含 Fallback 降级链 |
| [references/social.md](social.md) | B站搜索/热门/评论、抖音视频解析 |
