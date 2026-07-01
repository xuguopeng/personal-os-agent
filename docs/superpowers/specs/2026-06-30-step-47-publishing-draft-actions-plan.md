# Step 47: 发布草稿详情操作

## 目标

让发布草稿从“能看到”变成“能直接使用”。第一版增加复制标题、复制正文、下载 Markdown 和关联任务回跳。

## 小步骤

1. `PublishingDraftsPanel` 接收 `onTaskSessionFocus`。
2. 草稿列表项增加：
   - 复制标题
   - 复制正文
   - 下载 Markdown
   - 查看任务
3. 保留原有展开查看 Markdown 内容。
4. 复制成功/失败提示区分标题和正文。
5. 下载文件名使用草稿标题和短 ID。
6. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：草稿操作按钮可见，无 console error。

## 非目标

- 不真实发布外部平台。
- 不编辑草稿。
- 不删除草稿。
- 不新增后端命令。
