# Step 60: 发布记录编辑和删除写入流程日志

## 目标

让发布记录的后续维护动作也可追踪。用户编辑发布 URL、状态、备注，或删除一条误记记录时，底部流程日志应留下对应步骤。

## 小步骤

1. `PublishingRecordsPanel` 增加 `onTaskSessionFocus` 回调。
2. 编辑发布记录成功后追加 `publishing_record_update` 步骤。
3. 删除发布记录成功后追加 `publishing_record_delete` 步骤。
4. 草稿有任务时复用草稿任务；没有任务时创建新的博客任务。
5. 日志内容包含草稿标题、渠道、URL、状态和备注摘要。
6. 保存或删除后聚焦对应流程日志。
7. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：发布记录历史和流程日志正常渲染，无 console error。

## 非目标

- 不恢复已删除发布记录。
- 不修改外部平台内容。
- 不新增后端命令。
- 不改变发布记录数据结构。
