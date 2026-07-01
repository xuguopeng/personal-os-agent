# Step 81: 发布前清单导出

## 目标

在不真实自动发布的前提下，为单篇草稿生成一份 Markdown 发布前清单，方便人工发布到个人网站、微信公众号或自定义渠道。

## 小步骤

1. 增加 `downloadPublishingChecklist`。
2. 增加 `formatPublishingChecklistMarkdown`。
3. 清单包含草稿标题、状态、目标渠道、endpoint、认证方式、密钥状态、草稿检查项、渠道检查项和人工发布步骤。
4. 清单包含正文预览，但不包含密钥明文。
5. 草稿卡片增加“发布清单”按钮。
6. 文件名使用草稿标题和短 ID。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页可见发布清单按钮且无 console error。

## 非目标

- 不真实发布外部平台。
- 不调用 AI、MCP 或 Skill。
- 不写入数据库或流程日志。
