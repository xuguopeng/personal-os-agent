# Step 48: 发布草稿状态流转

## 目标

给本地发布草稿增加状态流转。第一版只改变本地草稿状态，不真实发布外部平台。

## 小步骤

1. 增加发布草稿状态类型：
   - draft
   - ready
   - published
   - archived
2. 新增 Tauri 命令 `update_publishing_draft_status`。
3. 前端 backend 增加 `updatePublishingDraftStatus`。
4. 发布草稿列表项增加状态选择器。
5. 状态更新后刷新草稿列表。
6. 状态文案使用中文展示。
7. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：状态选择器可见，无 console error。

## 非目标

- 不真实发布网站或公众号。
- 不新增发布记录表。
- 不删除草稿。
- 不编辑正文。
