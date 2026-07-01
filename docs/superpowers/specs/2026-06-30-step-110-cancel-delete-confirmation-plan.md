# Step 110：聊天取消删除待确认项

## 目标

当用户已经生成“删除草稿”的待确认项，但后来不想删除时，可以通过聊天取消这个待确认项。取消不会删除草稿，只会关闭对应的删除确认门和删除计划。

## 小计划

1. 新增聊天意图识别：
   - `取消删除《标题》草稿`
   - `撤销删除《标题》草稿`
   - `不要删除《标题》草稿`
2. 选择目标草稿沿用现有标题匹配逻辑。
3. 关闭同一草稿对应的 pending 步骤：
   - `local.delete_confirmation_gate`
   - `agent.blog.draft.delete.plan`
4. 新增一条 `publishing_draft_delete_cancel` 日志，说明草稿保留。
5. 回复中明确说明“已取消删除确认，草稿仍保留”。

## 验证

- `CI=true pnpm build`
- `cargo check`
- `cargo test`
- 浏览器验证：
  - 普通删除草稿后出现待确认项。
  - 输入取消删除后待确认摘要变为 0 项。
  - 搜索该草稿仍能命中。
  - console error 为空。
