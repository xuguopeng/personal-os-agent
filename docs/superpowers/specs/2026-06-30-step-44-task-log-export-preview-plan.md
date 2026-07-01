# Step 44: 任务日志导出预览

## 目标

在下载任务日志 Markdown 前先提供预览。用户可以确认内容、复制全文，也可以继续下载 Markdown，为后续发布到博客和公众号做准备。

## 小步骤

1. `ProcessLog` 增加导出预览本地状态。
2. 当前任务头部的按钮从直接下载改为打开预览。
3. 预览层展示：
   - 文件名
   - Markdown 全文
   - 关闭
   - 复制全文
   - 下载 Markdown
4. 复制使用浏览器 `navigator.clipboard`，失败时显示提示。
5. 下载继续使用第 43 步的 Blob 下载。
6. 验证：
   - `CI=true pnpm build`
   - `cargo check`
   - `cargo test`
   - 浏览器检查：预览按钮和预览层可用，无 console error。

## 非目标

- 不新增后端文件写入。
- 不保存导出历史。
- 不做 Markdown 渲染，只展示源码。
- 不做公众号真实发布。
