# Step 29: 确认选择持久化

## 目标

确认卡片点击后，当前聊天里已经能显示“已选择”，流程日志也已落库。本步把选择结果同步保存到 assistant 消息上下文里，让刷新页面或切换聊天会话后仍能看到已选择状态。

## 小步骤

1. 扩展 `ChatContextSummary`：
   - 新增 `confirmationDecision`。
   - 旧消息解析时默认没有选择。
2. 点击确认按钮后：
   - 继续追加 `confirmation_decision` task step。
   - 更新当前 assistant 消息状态。
   - 使用 `updateChatMessage` 重写该消息的 `modelName` 上下文编码。
3. 历史恢复：
   - `chatRecordToMessage` 从解析后的上下文恢复 `confirmationDecision`。
   - 确认卡片刷新后仍显示“已选择”。
4. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：确认后切换会话或刷新，卡片仍显示已选择，无 console error。

## 非目标

- 不新增数据库表。
- 不执行真实 MCP / Skill。
- 不做多次确认审计去重；后续执行器阶段再加。
