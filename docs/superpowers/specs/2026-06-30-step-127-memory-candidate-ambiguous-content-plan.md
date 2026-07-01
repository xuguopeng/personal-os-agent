# Step 127：内容片段命中多条候选时阻止审核

## 目标

让 `@记忆 批准候选《内容片段》` 更安全。如果内容片段同时命中多条 pending 候选，Agent 不再默认处理第一条，而是停止执行并提示用户补充更精确的片段或改用序号。

## 小步骤

1. 扩展候选选择逻辑，返回选择结果：
   - `matched`
   - `not_found`
   - `ambiguous`
2. 内容片段命中 0 条时，保持原有未找到错误。
3. 内容片段命中多条时，写入 `memory.review_candidate` error 日志。
4. 聊天回复说明命中多条，没有修改任何记忆。
5. 构建、Rust 检查、浏览器验证。

## 验证

- `CI=true pnpm build`
- `cargo check`
- `cargo test`
- 浏览器验证：
  - 创建两条包含同一片段的记忆候选。
  - 输入 `@记忆 批准候选《共同片段》`。
  - 聊天回复提示命中多条。
  - 日志出现 `memory.review_candidate` error。
  - 页面控制台没有应用错误。
