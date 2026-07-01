# Step 57: 发布记录删除和复制链接

## 目标

让发布记录历史可以清理误记或重复记录，并快速复制发布 URL。删除只影响本地发布记录，不会删除外部网站或公众号内容。

## 小步骤

1. 后端新增 `delete_publishing_record` 命令。
2. 前端 `backend.ts` 新增 `deletePublishingRecord`，浏览器 fallback 同步支持。
3. `PublishingRecordsPanel` 增加：
   - 复制 URL 按钮
   - 删除记录按钮
4. 删除前使用确认弹窗。
5. 删除后刷新发布记录列表。
6. 复制成功后显示短提示。
7. 新增 Rust 测试覆盖发布记录删除。
8. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：发布记录历史可见复制和删除入口，无 console error。

## 非目标

- 不删除外部平台内容。
- 不删除发布草稿。
- 不编辑发布记录。
- 不新增批量操作。
