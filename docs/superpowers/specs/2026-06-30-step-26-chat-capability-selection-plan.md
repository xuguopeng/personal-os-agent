# Step 26: 聊天能力选择联动

## 目标

让聊天任务里的“选择 MCP / Skill / 模块能力”不再是写死文本，而是读取设置页已启用的 MCP / Skill 列表，并把选中的能力写入流程日志和聊天上下文。

## 小步骤

1. 复用现有 `capabilities` 状态：
   - 只使用 `enabled = true` 的能力。
   - 不执行真实 MCP / Skill。
   - 不改数据库结构。
2. 新增前端能力选择规则：
   - 视频优先匹配 Palmier、video、剪辑、时间线等 MCP / Skill。
   - 博客匹配 blog、博客、发布、公众号、website。
   - 小说、音乐、漫画/表情包按模块关键词匹配。
   - 无匹配时回退内部模块工具。
3. 流程日志：
   - 每个选中的 MCP / Skill 单独写一条 `capability` 步骤。
   - `toolName` 使用 `mcp.<name>` 或 `skill.<name>`，便于第 24 步调用链分组。
   - 输出摘要展示能力名称和 endpoint/command。
4. 聊天回复和上下文：
   - 本地模拟回复说明本次选中了哪些能力。
   - 聊天消息的上下文摘要增加“能力”一行。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：新增一个测试 Skill 后发送 `@博客`，底部日志显示该 Skill，聊天上下文显示能力，无 console error。

## 非目标

- 不运行真实 Skill。
- 不调用真实 MCP 工具。
- 不做自动付费生成、自动发布或真实剪辑。
