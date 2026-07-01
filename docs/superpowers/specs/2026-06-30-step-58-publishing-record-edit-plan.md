# Step 58: 发布记录编辑

## 目标

让已经保存的发布记录可以本地编辑，用于修正 URL、状态、发布时间或备注。编辑只更新本地记录，不会修改外部网站、公众号或自定义渠道上的内容。

## 小步骤

1. 后端新增 `update_publishing_record` 命令。
2. 前端 `backend.ts` 新增 `updatePublishingRecord`，浏览器 fallback 同步支持。
3. `PublishingRecordsPanel` 增加编辑入口。
4. 编辑字段：
   - URL
   - 状态
   - 发布时间
   - 备注
5. 保存后刷新发布记录历史。
6. 取消编辑不写入数据。
7. 新增 Rust 测试覆盖发布记录更新。
8. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：发布记录历史可见编辑入口，无 console error。

## 非目标

- 不修改外部平台内容。
- 不修改关联草稿。
- 不修改发布渠道配置。
- 不做版本历史。
