# Step 32: 执行队列详情

## 目标

让设置页的执行队列项可以展开查看完整详情，包括完整 dry-run plan JSON、来源、任务 ID、创建/更新时间和执行结果占位。

## 小步骤

1. `ExecutionQueuePanel` 增加展开/收起状态。
2. 每个队列项增加详情按钮。
3. 详情区展示：
   - 完整 `planJson`
   - `source`
   - `taskSessionId`
   - `createdAt` / `updatedAt`
   - dry-run 状态
   - 执行结果占位
4. 如果有关联任务，提供“查看任务日志”按钮。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：执行队列项可展开/收起，可跳转任务日志，无 console error。

## 非目标

- 不新增路由。
- 不执行真实 MCP / Skill。
- 不做执行结果写入。
