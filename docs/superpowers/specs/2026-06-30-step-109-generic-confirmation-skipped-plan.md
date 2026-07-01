# Step 109：无外部能力时通用确认门标记为 skipped

## 目标

清理流程日志里的“假 pending”。当本次任务没有命中需要确认的 MCP、Skill、付费模型、真实发布或真实导出能力时，通用 `local.confirmation_gate` 不应该保持 pending，而应该标记为 `skipped`。

## 小计划

1. 定位通用 `local.confirmation_gate` 的生成逻辑。
2. 保留真实动作确认门：
   - 删除草稿确认仍然是 `local.delete_confirmation_gate` pending。
   - 后续发布、付费生成、导出确认仍然可以 pending。
3. 仅修改通用能力确认门：
   - 有需要确认的能力时：`pending`。
   - 没有需要确认的能力时：`skipped`。
4. 调整输出文案，让日志说明“无需用户确认”。
5. 未命中 MCP/Skill 时，对应 `capability` 步骤也标记为 `skipped`，避免调用链统计残留假 pending。
6. 验证普通博客流程不再残留通用 pending。

## 验证

- `CI=true pnpm build`
- `cargo check`
- `cargo test`
- 浏览器验证：
  - 普通 `@博客` 草稿任务中，`local.confirmation_gate` 为 skipped。
  - 删除草稿计划仍然生成真实待确认项。
  - console error 为空。
