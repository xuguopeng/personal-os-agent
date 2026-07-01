# Step 82: 发布前清单复制

## 目标

发布前清单已经可以下载，本步增加一键复制 Markdown 清单，方便贴到备忘、聊天或发布协作流程中。

## 小步骤

1. 增加 `copyPublishingChecklist`。
2. 复用 `formatPublishingChecklistMarkdown`。
3. 草稿卡片增加“复制清单”按钮。
4. 成功后显示“已复制发布清单”提示。
5. 失败时复用复制失败提示。
6. 不写入数据库，不写入流程日志。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页可见复制清单按钮且无 console error。

## 非目标

- 不真实发布外部平台。
- 不调用 AI、MCP 或 Skill。
- 不改变清单内容格式。
