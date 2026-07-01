# Step 51: 博客草稿新建入口

## 目标

让博客模块可以直接新建 Markdown 发布草稿，不必先从任务日志导出。第一版只保存本地草稿，不真实发布。

## 小步骤

1. 新增 `BlogDraftComposer` 组件。
2. 组件字段：
   - 标题
   - 渠道类型
   - Markdown 正文
3. 保存时调用已有 `createPublishingDraft`。
4. 保存成功后刷新发布草稿列表。
5. 保存成功后清空表单。
6. 在博客模块中放到 `PublishingDraftsPanel` 上方。
7. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：博客模块新建草稿表单可见，无 console error。

## 非目标

- 不真实发布外部平台。
- 不新增富文本编辑器。
- 不接公众号排版。
- 不新增后端命令。
