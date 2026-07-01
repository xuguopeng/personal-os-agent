# Step 19: 流程日志历史任务列表

## 目标

底部流程日志不只显示当前任务，还能显示最近任务列表，支持点击任意任务回看它的完整步骤。

## 小步骤

1. 后端新增 `list_task_sessions`：
   - 按 `updated_at`、`created_at` 倒序返回最近任务。
   - 默认返回 30 条，最多 100 条。
2. 前端 backend 封装：
   - Tauri 环境调用真实命令。
   - 浏览器预览从 `localStorage` fallback 读取。
3. App 状态：
   - 增加 `taskSessions` 和 `activeTaskSessionId`。
   - 创建任务、聚焦任务、刷新日志时同步任务列表。
4. 底部流程日志 UI：
   - 左侧显示最近任务列表。
   - 右侧显示当前任务步骤。
   - 点击任务后切换步骤，并保持日志半高展开。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：发送多条聊天后，底部任务列表可切换不同任务日志。

## 非目标

- 不删除历史任务。
- 不做任务搜索。
- 不做任务步骤高亮定位。
