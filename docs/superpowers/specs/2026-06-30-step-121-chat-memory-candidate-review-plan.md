# Step 121：聊天审核记忆候选

## 目标

让 `@记忆` 支持通过聊天明确批准或拒绝待确认候选。用户输入 `@记忆 批准候选 1` 或 `@记忆 拒绝候选 1` 时，Agent 会按当前 pending 候选列表顺序处理对应候选，并写入底部流程日志。

## 小步骤

1. 新增候选审核意图识别：
   - 识别 `@记忆`、`@长期记忆`。
   - 识别 `批准`、`确认`、`通过`、`写入` 为 approve。
   - 识别 `拒绝`、`删除候选`、`不要`、`忽略` 为 reject。
   - 提取候选序号，默认从 pending 候选列表的第 1 条开始。
2. 聊天执行时创建 `memory` 任务 session。
3. 使用 `listMemoryCandidates("pending")` 定位候选。
4. 调用现有 `approveMemoryCandidate` 或 `rejectMemoryCandidate`。
5. 写入流程日志：
   - `intent`
   - `memory_review`
   - `memory_create` 或 `memory_reject`
6. 刷新记忆候选、长期记忆和统计。
7. 构建、Rust 检查、浏览器验证。

## 验证

- `CI=true pnpm build`
- `cargo check`
- `cargo test`
- 浏览器验证：
  - 先用聊天创建一条待确认记忆。
  - 输入 `@记忆 批准候选 1` 后，聊天回复显示已批准。
  - 底部流程日志出现 `memory.approve_candidate`。
  - 页面控制台没有应用错误。
