# Step 68: 发布渠道变更写入流程日志

## 目标

发布渠道的新增、编辑、启停、删除都写入底部流程日志，让“发布相关配置是谁改的、改了什么、什么时候改的”可以被追踪。

## 小步骤

1. `PublishingChannelsPanel` 接收 `onTaskSessionFocus`。
2. 新增 `recordPublishingChannelStep`，统一创建博客模块任务会话并追加步骤。
3. 新建渠道成功后写入 `publishing_channel_create`。
4. 编辑渠道成功后写入 `publishing_channel_update`。
5. 启用/停用渠道成功后写入 `publishing_channel_enable` 或 `publishing_channel_disable`。
6. 删除渠道成功后写入 `publishing_channel_delete`。
7. 写入后聚焦对应任务，让底部日志立即显示这次操作。
8. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查渠道编辑入口与 console。

## 非目标

- 不恢复已删除渠道。
- 不写入密钥明文。
- 不真实调用外部发布接口。
