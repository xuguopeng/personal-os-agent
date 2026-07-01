# Step 61: 发布记录历史排序

## 目标

让发布记录历史支持排序。发布记录变多后，可以按发布时间、记录时间、状态、渠道和草稿标题快速找到需要的记录。

## 小步骤

1. 新增 `PublishingRecordSortMode` 类型。
2. `PublishingRecordsPanel` 增加排序选择器。
3. 排序选项：
   - 发布时间新到旧
   - 发布时间旧到新
   - 记录时间新到旧
   - 状态
   - 渠道
   - 草稿标题
4. 历史列表使用筛选后的排序结果。
5. Markdown / CSV 导出使用同一排序结果。
6. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：发布记录历史可见排序选择器，无 console error。

## 非目标

- 不新增后端排序接口。
- 不改变数据库结构。
- 不改变发布记录内容。
