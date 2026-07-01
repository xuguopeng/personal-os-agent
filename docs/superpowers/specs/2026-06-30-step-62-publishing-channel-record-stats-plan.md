# Step 62: 发布渠道记录统计

## 目标

让发布渠道配置和发布记录联动。每个渠道卡片展示该渠道已有多少条发布记录，以及最近一次发布时间，方便判断网站、公众号或自定义渠道是否正在使用。

## 小步骤

1. `PublishingChannelsPanel` 接收 `publishingRecords`。
2. 渠道卡片计算：
   - 该渠道发布记录数量
   - 最近发布时间
3. 优先使用 `channelId` 匹配记录。
4. 老记录没有 `channelId` 时，使用 `channelType` 兜底匹配。
5. 在渠道卡片上展示统计徽标。
6. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：发布渠道卡片可见统计，无 console error。

## 非目标

- 不新增数据库字段。
- 不新增后端接口。
- 不修改发布记录。
- 不真实发布外部平台。
