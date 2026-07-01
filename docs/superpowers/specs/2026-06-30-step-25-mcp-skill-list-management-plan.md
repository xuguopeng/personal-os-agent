# Step 25: MCP / Skill 列表管理

## 目标

让设置页里的 MCP 和 Skill 不再只是概念说明，而是可以作为 Agent 后续调用能力的可管理列表。第一版重点是新增、启用/禁用、删除、分组查看、Palmier MCP 检测状态展示。

## 小步骤

1. 复用现有 `capabilities` 表和命令：
   - `list_capabilities`
   - `save_capability`
   - `delete_capability`
2. 设置页能力面板：
   - 按 MCP 和 Skill 分组展示。
   - 每个能力显示名称、类型、endpoint/command、说明、启用状态、更新时间。
   - 保留新增、启用/禁用、删除。
3. Palmier MCP 检测：
   - 对 Palmier / 19789 / palmier endpoint 的能力显示当前检测状态。
   - 提供一键检测按钮，复用现有 `checkPalmierMcp`。
   - 检测只更新 UI 状态，不写入密钥或真实调用剪辑。
4. 聊天日志衔接：
   - 后续任务步骤继续用 `toolName` 匹配 MCP/Skill 分组。
   - 本步先让设置页的能力列表足够清楚，下一步再把聊天选择能力和列表数据关联。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：设置页能新增 Skill/MCP、启用/禁用、删除，Palmier 检测按钮可用，无 console error。

## 非目标

- 不执行真实 Skill。
- 不调用真实 MCP 工具。
- 不把状态字段写入数据库。
