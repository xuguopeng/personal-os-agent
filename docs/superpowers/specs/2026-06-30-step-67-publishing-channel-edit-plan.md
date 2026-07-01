# Step 67: 发布渠道编辑

## 目标

让已保存的发布渠道可以本地编辑名称、类型、账号标识、endpoint、认证方式、默认分类和默认标签。密钥仍然不回显，只能重新粘贴保存。

## 小步骤

1. `PublishingChannelsPanel` 增加渠道编辑态。
2. 编辑字段覆盖渠道名称、渠道类型、认证方式、账号/站点标识、API 地址 / 发布 URL、默认分类、默认标签、可选新密钥。
3. 保存编辑时复用已有 `savePublishingChannel`，保留启停状态和发布策略字段。
4. 如果填写新密钥，则继续用 `saveSecret(publishingSecretKey(channel.id), secret)` 更新安全存储。
5. 取消编辑不写入数据。
6. 保存后刷新渠道列表和统计。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查设置页可见编辑入口且无 console error。

## 非目标

- 不回显旧密钥。
- 不删除发布记录。
- 不真实发布外部平台。
