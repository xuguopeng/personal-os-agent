# Step 74: 发布草稿具体渠道筛选

## 目标

发布草稿已经能保存具体发布渠道到 frontmatter。本步在草稿列表中增加“具体渠道”筛选，让多个网站、公众号或自定义渠道并存时也能快速找到对应草稿。

## 小步骤

1. `PublishingDraftsPanel` 增加具体渠道筛选状态。
2. 从草稿 frontmatter 的 `publish_channel` 中提取可筛选渠道名。
3. 筛选时先按渠道类型，再按具体渠道，再按状态和搜索词。
4. 搜索范围加入 frontmatter 元数据，例如渠道、账号、分类、标签。
5. UI 在筛选栏增加“全部具体渠道”下拉。
6. 没有 frontmatter 的老草稿仍然可通过“全部具体渠道”查看。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页具体渠道筛选可见且无 console error。

## 非目标

- 不修改草稿数据库结构。
- 不重写已有草稿。
- 不真实发布外部平台。
