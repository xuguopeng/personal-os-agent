# Step 24: 任务调用链分组

## 目标

把底部流程日志从单纯的步骤网格，升级为可以按调用链理解的视图。用户需要清楚看到一次聊天任务里 Agent 做了什么、是否调用 MCP、是否使用 Skill、读写了哪些模块数据。

## 小步骤

1. 使用现有 `TaskStep` 数据，不改数据库：
   - `stepType`
   - `toolName`
   - `module`
   - `status`
   - `inputSummary`
   - `outputSummary`
   - `error`
2. 前端分组规则：
   - Agent：意图识别、上下文检索、模型调用、确认门。
   - MCP：`toolName` 包含 `.mcp.` 或以 `mcp.` 开头。
   - Skill/工具：`local.*`、`internal.*`、后续 `skill.*`。
   - 模块数据：`memory.*`、`knowledge.*`、`chat.*`、`ui.*`。
3. 底部流程日志 UI：
   - 右侧步骤区增加调用链总览。
   - 步骤按分组显示，每组展示数量和状态统计。
   - 每个步骤保留第 23 步的展开详情。
4. 兼容策略：
   - 未命中规则的步骤归到 Agent。
   - 空分组不显示。
   - 分组只影响展示，不影响任务顺序和真实日志数据。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：流程日志显示分组，步骤可继续展开/收起，无 console error。

## 非目标

- 不新增后端字段。
- 不改变任务步骤写入逻辑。
- 不实现真实 MCP/Skill 执行。
