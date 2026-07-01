# Step 79: 博客发布准备总览

## 目标

博客模块顶部除了显示草稿总数、待发布和渠道数量，还要显示发布准备情况：多少草稿已经可发布、多少草稿还需要补充、多少渠道配置完整。

## 小步骤

1. 增加 `getBlogPublishingOverview`。
2. 统计草稿总数、待发布状态草稿数、可发布草稿数、待补充草稿数、渠道总数、配置完整渠道数。
3. 博客模块顶部状态卡从 3 个扩展为 6 个。
4. 可发布草稿复用 `getPublishingDraftReadiness`。
5. 配置完整渠道复用 `getPublishingChannelReadiness`。
6. 不写入数据库，不写入流程日志。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页可见总览且无 console error。

## 非目标

- 不真实发布外部平台。
- 不调用 AI 或 MCP。
- 不改变草稿或渠道数据结构。
