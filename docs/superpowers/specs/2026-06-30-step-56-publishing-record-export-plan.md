# Step 56: 发布记录导出

## 目标

让发布记录历史可以导出为 Markdown 或 CSV，方便用户整理博客发布台账、备份公众号/网站发布信息，或发给别的工具继续处理。

## 小步骤

1. 在 `PublishingRecordsPanel` 增加导出按钮。
2. 导出范围使用当前筛选后的发布记录。
3. Markdown 导出包含：
   - 草稿标题
   - 渠道
   - 状态
   - URL
   - 发布时间
   - 备注
4. CSV 导出包含同样字段，并做好引号转义。
5. 无匹配记录时禁用导出按钮。
6. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：发布记录历史出现 Markdown/CSV 导出按钮，无 console error。

## 非目标

- 不导出密钥、token、cookie。
- 不新增后端接口。
- 不做批量发布。
