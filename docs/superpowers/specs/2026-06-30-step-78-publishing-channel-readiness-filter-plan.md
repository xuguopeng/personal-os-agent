# Step 78: 发布渠道配置检查筛选

## 目标

发布渠道已经显示配置检查结果，本步增加筛选能力，让用户快速只看“配置完整”或“待补充”的渠道。

## 小步骤

1. 增加 `PublishingChannelReadinessFilter` 类型。
2. `PublishingChannelsPanel` 增加配置检查筛选状态。
3. 渠道筛选时复用 `getPublishingChannelReadiness`。
4. 筛选项包括：全部配置、配置完整、待补充。
5. UI 在渠道筛选栏增加配置检查下拉。
6. 空状态文案补充配置检查筛选。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查设置页可见配置检查筛选且无 console error。

## 非目标

- 不修改发布渠道数据结构。
- 不写入流程日志。
- 不真实连接外部发布平台。
