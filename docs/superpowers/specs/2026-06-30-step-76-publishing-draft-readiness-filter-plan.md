# Step 76: 发布草稿检查结果筛选

## 目标

发布草稿已经显示发布前检查结果，本步增加筛选能力，让用户可以快速只看“可发布”或“待补充”的草稿。

## 小步骤

1. 增加 `PublishingDraftReadinessFilter` 类型。
2. `PublishingDraftsPanel` 增加发布检查筛选状态。
3. 草稿筛选时复用 `getPublishingDraftReadiness`。
4. 筛选项包括：全部检查、可发布、待补充。
5. UI 在草稿筛选栏增加发布检查下拉。
6. 空状态文案补充发布检查筛选。
7. 验证：`CI=true pnpm build`、`cargo check`、`cargo test`、浏览器检查博客页可见发布检查筛选且无 console error。

## 非目标

- 不修改草稿数据结构。
- 不写入流程日志。
- 不真实发布外部平台。
