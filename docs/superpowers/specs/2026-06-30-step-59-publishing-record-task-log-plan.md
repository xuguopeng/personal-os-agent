# Step 59: 发布记录写入流程日志

## 目标

让“记录发布”不只是改变草稿状态，还能在底部流程日志里留下可追踪步骤。用户之后可以看到发布渠道、URL、结果状态和备注来源。

## 小步骤

1. 在保存发布记录时确定任务会话：
   - 草稿已有 `taskSessionId` 时复用。
   - 草稿没有 `taskSessionId` 时创建新的博客任务会话。
2. 追加 `publishing_record` 类型任务步骤。
3. 步骤内容包含：
   - 草稿标题
   - 渠道名称
   - 发布 URL
   - 发布状态
   - 备注摘要
4. 保存成功后聚焦对应任务日志。
5. 状态为 `error` 的发布记录写入 error step，其它状态写入 success/completed step。
6. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：记录发布表单仍可见，流程日志无 console error。

## 非目标

- 不真实发布外部平台。
- 不改发布记录数据结构。
- 不新增后端命令。
- 不自动生成执行队列。
