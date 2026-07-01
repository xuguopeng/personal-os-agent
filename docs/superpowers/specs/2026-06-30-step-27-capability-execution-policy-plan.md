# Step 27: 能力执行策略

## 目标

给每个 MCP / Skill 增加执行策略，提前区分只读能力、普通工作流和危险操作。后续真正调用能力时，Agent 可以根据策略决定是否自动执行、是否进入确认门。

## 小步骤

1. 数据字段：
   - `riskLevel`: `low`、`medium`、`high`
   - `confirmPolicy`: `always`、`when_risky`、`never`
2. 数据库兼容：
   - 新建库直接包含新字段。
   - 已有库初始化时自动补列。
   - 旧能力默认 `medium + when_risky`。
3. 设置页：
   - 新增能力时可以选择风险等级和确认策略。
   - 能力列表展示策略徽标。
   - Palmier 模板默认高风险、总是确认。
4. 聊天任务：
   - 选择能力后，流程日志显示能力策略。
   - 确认步骤根据命中的能力策略提示是否需要确认。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：新增带策略的 Skill，聊天命中后日志和上下文正常，无 console error。

## 非目标

- 不执行真实 MCP / Skill。
- 不做自动发布、剪辑、导出。
- 不引入权限弹窗，只先把策略保存和展示打通。
