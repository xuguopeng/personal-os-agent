# Step 73: 发布草稿排序

## 目标

发布草稿数量变多后，可以按不同维度排序，方便找最近更新、最早创建、待发布、已发布、某个渠道或某个标题的草稿。

## 小步骤

1. 增加 `PublishingDraftSortMode` 类型。
2. `PublishingDraftsPanel` 增加排序状态。
3. 筛选后调用 `sortPublishingDrafts` 生成展示列表。
4. 排序选项包括：最近更新、最早创建、状态、渠道、标题。
5. UI 在搜索、渠道筛选、状态筛选旁增加排序下拉。
6. 空状态文案保持不变。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页可见排序选项且无 console error。

## 非目标

- 不修改数据库查询顺序。
- 不改发布草稿数据结构。
- 不真实发布外部平台。
