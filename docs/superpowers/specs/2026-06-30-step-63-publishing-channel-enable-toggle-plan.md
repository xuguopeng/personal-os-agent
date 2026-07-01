# Step 63: 发布渠道启用和停用

## 目标

让发布渠道可以本地启用或停用。停用渠道不会删除配置、密钥状态或发布历史，只表示当前不作为推荐可用渠道。

## 小步骤

1. `PublishingChannelsPanel` 增加启用状态展示。
2. 渠道卡片增加启用/停用按钮。
3. 切换时复用已有 `savePublishingChannel`。
4. 保留发布记录统计、密钥状态和删除按钮。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：设置页发布渠道可见启用状态，无 console error。

## 非目标

- 不删除渠道。
- 不删除密钥。
- 不删除发布记录。
- 不改变真实外部平台状态。
