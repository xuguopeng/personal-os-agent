# Step 54: 手动发布记录

## 目标

让博客草稿可以记录“已经手动发布到某个渠道”的结果，包括渠道、URL、备注和状态。第一版只做记录，不调用网站、微信公众号或自定义渠道 API。

## 小步骤

1. 新增 `publishing_records` SQLite 表。
2. 后端新增命令：
   - `create_publishing_record`
   - `list_publishing_records`
3. 前端 `backend.ts` 新增类型和 fallback：
   - `PublishingRecord`
   - `createPublishingRecord`
   - `listPublishingRecords`
4. App 增加 `publishingRecords` 状态，并在启动时刷新。
5. `PublishingDraftsPanel` 增加“记录发布”入口。
6. 记录发布表单字段：
   - 发布渠道
   - 发布 URL
   - 状态
   - 备注
7. 保存记录后：
   - 写入 `publishing_records`
   - 将对应草稿状态更新为 `published`
   - 刷新草稿和发布记录
8. 草稿卡片展示最近发布记录。
9. 新增 Rust 测试覆盖发布记录写入和读取。
10. 验证：
    - `CI=true pnpm build`
    - `cargo check`
    - `cargo test`
    - 浏览器检查：博客模块可见“记录发布”入口和发布记录摘要，无 console error。

## 非目标

- 不真实发布到外部平台。
- 不调用公众号、网站或自定义 API。
- 不做自动重试。
- 不做批量发布。
