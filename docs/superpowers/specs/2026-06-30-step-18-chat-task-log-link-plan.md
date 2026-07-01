# Step 18: 聊天任务 ID 联动流程日志

## 目标

让聊天回复里的上下文摘要不只是展示任务 ID，而是可以点击任务 ID，直接把底部流程日志切换到对应任务。

## 小步骤

1. 将 App 里的 `focusTaskSession` 传入 `AgentPanel`。
2. 将 `ChatContextSummaryView` 中的任务 ID 改成可点击按钮。
3. 点击任务 ID 后：
   - 调用 `listTaskSteps(taskSessionId)`。
   - 底部流程日志切到对应任务。
   - 日志区域自动保持半高显示。
4. 兼容处理：
   - 旧消息没有 `contextSummary` 时不显示按钮。
   - 没有任务 ID 时不显示可点击状态。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：发送聊天后点击任务 ID，底部日志切到该任务。

## 非目标

- 不新增任务详情页面。
- 不做日志高亮定位到某一步。
- 不改变任务日志数据库结构。
