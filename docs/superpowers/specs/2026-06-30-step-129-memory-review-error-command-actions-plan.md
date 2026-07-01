# Step 129：记忆审核错误日志提供命令操作

## 目标

当 `@记忆 批准候选《内容片段》` 命中多条候选并被阻止时，流程日志里的 `memory.review_candidate` error 步骤要能直接提供“填入聊天”和“复制命令”按钮。用户可以从错误日志里继续操作，不需要手动复制长文本。

## 小步骤

1. 让 `TaskStepCard` 接收 `onFillChat`。
2. 从 `memory.review_candidate` error 的 `outputSummary` 中提取 `@记忆 批准候选《...》` / `@记忆 拒绝候选《...》` 命令。
3. 在错误步骤卡片中显示命令操作区：
   - 填入聊天
   - 复制命令
4. 保持普通步骤卡片不受影响。
5. 构建、Rust 检查、浏览器验证。

## 验证

- `CI=true pnpm build`
- `cargo check`
- `cargo test`
- 浏览器验证：
  - 创建两条包含同一片段的候选。
  - 输入模糊审核命令触发 error。
  - 日志 error 卡片显示精确命令按钮。
  - 点击“填入”能把命令放入聊天输入框。
  - 页面控制台没有应用错误。
