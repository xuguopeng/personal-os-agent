# Step 135: 外部自研软件、表情包、漫画与 Skill 接入计划

## 目标

把用户现有的自研软件、表情包项目、漫画素材、AI skills、已开发项目纳入 Personal OS Agent 的统一能力系统中。

第一版不做粗暴复制代码，而是先建立“外部资产注册表 + 能力索引 + 聊天调用入口 + 可视化流程日志”。这样能先让 Agent 知道这些东西在哪里、能做什么、如何调用，后续再逐个模块深度内嵌。

## 已读取来源

### 自研软件库

来源：

- `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/软件`

识别到的应用：

| 应用 | 当前定位 | 状态 | 接入方式 |
| --- | --- | --- | --- |
| 沐影 MuYing | 图片浏览 / 影像处理 | 已完成，未打包 | 先注册为影像模块，后续读取实际工程 |
| 沐音 MuYin | 音乐播放 | 开发中 90% | 先接入音乐播放入口，后续对接 NAS-music |
| 沐声 MuAudio | AI 音乐电台 | 未开始 | 结合 MuAudio / MuAudioFlutter 做推荐和对话点歌 |
| 沐阅 MuYue | 阅读应用 | 未开始 | 先做阅读/资料库入口 |
| 沐账 MuZhang | 记账 / 财务管理 | 未开始 | 先做财务模块占位和需求卡 |

### 表情包项目

来源：

- `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/产品库/微信表情包`
- `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/产品库/微信表情包/xu-biaoqing`

已识别能力：

- 16 格表情包文案规划
- 角色 Skill 模板
- 批量生图工作流
- 品红背景抠图
- 透明母版导出
- 240 上传版导出
- 120 缩略图导出
- 微信表情包配套图规格
- Tauri 2 + React + Zustand + CodeMirror/Monaco 工作台

接入策略：

1. 先作为 `@表情包` 能力注册到主应用。
2. 先读取参考流程、素材目录和项目路径，不复制 `node_modules`、构建产物、临时缓存。
3. 第一版在主应用内显示表情包工作流卡片、资产路径、可执行动作。
4. 第二版抽取 `sticker-plan-store`、`sticker-skills`、导出管线等稳定代码。
5. 第三版接入图片生成模型和文件导出，形成真正可用的表情包模块。

### 漫画项目

来源：

- `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/产品库/漫画`
- `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/产品库/漫画应用`

已识别流程：

```text
小说/故事 -> AI 分镜 -> AI 绘图 -> 排版 -> 发布
```

已识别触发词：

- `加到raw`
- `加到wiki`
- `漫画做到哪了`

当前已有作品：

- `第一次战斗`
- 已有公众号草稿、静态图片、分镜页面、故事正文备份

接入策略：

1. 先注册 `@漫画` 能力。
2. 支持读取漫画项目状态、页面列表、草稿路径。
3. 支持聊天创建漫画任务：故事拆分、分镜规划、素材整理、发布检查。
4. 后续再把无限画布/排版/导出与视频模块打通。

### Skill 来源

来源：

- `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/skills`
- `/Users/xuguopeng/Documents/徐徐如声/徐徐如声/.trae/skills`
- 后续补充扫描 `.claude/skills`

已识别分类：

| 分类 | 用途 |
| --- | --- |
| AI写作 | 小说、博客、文案、人味儿改写、去 AI 味 |
| AI生图 | 人物表情、插画、表情包、参考图 |
| AI生视频 | 短剧、短视频、分镜、人物站位、视频风格 |
| AI设计 | UI、Figma、游戏素材、品牌视觉 |
| AI游戏 | 游戏开发和代理协作 |
| AI配音 | 预留配音、TTS、音乐生成 |
| AI工具与Prompt | 预留通用工具链 |

接入策略：

1. 先做 Skill 来源注册表。
2. 每个 Skill 记录路径、分类、标题、摘要、是否可用、最后扫描时间。
3. 聊天时根据 `@写作`、`@视频`、`@表情包`、`@漫画` 自动检索相关 Skill。
4. 后续接入向量索引，避免每次把整篇 Skill 塞进上下文。

### 已开发项目来源

来源：

- `/Users/xuguopeng/Documents/徐郭鹏项目/徐-开发项目`

识别到的项目：

| 项目 | 技术栈/形态 | 建议用途 |
| --- | --- | --- |
| Tauri2Public | Tauri 2 + React/Rust | 公共 Tauri 代码参考 |
| xu-ai | Tauri 2 + Vue + Koa/ws | AI 设置、工具运行、终端/服务模式参考 |
| MuAudio | Node workspace + web/server/client | 音乐推荐和 AI 电台参考 |
| MuAudioFlutter | Flutter | 沐声移动/桌面客户端参考 |
| NAS-music | Server + Flutter client | 沐音/NAS 音乐源参考 |
| 徐-AI视频生成 | TauriVideo / xu-video / lovarts-drama | 视频画布和 AI 视频生成参考 |
| 徐-写小说 | plotforge desktop + FlutterPublic | 小说模块参考 |
| 徐-公众号爆文生成 | wxwrite / wewrite | 博客、公众号发布参考 |
| Figma-design | Web 项目 | 设计稿生成参考 |
| xu-mall | Web/frontend | 商城/产品模块参考 |

接入策略：

1. 先只登记项目路径、技术栈、启动命令、构建命令、模块归属。
2. 不自动运行未知项目，不自动读取 `.env`，不复制密钥。
3. 对 Tauri/React 同栈项目优先做代码抽取候选。
4. 对 Flutter/Vue/Node 项目优先做外部应用连接和文档索引。

## 数据设计

### external_assets

记录外部资产、素材、项目、文档入口。

字段建议：

- `id`
- `name`
- `kind`: `software` | `project` | `skill` | `sticker_pack` | `comic_project` | `document` | `asset_dir`
- `module_key`: `music` | `voice_radio` | `sticker` | `comic` | `video` | `novel` | `blog` | `design` | `finance` | `reading` | `system`
- `source_path`
- `summary`
- `status`
- `tags_json`
- `launch_command`
- `build_command`
- `last_scanned_at`
- `created_at`
- `updated_at`

### skill_sources

记录可用 Skill 来源。

字段建议：

- `id`
- `title`
- `category`
- `source_path`
- `summary`
- `enabled`
- `indexed`
- `last_indexed_at`

### module_blueprints

记录每个模块的产品蓝图和接入进度。

字段建议：

- `module_key`
- `display_name`
- `description`
- `source_refs_json`
- `agent_triggers_json`
- `current_phase`
- `next_action`

## 聊天调用设计

第一批触发词：

| 触发词 | 模块 | 行为 |
| --- | --- | --- |
| `@表情包` | sticker | 创建表情包任务，展示流程，后续接入生成和导出 |
| `@漫画` | comic | 查询漫画项目、创建分镜/排版/发布任务 |
| `@写小说` / `@小说` | novel | 使用写作 Skill 和小说项目 |
| `@博客` / `@公众号` | blog | 创建草稿、发布检查、渠道记录 |
| `@视频` | video | 连接视频画布、Palmier/MCP、AI 视频项目 |
| `@音乐` / `@听歌` | music | 连接沐音、NAS-music、MuAudio |
| `@技能` / `@skill` | skill | 查询、启用、刷新 Skill 来源 |
| `@软件库` | system | 查看外部软件和开发项目清单 |

每次触发都必须写入流程日志：

1. 识别用户意图
2. 匹配模块
3. 检索外部资产/Skill
4. 生成任务计划
5. 等待执行或进入模块

## 实施小计划

### Step 136: 外部资产注册表后端

- 新增 SQLite 表：`external_assets`、`skill_sources`、`module_blueprints`
- 新增 Tauri 命令：
  - `list_external_assets`
  - `scan_external_assets`
  - `list_skill_sources`
  - `scan_skill_sources`
  - `list_module_blueprints`
- 内置固定扫描路径，不扫描 `node_modules`、`target`、`.git`、构建产物。
- 测试：初始化数据库后能写入/读取资产和 Skill 来源。

### Step 137: 外部资产工作台 UI

- 左侧功能区新增“软件库/资产库”真实功能项。
- 展示自研软件、表情包、漫画、Skill、开发项目。
- 支持按模块筛选：音乐、视频、表情包、漫画、小说、博客、设计、财务、阅读。
- 点击资产显示路径、摘要、状态、下一步动作。

### Step 138: Skill 列表与启用状态

- 设置页或能力页增加 Skill 列表。
- 支持刷新扫描。
- 支持启用/禁用。
- 先只做文件索引，不做向量 embedding。

### Step 139: 聊天触发外部资产

- 聊天支持 `@表情包`、`@漫画`、`@技能`、`@软件库`。
- 触发后从数据库读取真实资产。
- 生成流程日志和模块任务卡。

### Step 140: 表情包模块第一版

- 接入表情包参考流程和项目路径。
- 显示 16 格工作流状态。
- 读取现有 sticker pack 资产列表。
- 先不调用付费图片模型。

### Step 141: 漫画模块第一版

- 读取漫画项目状态。
- 展示页面列表、公众号草稿、图片路径。
- 支持 `漫画做到哪了` 查询。

### Step 142: 视频/音乐/小说项目连接

- 注册 MuAudio、NAS-music、TauriVideo、plotforge。
- 显示启动命令和项目状态。
- 后续再做真实启动/连接按钮。

## 安全边界

- 不复制 `.env`、token、cookie、API Key。
- 不把外部项目的 `node_modules`、`target`、build/dist 目录纳入索引。
- 不自动运行外部项目命令。
- 不自动发布公众号、网站或视频平台内容。
- 不修改外部项目源码，除非用户明确要求。

## 当前结论

这个需求应该先做成“个人资产与能力中枢”，再逐步把具体功能内嵌成模块。

最优先实现顺序：

1. 外部资产注册表
2. Skill 来源列表
3. 聊天触发外部资产
4. 表情包模块第一版
5. 漫画模块第一版
6. 视频/音乐/小说项目连接
