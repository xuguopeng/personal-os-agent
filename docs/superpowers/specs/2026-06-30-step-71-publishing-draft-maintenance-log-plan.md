# Step 71: 发布草稿维护动作写入流程日志

## 目标

发布草稿创建已经能写入日志，本步补齐后续维护动作：编辑草稿、修改状态、归档/恢复、删除草稿都要在底部流程日志中可见。

## 小步骤

1. `PublishingDraftsPanel` 增加 `recordPublishingDraftStep`。
2. 如果草稿已有 `taskSessionId`，复用原任务；否则创建新的博客模块任务。
3. 修改草稿状态后写入 `publishing_draft_status`。
4. 编辑草稿成功后写入 `publishing_draft_update`。
5. 删除草稿成功后写入 `publishing_draft_delete`。
6. 每次写入后聚焦到底部流程日志。
7. 日志输出包含标题、渠道类型、状态变化、正文长度，不包含密钥或外部账号 token。
8. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页无 console error。

## 非目标

- 不恢复已删除草稿。
- 不修改草稿表结构。
- 不真实发布外部平台。
