# Step 114：点击待确认徽标展开并筛选日志

## 目标

流程日志标题栏已经能显示 `待确认 N`。这一小步让徽标可点击：点击后自动展开底部日志，并显示待确认相关步骤，方便用户快速处理确认项。

## 小计划

1. 在 App 顶层保存流程日志的待确认筛选触发器。
2. 点击标题栏 `待确认 N`：
   - 设置日志为 expanded。
   - 触发 ProcessLog 搜索 `local.delete_confirmation_gate`。
3. ProcessLog 监听触发器：
   - 切换到全部步骤。
   - 搜索待确认步骤。
   - 开启自动展开。
4. 不改变真实执行逻辑，也不自动确认或取消。

## 验证

- `CI=true pnpm build`
- `cargo check`
- `cargo test`
- 浏览器验证：
  - 删除草稿计划出现 `待确认 1`。
  - 点击徽标后，底部日志展开，搜索框包含 `local.delete_confirmation_gate`。
  - 待确认卡片仍然可见，console error 为空。
