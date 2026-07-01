# Step 72: 发布草稿 frontmatter 友好展示

## 目标

草稿正文会保存发布渠道 frontmatter，但列表预览不应该直接显示 `---` 元数据块。本步把 frontmatter 解析为 UI 标签，正文预览只显示真正 Markdown 内容。

## 小步骤

1. 增加 `parsePublishingDraftContent`，识别 `---` frontmatter。
2. 支持解析 `publish_channel`、`publish_channel_type`、`publish_account`、`category`、`tags`。
3. 草稿列表卡片显示发布渠道、分类、标签小标签。
4. 草稿列表正文预览使用去掉 frontmatter 后的正文。
5. 草稿展开预览也使用去掉 frontmatter 后的正文。
6. 复制、下载、编辑仍使用原始 Markdown，避免丢失元数据。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页无 console error。

## 非目标

- 不修改数据库结构。
- 不重写已有草稿内容。
- 不把密钥写入 frontmatter。
