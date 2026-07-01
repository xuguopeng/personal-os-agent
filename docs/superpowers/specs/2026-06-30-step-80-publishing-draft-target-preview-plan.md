# Step 80: 发布草稿目标预览

## 目标

单篇草稿展开时显示它将使用的发布目标，包括具体渠道、渠道类型、endpoint、认证方式、密钥状态和渠道配置检查结果。这样草稿检查和渠道检查能在同一个视图里汇合。

## 小步骤

1. 增加 `findPublishingDraftTargetChannel`。
2. 优先通过 frontmatter 的 `publish_channel` 匹配具体渠道。
3. 匹配不到具体渠道时，通过草稿 `channelType` 找已启用渠道，再找同类型任意渠道。
4. 展开草稿时显示“发布目标预览”。
5. 如果匹配到渠道，显示渠道名、endpoint、认证方式、密钥状态、配置检查分数。
6. 如果没有匹配到渠道，显示需要配置发布渠道。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页展开草稿可见目标预览且无 console error。

## 非目标

- 不真实发布外部平台。
- 不检查 endpoint 可达性。
- 不写入数据库或流程日志。
