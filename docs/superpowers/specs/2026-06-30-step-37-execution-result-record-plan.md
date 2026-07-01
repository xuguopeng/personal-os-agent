# Step 37: 执行结果记录面板

## 目标

把执行队列详情里的结果占位变成可操作入口。第一版支持手动记录执行结果，为后续真实 MCP / Skill 执行器返回结果铺路。

## 小步骤

1. 执行队列详情增加结果记录表单：
   - 结果类型：成功、失败
   - 输出摘要
   - 错误信息
2. 保存结果后，如果有关联任务，追加任务步骤：
   - stepType: `execution_result`
   - toolName: `ui.execution_queue.result`
   - outputSummary: 用户填写的输出摘要
   - error: 用户填写的错误信息
3. 保存成功结果后将队列状态更新为 `completed`。
4. 保存失败结果后将队列状态更新为 `error`。
5. 保存后刷新执行队列；如果底部日志正在查看关联任务，同步刷新日志步骤。
6. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：结果表单可见，设置页无 console error。

## 非目标

- 不新增执行结果表。
- 不新增后端命令。
- 不接真实 MCP / Skill 返回值。
- 不做附件、文件或视频产物存储。
