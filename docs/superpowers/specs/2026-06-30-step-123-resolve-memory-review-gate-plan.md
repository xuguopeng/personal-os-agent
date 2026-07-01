# Step 123：聊天审核后关闭记忆确认门

## 目标

当用户通过聊天执行 `@记忆 批准候选 N` 或 `@记忆 拒绝候选 N` 后，自动关闭之前创建候选时留下的 `local.memory_review_gate` 待确认步骤。这样底部流程日志和待确认数量不会继续显示已经处理过的记忆候选。

## 小步骤

1. 新增记忆候选确认门关闭 helper。
2. 按候选内容匹配 pending 的 `local.memory_review_gate` 步骤。
3. 批准候选后把匹配步骤标记为 `success`。
4. 拒绝候选后把匹配步骤标记为 `completed`。
5. 构建、Rust 检查、浏览器验证。

## 验证

- `CI=true pnpm build`
- `cargo check`
- `cargo test`
- 浏览器验证：
  - 先通过聊天创建记忆候选。
  - 再输入 `@记忆 批准候选 1`。
  - 旧的 `local.memory_review_gate` 不再保持 pending。
  - 页面控制台没有应用错误。
