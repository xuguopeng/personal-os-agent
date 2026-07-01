# Step 36: 执行队列状态流转

## 目标

让执行队列项可以在 UI 中手动流转状态。真实 MCP / Skill 执行器接入前，先把状态模型和日志闭环打通。

## 小步骤

1. 将现有“取消”能力扩展为通用状态变更：
   - pending
   - running
   - completed
   - cancelled
   - error
2. 执行队列列表项增加状态选择器。
3. 状态变更后刷新执行队列。
4. 如果队列项有关联任务，追加一条任务步骤：
   - stepType: `execution_queue_status`
   - toolName: `ui.execution_queue.status`
   - inputSummary: 原状态到新状态
   - outputSummary: 手动状态变更说明
5. 如果当前底部日志正在查看关联任务，同步刷新日志步骤。
6. 统计区补充 completed 数量。
7. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：状态选择器可见，设置页无 console error。

## 非目标

- 不执行真实 MCP / Skill。
- 不新增重试队列。
- 不新增后端命令，继续复用已有 `update_execution_queue_item_status`。
