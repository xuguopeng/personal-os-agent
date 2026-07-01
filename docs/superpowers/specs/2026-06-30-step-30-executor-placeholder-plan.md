# Step 30: 执行器占位层

## 目标

确认卡片点击“允许执行”后，不再只记录确认结果，而是额外生成一条执行计划日志。执行计划只描述将要调用的 MCP / Skill、模块和参数，不真实执行外部命令。

## 小步骤

1. 确认通过后追加 `execution_plan` task step。
2. 执行计划内容：
   - `dryRun=true`
   - task session id
   - module
   - capability names
   - source=`chat_confirmation_card`
3. 流程日志：
   - 新增 `execution_plan` 标签。
   - 展开详情可以看到输入和输出摘要。
4. 安全边界：
   - 不调用 MCP。
   - 不运行 Skill。
   - 不发布、导出、剪辑或付费生成。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：高风险 Skill 命中后点击“允许执行”，底部日志出现执行计划，无 console error。

## 非目标

- 不实现真实执行器。
- 不做执行队列。
- 不做执行结果回写。
