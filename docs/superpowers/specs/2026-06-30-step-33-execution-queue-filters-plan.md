# Step 33: 执行队列筛选和统计

## 目标

让执行队列在项目增多后依然好查。第一版在前端增加状态筛选、模块筛选、dry-run 筛选和顶部统计，不改变数据库和后端命令。

## 小步骤

1. `ExecutionQueuePanel` 增加本地筛选状态：
   - status: 全部、pending、running、completed、cancelled、error
   - module: 全部模块或具体模块
   - dryRun: 全部、只看 dry-run、只看真实执行
2. 顶部增加统计条：
   - 总数
   - pending
   - running
   - cancelled
   - error
   - dry-run
3. 列表展示过滤后的队列项。
4. 过滤后为空时显示清晰空态。
5. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：筛选控件可用，统计显示，无 console error。

## 非目标

- 不新增后端过滤参数。
- 不改变队列保存逻辑。
- 不执行真实 MCP / Skill。
