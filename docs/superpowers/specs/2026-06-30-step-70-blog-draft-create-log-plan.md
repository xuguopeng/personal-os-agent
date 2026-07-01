# Step 70: 博客草稿创建写入流程日志

## 目标

在博客模块手动新建草稿时，也要写入底部流程日志。这样用户可以看到草稿是从哪个模块、哪个渠道目标、什么输入创建出来的。

## 小步骤

1. `BlogDraftComposer` 接收 `onTaskSessionFocus`。
2. 保存草稿前创建博客模块任务会话。
3. 创建草稿时带上 `taskSessionId`。
4. 草稿创建成功后追加 `publishing_draft_create` 步骤。
5. 步骤输出包含草稿标题、渠道类型、具体渠道名、分类、标签，但不包含密钥。
6. 写入后聚焦到底部流程日志。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查新建草稿后日志出现 `publishing_draft_create`。

## 非目标

- 不真实发布草稿。
- 不改变草稿表结构。
- 不写入渠道密钥。
