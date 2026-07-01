# Step 45: 发布草稿桥接

## 目标

把任务日志 Markdown 预览内容保存为本地发布草稿记录。第一版只保存草稿，不真实发布到网站或公众号。

## 小步骤

1. 新增 `publishing_drafts` SQLite 表。
2. 新增 Tauri 命令：
   - `create_publishing_draft`
   - `list_publishing_drafts`
3. 前端 backend 增加 `PublishingDraft` 类型和浏览器 fallback。
4. Markdown 预览层增加渠道类型选择：
   - 个人网站
   - 微信公众号
   - 自定义渠道
5. Markdown 预览层增加“保存发布草稿”按钮。
6. 保存草稿后追加一条任务步骤：
   - stepType: `publishing_draft`
   - toolName: `ui.publishing.draft`
7. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：保存发布草稿按钮可见，无 console error。

## 非目标

- 不真实发布到外部平台。
- 不保存密钥、token、cookie。
- 不做草稿编辑页。
- 不做发布历史详情页。
