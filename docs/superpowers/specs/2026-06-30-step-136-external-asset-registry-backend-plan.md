# Step 136: 外部资产注册表后端

## 小计划

1. 新增外部资产、Skill 来源、模块蓝图三类数据模型。
2. 在 SQLite 初始化中创建：
   - `external_assets`
   - `skill_sources`
   - `module_blueprints`
3. 新增 Tauri 命令：
   - `list_external_assets`
   - `scan_external_assets`
   - `list_skill_sources`
   - `scan_skill_sources`
   - `list_module_blueprints`
4. 固定扫描用户指定目录，先注册路径和摘要，不复制外部源码。
5. 前端 `backend.ts` 增加对应类型、命令封装和浏览器 fallback。
6. 增加 Rust 测试覆盖初始化、资产扫描、Skill 扫描。

## 已完成

- 已创建 `external_assets` 表，用 `source_path` 去重。
- 已创建 `skill_sources` 表，用 `source_path` 去重。
- 已创建 `module_blueprints` 表，用 `module_key` 去重。
- 已内置模块蓝图：
  - 表情包
  - 漫画
  - 视频
  - 音乐
  - 小说
  - 博客/公众号
  - 设计
  - 沐账
  - 沐阅
- 已注册这批外部资产来源：
  - 沐系列软件库
  - 贴纸小铺表情包项目
  - 表情包通用生成流程
  - 漫画应用索引
  - 第一次战斗漫画项目
  - Tauri2Public
  - xu-ai
  - MuAudio
  - NAS-music
  - TauriVideo
  - Plotforge 小说桌面端
  - wxwrite 公众号写作
  - Figma-design
- Skill 扫描会读取：
  - `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/skills`
  - `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/.trae/skills`
  - `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/.claude/skills`

## 安全边界

- 不扫描 `node_modules`、`target`、`dist`、`build`、`.git`、`.dart_tool`。
- 不读取或复制 `.env`、token、cookie、API Key。
- 不自动运行外部项目命令。
- 不修改外部项目源码。

## 验证

- `CI=true pnpm build`：通过。
- `cargo check`：通过。
- `cargo test`：通过，32 个测试全部成功。

## 下一步

Step 137 做“外部资产工作台 UI”：

1. 左侧功能区增加“资产库/软件库”真实功能项。
2. 调用 `scan_external_assets`、`scan_skill_sources`。
3. 展示外部资产、Skill 来源、模块蓝图。
4. 支持按模块筛选：表情包、漫画、视频、音乐、小说、博客、设计等。
5. 为后续聊天 `@表情包`、`@漫画`、`@技能` 接入真实资产做准备。
