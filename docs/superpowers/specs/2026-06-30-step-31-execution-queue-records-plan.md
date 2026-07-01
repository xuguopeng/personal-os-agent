# Step 31: 执行队列记录

## 目标

把 dry-run 执行计划保存成结构化队列项。第一版仍不执行 MCP / Skill，只记录计划、状态和来源，让后续真实执行器可以基于队列做查看、取消、重试和状态流转。

## 小步骤

1. 后端新增 `execution_queue` 表。
2. 新增命令：
   - `create_execution_queue_item`
   - `list_execution_queue_items`
   - `update_execution_queue_item_status`
3. 前端 fallback 同步支持队列。
4. 确认卡片点击“允许执行”：
   - 创建 dry-run 队列项。
   - 继续写 `execution_plan` 流程日志。
5. 设置页展示最近执行队列：
   - 显示模块、状态、dry-run、来源、计划摘要。
   - 支持取消 `pending` 队列项。
6. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：允许执行后设置页出现 dry-run 队列项，可取消，无 console error。

## 非目标

- 不执行真实外部命令。
- 不做后台 worker。
- 不做重试调度。
