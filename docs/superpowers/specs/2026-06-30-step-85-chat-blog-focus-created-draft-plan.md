# Step 85: 聊天创建博客草稿后自动展开新草稿

## 目标

`@博客` 创建草稿后已经会自动打开博客模块。本步让新创建的草稿在列表中自动展开并短暂高亮，用户不需要手动找新草稿。

## 小步骤

1. App 增加 `focusedPublishingDraftId` 状态。
2. `@博客` 创建草稿成功后写入该草稿 ID。
3. `Workspace` 将目标草稿 ID 传给 `PublishingDraftsPanel`。
4. `PublishingDraftsPanel` 监听目标草稿 ID，自动展开对应草稿。
5. 对应草稿短暂高亮，随后自动恢复普通样式。
6. 不修改草稿数据，不写入数据库。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器输入 `@博客 ...` 后新草稿展开并无 console error。

## 非目标

- 不自动进入编辑态。
- 不改变筛选条件。
- 不真实发布外部平台。
