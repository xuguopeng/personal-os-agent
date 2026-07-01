# Step 23: 任务步骤详情展开

## 目标

让底部流程日志里的每个步骤可以展开查看详细信息。当前步骤卡片只显示摘要，后续调试 Agent、MCP、Skill 调用时，需要能看到输入、输出、错误、工具名、耗时和 token 统计。

## 小步骤

1. 使用现有 `TaskStep` 字段：
   - `inputSummary`
   - `outputSummary`
   - `error`
   - `toolName`
   - `durationMs`
   - `tokenInput`
   - `tokenOutput`
   - `createdAt`
2. 底部流程日志 UI：
   - 步骤卡片增加图标按钮展开/收起。
   - 默认保持紧凑摘要。
   - 展开后显示完整字段。
3. 布局策略：
   - 长文本使用 `whitespace-pre-wrap` 和 `break-words`。
   - 空字段不显示。
   - token/耗时没有值时隐藏。
4. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：点击步骤详情按钮可以展开/收起，长文本不撑坏布局。

## 非目标

- 不改数据库。
- 不新增任务步骤编辑。
- 不做步骤重跑。
