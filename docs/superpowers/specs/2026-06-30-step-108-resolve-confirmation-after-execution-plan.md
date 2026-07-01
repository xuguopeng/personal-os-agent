# Step 108：确认执行后关闭待确认项

## 目标

当用户通过聊天明确确认并执行某个待确认动作后，原来的 `confirmation` 步骤不应该永远保持 pending。第一版聚焦博客草稿删除：确认删除成功后，关闭同一草稿对应的删除确认门。

## 小计划

1. 检查后端是否已有更新 task step 状态的命令。
2. 如果没有，新增 `update_task_step_status`：
   - 只更新 `status`、`output_summary`、`error`。
   - 不改历史输入、工具名和创建时间。
3. 前端新增封装并在确认删除成功后调用：
   - 查找同一草稿标题对应的 `local.delete_confirmation_gate` pending 步骤。
   - 更新为 `success`。
   - 输出写明“已由聊天确认删除执行关闭”。
4. 同步关闭对应的 `publishing_draft_delete_plan` pending 步骤，让调用链统计不再残留旧 pending。
5. 刷新任务步骤列表，让待确认摘要立即消失。
6. 保持普通删除仍然只生成待确认项，不自动关闭。

## 验证

- `CI=true pnpm build`
- `cargo check`
- `cargo test`
- 浏览器验证：
  - 普通删除草稿后出现待确认项。
  - 点击“填入聊天”并发送确认命令。
  - 删除成功后待确认摘要不再显示该项。
  - console error 为空。
