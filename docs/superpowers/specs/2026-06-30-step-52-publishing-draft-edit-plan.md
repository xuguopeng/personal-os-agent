# Step 52: 发布草稿本地编辑

## 目标

让博客模块里的发布草稿可以在本地编辑标题、目标渠道、状态和 Markdown 正文。第一版仍然只保存本地草稿，不真实发布到网站或公众号。

## 小步骤

1. 后端新增 `update_publishing_draft` 命令。
2. 前端 `backend.ts` 新增 `updatePublishingDraft`，浏览器 fallback 同步支持。
3. 发布草稿列表增加编辑态。
4. 编辑态字段：
   - 标题
   - 渠道类型
   - 状态
   - Markdown 正文
5. 保存后刷新草稿列表，并退出编辑态。
6. 取消编辑时恢复只读展示，不写入数据库。
7. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：博客模块草稿可编辑、保存后列表展示新标题，无 console error。

## 非目标

- 不真实发布外部平台。
- 不新增富文本编辑器。
- 不实现草稿删除。
- 不引入版本历史。
