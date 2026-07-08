# Operate Log

## 2026-07-08

- sqmusic 自动下载选择器升级：缺歌下载不再按插件顺序直接取第一批结果，改为跨 `kw/qq/netease/kg/mg` 汇总候选后统一评分，优先原专辑、精确歌名、歌手匹配和可用高音质。
- 下载候选降权规则补全：演唱会、现场、DJ、Remix、伴奏、纯音乐、器乐、翻唱、铃声、精选/合集/Best Hits/KTV/周年精选/黄金年代等版本会降到阈值以下，避免误下非原曲版本。
- 下载音质选择优化：同一首候选支持按偏好音质排序重试，优先 FLAC，失败后可降级到 320/128；如果原专辑音源异步失败，不会自动跳到演唱会或精选版本。
- 真实下载验证：已调用 sqmusic 下载 Beyond《真的爱你》（`BEYOND IV (超越时代2CD纪念版)`）、《喜欢你》（`BEYOND秘密警察 (超越时代纪念版)`）和《海阔天空》（优先 QQ `乐与怒` 失败后，用 kw `乐与怒` 兜底），并执行 NAS 增量扫描。
- 播放验证：`海阔天空` 已进入曲库，路径为 `/data/media/sqmusic/BEYOND/乐与怒/海阔天空 - BEYOND.flac`，`/v1/music/audio/{id}` Range 请求返回 `206 Partial Content`。
- 线上《后来》重下处理：确认旧曲库记录的音频流已返回 404 后，先用全量扫描清理 stale 记录；随后重新调用 sqmusic 下载《后来 / 刘若英》，命中 `kw / 2020 刘若英陪你 献上录音专辑 / KW_FLAC_2000`，任务 `id=180` 下载成功；再执行增量扫描导入 1 首，曲库重新出现 `/data/media/sqmusic/刘若英/2020 刘若英陪你 献上录音专辑/后来 - 刘若英.flac`，音频 Range 请求返回 `206 Partial Content`。

## 2026-07-02

- 当前方向切回全栈项目：确认不修改 `~/Documents/徐郭鹏项目/徐-音乐播放器/mu-music`，继续以当前 Tauri/React 全栈项目作为 Personal OS Agent 总控台。
- 设置页新增“模块应用化路线”面板：明确当前全栈项目负责 Agent、记忆、知识库、MCP/Skill、NAS 和流程日志，小说、音乐、博客、漫画、表情包、视频可逐步拆成独立应用。
- 扩展模块元数据：每个模块增加总控台/可独立/计划独立状态、运行目标、接入方式和下一步，方便后续按模块推进，不再把所有功能无边界塞进一个页面。
- 验证通过：`pnpm exec tsc --noEmit --pretty false`、`CI=true pnpm build`、`cargo test` 均成功；仍保留已有 Vite 单 JS chunk 超过 500KB 的体积警告。
- 排查 `App.tsx` 超过 500KB 导致 Babel deoptimised styling 提示的问题：确认主因是所有工作台页面长期堆在单个主文件里，属于工程结构问题，不是单个 UI 报错。
- 工程结构修复第一批：将视频工作台拆分到 `src/workspaces/video-workspace.tsx`，`App.tsx` 只保留路由调用，后续继续按模块拆分音乐、博客、小说、漫画/表情包等页面。
- 构建验证通过：`CI=true pnpm build` 成功；仍有 bundle 超过 500KB 的体积警告，下一步需要继续拆模块并做动态分包。
- 记录 macOS `IMKCFRunLoopWakeUpReliable` / `TSM AdjustCapsLockLEDForKeyTransitionHandling` 日志判断：这是系统输入法/键盘层日志，当前没有证据表明是应用业务崩溃原因。
- 工程结构修复第二批：将音乐工作台、Daoliyu 播放器、歌单、歌词、封面和播放工具函数拆分到 `src/workspaces/music-workspace.tsx`；`App.tsx` 降到 567912 bytes。
- 第二批构建验证通过：`CI=true pnpm build` 成功；当前剩余问题是产物仍打成单个 616KB 左右的 JS chunk，需要下一步做动态 import/code splitting。
- 工程结构修复第三批：将小说工作台、博客发布指挥台、写作/发布草稿、小说资料预览和小说流程拆分到 `src/workspaces/writing-workspaces.tsx`；`App.tsx` 降到 541769 bytes。
- 第三批构建验证通过：`CI=true pnpm build` 成功；下一批优先拆底部 `ProcessLog` 和任务详情卡片，目标是把 `App.tsx` 压到 500KB 以下。
- 工程结构修复第四批：将底部流程日志、任务步骤卡片、Markdown 导出预览、待确认摘要拆分到 `src/components/process-log.tsx`；`App.tsx` 降到 481667 bytes，低于 Babel 500KB 源文件警告阈值。
- 工程结构修复第五批：将漫画/表情包工作台拆分到 `src/workspaces/image-workspace.tsx`，保留草稿自动保存、提示词预览、素材参考和写入流程能力。
- 工程结构修复第六批：将记忆模块面板拆分到 `src/workspaces/memory-workspace-panels.tsx`，包括长期理解概览、记忆候选、聊天历史挖掘和长期记忆列表。
- 工程结构修复第七批：将知识库概览和资料管理面板拆分到 `src/workspaces/knowledge-workspace-panels.tsx`；`App.tsx` 降到 421066 bytes。
- 第四到第七批构建验证通过：`CI=true pnpm build` 成功；当前仍有单 JS chunk 超过 500KB 的 Vite 警告，后续需要做动态 import/code splitting。
- 音乐播放全局化第一批：新增 `src/components/global-music-player.tsx`，把隐藏 `<audio>`、播放状态、进度、音量、播放模式、上一首/下一首提升到 App 顶层。
- 音乐模块改为调用全局播放器：音乐页仍保留完整播放器控制条，切到小说、博客、视频、记忆、知识库、设置等模块时，会显示全局迷你播放器并继续播放。
- 全局播放器构建验证通过：`CI=true pnpm build` 成功；仍保留 Vite 单 chunk 体积警告，后续用动态 import 处理。
- 音乐页简化第一批：音乐模块改为左侧歌曲列表、右侧歌曲详情、底部播放 bar，移除主视图里的歌单侧栏、歌单创建和过重的下一步提示。
- 播放加载态优化：音乐页和全局播放条的中间播放按钮在播放、暂停、上一曲、下一曲请求期间显示旋转加载图标。
- 工程结构修复第八批：将设置总览、本地数据层、NAS 配置和本机草稿备份拆分到 `src/workspaces/settings-workspace-panels.tsx`。
- 工程结构修复第九批：将多条 AI 模型配置、当前模型选择、密钥状态保存/删除拆分到 `src/workspaces/settings-workspace-panels.tsx`。
- 工程结构修复第十批：将 MCP/Skill 能力列表、能力模板、安全策略和执行队列拆分到 `src/workspaces/capabilities-workspace-panels.tsx`。
- 工程结构修复第十一批：将发布渠道、博客草稿、发布草稿、发布记录和发布检查清单工具拆分到 `src/workspaces/publishing-workspace-panels.tsx`，Agent 继续复用其中的发布解析/检查函数。
- 工程结构修复第十二批：将右侧 Agent Chat、聊天会话切换、快捷指令、上下文摘要和确认卡片拆分到 `src/components/agent-panel.tsx`；`App.tsx` 保留任务业务逻辑和模块编排。
- 第八到第十二批验证通过：`pnpm exec tsc --noEmit --pretty false` 和 `CI=true pnpm build` 成功；当前仍有 Vite 单 JS chunk 超过 500KB 的体积警告，下一步建议做动态 import/code splitting。
- 工程结构修复第十三批：按子代理只读审查建议继续拆分剩余纯逻辑，新增 `src/components/workspace-shell.tsx` 承载 Workspace、Toolbar、ReadinessPanel 和工作区展示壳。
- 工程结构修复第十四批：新增 `src/lib/labels.ts`，集中状态、风险、渠道、发布状态、记忆类型、日期和短 ID 等展示 label/format helper。
- 工程结构修复第十五批：新增 `src/app/modules.ts`，集中左侧功能模块和顶部工具模块元数据。
- 工程结构修复第十六批：新增 `src/agent/message-routing.ts`、`src/agent/music-intents.ts`、`src/agent/memory-intents.ts`、`src/agent/blog-draft-intents.ts`、`src/agent/capability-planning.ts`，拆出聊天路由、音乐意图、记忆意图、博客草稿/发布意图和 MCP/Skill 能力规划纯逻辑。
- 第十三到第十六批验证通过：`pnpm exec tsc --noEmit --pretty false` 和 `CI=true pnpm build` 成功；`App.tsx` 当前约 3110 行，剩余主要是顶层状态协调、任务执行编排、Agent 回复摘要构建，后续可再拆 `useAgentTaskRunner` 和动态分包。
- 工程结构修复第十七批：新增 `src/app/use-app-data-loaders.ts`，将 bootstrap、任务日志、执行队列、发布、能力、知识、记忆、NAS、音乐等加载状态和刷新函数从 `App.tsx` 拆成应用数据 hook。
- 工程结构修复第十八批：新增 `src/agent/agent-response.ts`，集中 Agent 回复文案、聊天上下文摘要、确认门执行计划摘要、UI ID 生成和 AgentTaskResult 类型；`App.tsx` 降到 2435 行。
- 工程结构修复第十九批：新增 `src/app/use-execution-queue-actions.ts`，将执行队列手动改状态和结果记录 handler 从 `App.tsx` 拆成可复用 hook；`App.tsx` 降到 2392 行。
- 第十七到第十九批验证通过：`pnpm exec tsc --noEmit --pretty false` 和 `CI=true pnpm build` 成功；当前仍有 Vite 单 JS chunk 超过 500KB 的体积警告，下一步继续拆 `useAgentTaskRunner` 和做动态分包。
- 音乐模块简化重构：按“左侧歌曲列表、右侧歌曲详情、底部全局播放 bar”重排 `src/workspaces/music-workspace.tsx`，移除音乐页内第二套完整播放器，保留搜索、登录/刷新、选歌、直接播放和歌词文本化展示。
- 全局播放器细节优化：`src/components/global-music-player.tsx` 的上一首/下一首按钮支持独立 loading，切歌时中间播放按钮同步显示加载中；音乐页复用全局 bar 时避免重复挂载隐藏 audio。
- 音乐模块重构验证通过：`pnpm exec tsc --noEmit --pretty false` 和 `CI=true pnpm build` 成功；仍有已有 Vite 单 JS chunk 超过 500KB 的体积警告。
- 修复聊天音乐命令不真实播放：`@音乐 播放/暂停/上一首/下一首` 改为调用同一个 `globalMusicPlayer` 控制器，不再只写流程日志和远端状态。
- 修复切换模块后音乐停止：`GlobalMusicPlayerBar` 显隐时保持 hidden audio 在同一组件结构中，不再因为 `visible` 切换而卸载音频节点；上一首/下一首会从 Daoliyu 当前播放状态取曲目并接入本机音频流。
- 音乐播放修复验证通过：`pnpm exec tsc --noEmit --pretty false` 和 `CI=true pnpm build` 成功；仍有已有 Vite 单 JS chunk 超过 500KB 的体积警告。
- 全局音乐入口调整：非音乐模块不再显示整条播放器，只显示底部悬浮播放按钮，点击直接进入音乐页面；隐藏 audio 仍常驻挂载，保证跨模块播放不断。
- 修复音乐自动播放误报和不播放：本机音频换源后不再立刻 `play()`，改为记录待播放请求并在 audio `canplay` 事件后统一播放；`AbortError`/`operation was aborted` 视为换源过程中的可恢复状态，不再显示为红色阻断错误。
- Agent 聊天输入增加 `@` 指令选择器：输入 `@` 或 `@音`、`@博` 等时，在输入框上方弹出小说、博客、音乐、视频、漫画、记忆、知识库等常用命令，点击即可填入完整指令，减少重复手打。
- 修复音乐列表和上下曲错乱：全局播放器新增本地播放队列，音乐页和聊天搜索会同步当前歌曲列表；上一首/下一首优先按本地队列计算，不再依赖可能滞后的 Daoliyu 当前状态，也不再默认把列表第一首当当前展示项。
- Agent 聊天流式输出自动滚动到底部：消息新增和回复流式生成时自动跟随到底部，回复结束后用户仍可手动向上查看历史。
- 视频模块增加 AI 生成工作流：新增“AI 生成视频内容”输入区，用户只需填写第一步需求，系统会按需求、大纲、角色场景道具、参考图、分镜、关键帧、分镜视频、成片导出 8 步顺序调用聊天模型生成产物；未配置真实模型时使用本地结构化兜底。
- 视频 8 步产物状态上移：AI 生成结果会直接写入每一步产物草稿编辑区，并继续通过现有 `draft.video.step*.output` 自动保存到 SQLite/localStorage；生成完成后同步写入流程日志。
- 视频生成改为逐步确认：AI 只先生成当前步骤产物并列举内容，状态保存为待确认；用户在聊天框输入“确定/继续/下一步”后，Agent 会确认当前步骤、生成下一步、更新视频产物草稿和流程日志。
- 视频草稿支持跨聊天更新：`draft.video.step*.output/status` 增加本地草稿更新事件，聊天确认生成的新步骤会立即反映到视频模块编辑区。
- 按 Product Design brief 重构视频模块首屏：视频页改为“AI 视频流程工作台”，首屏聚焦当前步骤、8 步流程产物、聊天确认状态和 Palmier MCP 状态。
- 视频模块信息层级收拢：项目草稿、MCP 执行包、8 步产物明细和内容产物区统一收到“高级配置、执行包和产物库”折叠区，避免打开页面后信息过载。
- 视频确认状态可视化：新增右侧“聊天确认”面板，显示当前等待确认的步骤和最近产物摘要，引导用户在聊天输入“确定”继续生成下一步。
- 视频模块重构验证通过：`pnpm exec tsc --noEmit --pretty false` 和 `CI=true pnpm build` 成功；仍有已有 Vite 单 JS chunk 超过 500KB 的体积警告。
- Kinetic Lab 主题重构第一批：全局外框改为深色点阵背景、深色左侧导航、浅蓝灰主窗口、紫蓝主按钮和铜橙提示色方向；顶部 NAS 只显示在线/待检查，不再展示容量。
- 左侧模块拆分：工作模块改为小说、音乐、博客、漫画、表情包、视频；记忆、知识库、设置继续作为右上角工具入口。
- 漫画/表情包入口拆分：UI 层新增 `comic` 与 `sticker` 模块，底层暂时复用图片生成工作台和草稿字段，避免破坏已有图片模型配置和本机草稿。
- Kinetic Lab 主题修正：根据参考图重新调整外框，取消大面积深色侧栏，改为深色点阵背景上的浅蓝实验面板；左侧导航、顶部状态、工作区、聊天区和流程日志统一为浅蓝卡片系统，深色只保留为选中态/反色强调。
- Kinetic Lab 主题二次校正：根据用户提供的成品页面截图，改为“深色系统壳 + 浅色工作台”结构；左侧和顶部恢复深色，左侧选中态使用紫蓝渐变，主工作区、右侧聊天和底部流程日志保持浅色大面板。
- 左侧导航图标修正：参考截图改用更接近的线性 lucide 图标（小说书本、音乐音符、博客笔记、漫画图书、表情包贴纸、视频胶片），并移除左侧模块右侧的黄色/灰色状态点。
- Kinetic Lab 外框结构修正：将左侧导航、顶部栏和内容区包进同一个 `kinetic-app-frame` 大圆角窗口，移除左侧和主区各自独立的外框/圆角，使页面呈现参考图中的整体块状结构。
- 小说工作台按参考图重构：内容区改为当前作品、章节列表、章节草稿、角色、世界观、记忆上下文、知识上下文的三栏结构，章节正文可本地保存并可写入流程日志。
- 修复小说工作台三栏溢出：三栏改为可压缩比例布局，章节列表和右侧上下文改为内部滚动，避免聊天面板打开时右侧卡片和底部信息跑出主内容区。
- 小说模块接入真实数据第一批：参考 PlotForge 写小说项目的数据结构，在当前 SQLite/Tauri 后端新增小说作品、章节、草稿、角色、世界观表和读写命令；前端小说页改为读取真实数据，支持新建作品、新建章节、保存正文草稿。
- NAS 音乐电台第一批：Flutter 桌面音乐页移除“歌手”入口，新增“音乐电台”Tab；可根据当前歌曲/喜欢列表创建电台任务、查看历史节目，并把节目包装成普通播放 track 走现有播放器。
- NAS 服务端音乐电台接口：新增 `/v1/music/radio/status`、`/v1/music/radio/jobs`、`/v1/music/radio/jobs/{id}`、`/v1/music/radio/episodes`、`/v1/music/radio/episodes/{id}/stream`；SQLite 增加 `music_radio_jobs` 和 `music_radio_episodes` 表。
- MiniMax TTS 配置接入：新增 `MINIMAX_API_KEY`、`MINIMAX_GROUP_ID`、`MINIMAX_TTS_VOICE_ID`、`MINIMAX_TTS_MODEL`、`RADIO_OUTPUT_DIR` 配置；未配置 MiniMax 时生成可播放 mock WAV，配置后调用 MiniMax TTS 生成 MP3。
- 音乐电台验证：Flutter `analyze`、macOS debug build、Android debug build 通过；本地 NAS 服务端用 Python 3.11 临时环境验证 radio status、create job、episodes 和 range stream，音频接口返回 `206 Partial Content`。
- NAS 每日音乐电台定时：新增服务端后台定时器，默认每天 `Asia/Shanghai 07:30` 根据陕西西安天气和 Daoliyu 最近播放记录生成一期电台；新增 `/v1/music/radio/daily/status` 和 `/v1/music/radio/daily/run`，Flutter 桌面电台页显示每日状态并可立即生成今日电台。
- 每日音乐电台验证：本地服务端验证西安天气读取成功，脚本包含天气信息；启动时间已过 07:30 时会自动补生成当天一期，手动 `/daily/run` 也可生成；Flutter `analyze`、macOS debug build、Android debug build 通过。
- MiniMax Token Plan 接入音乐电台：服务端新增 `MINIMAX_SUBSCRIPTION_KEY` 优先读取并兼容旧 `MINIMAX_API_KEY`，默认电台 TTS 改为 `speech-2.8-hd` + `male-qn-jingying`；真实订阅 Key 已写入 ignored 的本地 secret env 文件，文档和示例只保留字段名。
- Flutter 音乐电台客户端收尾：桌面端音乐电台页独立于歌曲列表加载，新增 MiniMax 状态徽标和刷新按钮；确认线上 NAS `/radio/status`、`/radio/daily/status`、`/radio/episodes` 可用，macOS 和 Android debug 包重新构建通过。

## 2026-07-01

- 将 NAS Agent Server 的 Docker 数据挂载从匿名 volume 改为绿联 NAS 宿主机路径：`/volume1/docker/personal-os-agent/data:/data`。
- 新增 `data/README.md` 和 `data/secrets/daoliyu.env.example`，用于在 NAS 文件管理里创建 `/data/secrets/daoliyu.env`。
- 更新 `.gitignore`：继续忽略真实数据库和真实 `.env` 密钥文件，但允许提交数据目录说明和示例模板。
- 移除 `docker-compose.yml` 里的空 `DAOLIYU_USERNAME` / `DAOLIYU_PASSWORD`，避免空环境变量覆盖 `/data/secrets/daoliyu.env`。
- 调整服务端配置读取逻辑：环境变量为空字符串时视为未配置，继续读取 env 文件。
- 音乐工作台接入 NAS Agent Server 的 Daoliyu 登录状态、播放器、曲目和歌单概览；登录状态只显示在音乐模块。
- NAS Agent Server 增加 CORS 允许规则，方便 Tauri/Web 预览直接读取 `https://os.xuguopeng.com/v1/music/*`。
- 音乐工作台升级为可操作版本：支持搜索歌曲、查看歌曲详情、播放/暂停/上一首/下一首、创建歌单、把选中歌曲加入歌单。
- 聊天 Agent 增加第一批 `@音乐` 命令：搜索、播放、暂停、上一首、下一首、创建歌单，并把动作写入流程日志。
- 修复音乐模块在 Tauri WebView 中请求 NAS 可能出现 `Load failed`：桌面端音乐/NAS JSON 请求改为走 Rust `nas_json_request` 桥接，浏览器预览继续使用 fetch fallback。
- 修复底部流程日志高度和滚动布局；歌曲详情不再展示整段 JSON，歌词和音频信息分区显示。
- 按 Product Design 选定的 Command Center 方向重构主界面外壳：左侧只保留真实功能模块，顶部放记忆、知识库、设置和聊天控制，底部流程日志降高并提升密度。
- 将视频画布改为 8 步内容生成工作流：需求、大纲、角色场景道具、参考图、分镜、分镜关键帧、分镜视频、成片导出；Palmier/MCP 作为后续执行器。
- 视频工作流按钮接入现有模块动作日志，点击“生成关键帧清单”等动作会写入底部流程日志。
- 新增 `design-qa.md`，记录 Product Design 对照截图、视觉 QA 结果和后续 polish 项。
- 处理本地开发端口占用：确认旧 Vite 进程占用 `127.0.0.1:1420`，结束进程后重新启动 dev server；调试记录写入 `memory/2026-07-01-dev-server-port-1420.md`。
- 小说模块升级为 Command Center 真实状态页：从知识库与长期记忆汇总作品资料、角色、世界观、章节素材，并展示小说生成流程。
- 博客模块升级为发布指挥台：展示草稿、待发布、可发布、待补充、发布渠道、配置完整度，以及最近草稿和渠道准备状态。
- 对小说/博客/音乐工作台进行浏览器截图检查，修复统计卡片过窄导致中文竖排的问题。
- 修复音乐模块卡顿/滚动问题：音乐 overview 改为分项容错加载，NAS 请求超时降为 12 秒，歌曲列表和歌单列表不再使用嵌套滚动容器。
- 新增真实本机播放链路：NAS 服务端增加 `/v1/music/audio/{track_id}/status` 和 `/v1/music/audio/{track_id}`，前端音乐模块增加 `<audio controls>` 本机播放器。
- 增加 `DAOLIYU_MEDIA_ROOT=/data/media` 配置说明；真实播放需要把 NAS 音乐库以只读方式挂载到 Agent Server 容器内的 `/data/media`。
- 音乐播放/滚动调试记录写入 `memory/2026-07-01-music-scroll-and-real-playback.md`。
- 按用户参考图重构音乐播放页：左侧导航改为黑底选中态并收窄，音乐模块改为歌曲表格、歌曲详情、播放列表和底部本机播放器布局。
- 右侧 Agent 面板增加快捷指令卡片，音乐上下文下优先展示 `@音乐 播放`、`@博客 草稿`、`@视频 剪辑`、`@小说 大纲`、`@漫画 生成`。
- 隐藏底部原生 HTML 音频控件，改为应用内自定义播放条：播放/暂停、进度、音量滑块和顺序/单曲循环/随机模式。
- 音乐真实播放改为 Daoliyu 标准流地址：NAS 服务端内部拼接 `/api/tracks/{trackId}/stream?token=...` 并代理给前端，前端不接触 token，也不再依赖本地媒体目录挂载。
- 前端音乐播放接入线上已验证的 Daoliyu 通用代理接口：音频流使用 `/v1/music/api/tracks/{trackId}/stream`，播放/暂停使用 `/v1/music/api/player/play` 和 `/v1/music/api/player/pause`，暂停后再次播放优先从本地音频当前位置续播。
- 音乐封面图统一走 NAS 代理：前端拼接 `https://os.xuguopeng.com/v1/music/static/...`，服务端代理把 `/v1/music/static/...` 转发到 Daoliyu 的 `/static/...`。
- 完善剩余工作页面第一批：漫画/表情包模块升级为可操作工作台，视频模块增加内容产物区，记忆中心增加 Agent 长期理解概览，知识库增加 Agent 资料中心，MCP/Skill 面板增加调用安全和能力统计。
- 完善剩余工作页面第二批：设置页增加系统配置总览，漫画/表情包页增加可编辑生成草稿和提示词预览，视频页增加可编辑项目草稿和执行摘要，草稿动作可写入流程日志。
- 完善剩余工作页面第三批：小说页增加可编辑写作草稿和续写输入预览，博客发布指挥台增加发布规划草稿，二者都支持把当前规划写入流程日志。
- 完善剩余工作页面第四批：小说、博客、漫画/表情包、视频的可编辑草稿输入改为本机自动保存，刷新页面后不丢失；后续再升级为 SQLite 草稿表。
- 完善剩余工作页面第五批：小说、博客、漫画/表情包、视频草稿面板增加复制预览和恢复默认，预览区统一为可滚动、可复制的工具块。
- 完善剩余工作页面第六批：右侧 Agent 快捷指令按当前模块显示小说、博客、漫画/表情包、视频、音乐、记忆、知识库对应命令；MCP/Skill 设置面板增加常用能力模板。
- 完善剩余工作页面第七批：设置、小说、博客、漫画/表情包、视频页面增加下一步建议/配置缺口面板，展示当前就绪项和需要补齐的资料、模型、渠道或 MCP 状态。
- 完善剩余工作页面第八批：音乐、记忆、知识库页面增加下一步建议面板；设置页增加本机草稿备份面板，可复制 localStorage 草稿 JSON，不包含密钥。
- 完善剩余工作页面第九批：设置页本机草稿备份增加导入恢复能力，粘贴 JSON 后可预览并恢复白名单草稿字段，继续排除密钥和账号 token。
- 完善剩余工作页面第十批：新增 SQLite `local_drafts` 草稿表和 Tauri/前端 API，设置页备份面板支持把本机草稿同步到 SQLite，恢复草稿时同时写入 localStorage 和 SQLite。
- 完善剩余工作页面第十一批：通用草稿输入 hook 接入 SQLite，小说、博客、漫画/表情包、视频草稿打开时优先读取 SQLite，编辑时自动同步到 `local_drafts`。
- 完善剩余工作页面第十二批：设置页增加 SQLite 草稿管理列表，可查看草稿模块、来源、更新时间，支持复制单项内容和确认删除草稿。
- 完善视频页第十三批：视频项目草稿增加参考素材、镜头数量和导出路径，生成可复制的 Palmier/MCP 执行包 JSON，并新增 8 步产物明细面板。
- 完善视频页第十四批：8 步流程面板支持点击切换当前步骤，右侧显示该步输入、输出、验收和执行说明，并可将当前步骤生成/校对动作写入流程日志。
- 完善视频页第十五批：每个视频流程步骤增加产物草稿编辑区，支持复制、恢复模板、写入流程日志，并自动保存到 SQLite 草稿表。
- 完善视频页第十六批：8 步流程增加可持久化完成/当前/待处理状态，支持手动标记并写入流程日志，进度条和执行包预览改为读取草稿状态；第 7、8 步仍只更新 UI 状态，不真实调用 MCP 或导出。
- 音乐电台改为真实节目流程：服务端生成“开场语音 -> 推荐歌曲队列 -> 收尾语音”的 segments，开场脚本增加西安天气、歌曲信息和推荐理由；Flutter 客户端将电台 episode 转为播放队列，点击今日电台会先播放 MiniMax 开场，再顺序播放真实 NAS 歌曲，最后播放收尾语音。
- Flutter 播放器修复：重新设置播放列表监听前会先取消旧订阅，避免多次进入电台/歌曲后上下曲触发重复加载。
- 修复“生成电台”仍是旧流程：NAS 服务端 `/v1/music/radio/jobs` 改为和“今日电台”一致的开场语音、歌曲队列、收尾语音 segments；Flutter macOS 音乐页按 Product Design 方向重构为桌面音乐库，新增音乐列表、歌手列表、喜欢、播放记录、今日电台分区，歌手卡片可进入该歌手歌曲列表。
- Flutter macOS 音乐页组件风格回收：加载态和按钮加载动效改回原项目使用的 `LoadingAnimationWidget.staggeredDotsWave`，继续沿用 `NetImage` 和 `BottomPlayerBar` 等原有组件，避免桌面页出现临时拼装感。
- Flutter 项目新增黑色/白色主题切换：新增 `ThemeStore` 持久化主题选择，`AppColors` 改为根据当前主题动态返回颜色；macOS 顶部栏和移动端底部区域新增 `ThemeToggleButton`，切换后全项目使用 `AppColors` 的页面跟随变更。
- Flutter 主题主色锁定为原项目红色：`AppColors.brandRed/primaryBtn` 固定为 `rgb(254,121,113)`，黑色/白色主题只切换背景、表面、边框和文字色；Material `primaryColor/colorScheme.primary` 同步使用该红色，避免白色主题下系统控件变成默认蓝色。
- Flutter 电台旧结构兼容：线上 NAS 旧节目返回 `generator=minimax` 但 `segments=[]` 时，客户端会根据 `sourceTrackIds` 自动拼成“电台串词 + 真实歌曲列表”的播放队列，并在列表中显示歌曲数量，避免旧节目只作为一段测试音频播放。
- Flutter macOS 音乐页图标圆角化：左侧音乐库导航、电台流程提示、电台节目列表统一改为圆角图标盒；电台页在检测到 NAS 仍返回旧结构时显示兼容提示，说明当前只能按“串词 + 歌曲队列”播放，完整收尾语音需要 NAS 服务端重新部署。
- Flutter macOS 音乐页视觉收简：按反馈移除图标外层圆角盒和边框，图标恢复为纯图标显示；顶部左侧只保留 logo，不再显示“沐音 / NAS 音乐 / 桌面音乐库”等额外标签。
- Flutter macOS 顶部栏继续收简：移除图片 logo，左上角只保留“沐音”文字，避免黑白主题切换时图片 logo 适配不稳定。
- Flutter macOS 音乐页按新参考图重构：桌面端改为暗色星点背景、左侧纯图标导航、中央音乐库表格、右侧今日电台/最近播放/喜欢卡片，以及独立的大底部播放栏；播放、上一首、下一首、喜欢、进度拖动和播放队列继续接入真实播放器。
- 开源边界收紧：`.gitignore` 增加 private/self-use 能力规则，真实密钥、自用插件目录、QQ/网易/酷狗/酷我等第三方音乐元数据 provider 实现默认不进入 git；开源仓库只保留接口、示例配置和说明。
- 仓库方向调整为 NAS 音乐服务：移除旧 React/Tauri 应用壳、node_modules/dist/build 缓存和非 NAS 产品规划文档；保留 `services/agent-server`、Docker 配置、数据/密钥示例、NAS 文档和操作日志；将 Flutter 音乐客户端从原路径移动到 `clients/mu-music`，并清理 build、Pods、Gradle 缓存等生成物。
- 新增全网听歌记录中心第一版：NAS 服务端增加 `/v1/listening` 路由、`listening_sources/listening_events/listening_sync_runs` SQLite 表、Daoliyu/NAS 内置同步、统一听歌画像接口，以及网易云/QQ 音乐私有插件协议；真实 cookie/session 放入 `music-sources.env`，私有抓取插件放 ignored 目录，不进入开源仓库。
- 全网听歌记录来源补齐：`/v1/listening` 默认来源增加酷狗音乐、酷我音乐，`music-sources.env.example` 增加 `KUGOU_*`/`KUWO_*` 配置项，私有插件协议扩展到 `kugou_history.py` 和 `kuwo_history.py`；本地 ignored 目录已放酷狗/酷我 JSON 导入模板。
- 网易云听歌排行样本接入：本地 ignored 的网易云私有插件支持解析 DevTools 复制出来的 `"allData": [...]` 片段格式（含尾逗号）；用户提供的 100 条网易云记录可完整解析并导入统一 `listening_events`，测试结果为 100 条、累计播放计数 14,558。
- 全网听歌记录策略修正：确认 QQ 音乐、酷狗音乐、酷我音乐网页端当前没有稳定的个人播放记录入口；服务端默认不再把三者作为可自动同步插件启用，改为 `client_or_import` 来源，后续通过 Flutter/桌面端播放采集、标准 JSON/CSV 导入或个人自用客户端插件汇总到统一画像。
- QQ 音乐最近播放截图导入：将用户提供的 QQ 音乐“最近播放 66 首”长截图人工整理为 ignored 的 `data/private_exports/qq-recent-from-screenshot-2026-07-05.json` 和 CSV 校对表；本地临时库验证 66 条可写入 `listening_events`，来源标记为 `qqmusic/recent_screenshot`，播放次数统一按 1 处理。
- NAS 服务端登录保护：新增 `AGENT_SERVER_USERNAME` / `AGENT_SERVER_PASSWORD` Basic Auth；配置后 `/v1/*`、`/docs`、`/redoc`、`/openapi.json` 都需要账号密码访问，`/health` 继续公开给 NAS/反代健康检查；本地开发未配置账号密码时保持放行。
- 音乐流代理收口：确认 Daoliyu Docker 通过宿主机 `5173` 暴露前端服务，Agent Server 使用 `http://host.docker.internal:5173` 优先连接；Flutter 播放 URL 从 Daoliyu 直连 `/api/tracks/{id}/stream` 改为 Agent Server 的 `/v1/music/audio/{track_id}`，由服务端登录 Daoliyu、拼接 token 并代理音频流。
- Flutter NAS 访问优先级：客户端 HTTP 工具改为多地址自动兜底，默认先试本机/局域网 Agent Server，再退到 `https://os.xuguopeng.com/v1/music`；成功地址会被复用到接口、封面、电台音频和歌曲流。新增 `NAS_LOCAL_API_URL`、`NAS_PUBLIC_API_URL`、`AGENT_SERVER_USERNAME`、`AGENT_SERVER_PASSWORD` dart-define，接口和 just_audio 音频流都会携带 Basic Auth。
- 自有 NAS 音乐服务第一批：服务端新增 `music_tracks/music_playlists/music_playlist_tracks` SQLite 表和 `/v1/music/api/admin/scan` 扫描接口，使用 Mutagen 读取本地音乐标签、歌词和内嵌封面，封面缓存到 `MUSIC_COVER_DIR`。
- 自有 NAS 音乐播放接口：新增 `/v1/music/api/tracks`、`/v1/music/api/tracks/{id}`、`/v1/music/audio/{id}`、`/v1/music/covers/{id}`、歌单、喜欢、播放状态接口；音频流支持 HTTP Range，可供 Flutter/just_audio 播放和拖动。
- 自有服务迁移策略：`local_music_router` 放在旧 Daoliyu 代理路由之前，Flutter 现有 Daoliyu 风格字段通过兼容字段返回；未覆盖的旧路径仍临时 fallback 到 Daoliyu，后续可逐步停用。
- 自有 NAS 音乐验证：本地临时生成 wav 文件并使用 FastAPI TestClient 验证扫描、歌曲列表、歌曲详情、Range 音频流和播放记录同步，`/v1/music/audio/{id}` 返回 `206 Partial Content`。
- 自有 NAS 音乐服务第二批：新增后台扫描 `/api/admin/scan/background` 和 `/api/admin/scan/status`，新增歌手、专辑、最近播放、播放历史、统计接口，播放时写入 `music_play_history` 并同步统一听歌画像。
- 自有 NAS 音乐第二批验证：本地临时库验证 2 首歌的扫描、歌手/专辑聚合、喜欢、播放历史、后台扫描状态和音频 Range，所有关键接口返回正常。
- 自有 NAS 音乐服务第三批：扫描支持同名 `.lrc/.txt` 歌词、同名封面图和同目录 `cover/folder/front/album/封面` 图片；新增元数据缺失报告 `/api/admin/metadata/report`。
- 歌词和元数据接口：新增 `/api/tracks/{id}/lyrics` GET/PUT，返回 LRC 时间轴 `{timeMs,text}`；新增 `/api/tracks/{id}/metadata` PATCH，可修正标题、歌手、专辑、年份、流派和音轨号。
- 歌单完整管理：新增歌单改名/描述、删除、批量加曲、清空、重排序接口，为客户端歌单编辑页做服务端支撑。
- 扫描可观测性增强：扫描状态增加当前文件、已扫描数、导入数、跳过数、错误数，并新增 `/api/admin/scan/cancel` 取消入口。
- 电台去 Daoliyu 化第一步：每日/手动电台选歌优先读取自有 `music_tracks` 和 `music_play_history`，只有本地无曲目时才 fallback 到旧 Daoliyu。
- 自有 NAS 音乐第三批验证：本地临时库验证旁路 LRC 保留换行并解析时间轴、歌单批量/重排/删除、元数据 PATCH、扫描状态和本地电台选歌。
- 自用版元数据刮削第一批：新增公开刮削工作流 `/api/admin/metadata/scrape/status|preview|missing|apply`，核心仓库只保留插件协议和服务端预览/应用逻辑，真实 provider 放 ignored 的 `private_plugins`。
- 私有刮削插件协议：新增 `services/agent-server/app/metadata_plugins/README.md`，定义 `search(config) -> list[dict]` 候选格式；新增 `METADATA_PLUGIN_DIRS` 配置和 `music-sources.env.example` 示例。
- 本地私有刮削模板：在 ignored 的 `services/agent-server/private_plugins/local_metadata.py` 增加 JSON 候选 provider，用 `MUSIC_METADATA_JSON` 做本地测试数据源，后续 QQ/网易云/sqmusic 可按同协议扩展。
- 自用版刮削验证：临时曲库用 `local_metadata` provider 完成 preview、missing、apply，成功把歌手、专辑、年份、流派、LRC 歌词写回 `music_tracks`，并确认真实私有插件路径被 git ignore。
- 真实联网刮削验证：在 ignored 的 `services/agent-server/private_plugins/netease_metadata.py` 实现网易云私有 provider，真实调用网易云搜索、歌曲详情和歌词接口；端到端测试确认 preview 返回候选，apply 后歌词写入 SQLite，封面下载到 `MUSIC_COVER_DIR`，并可通过 `/v1/music/covers/{id}` 返回 `image/jpeg`。
- QQ 音乐真实刮削验证：在 ignored 的 `services/agent-server/private_plugins/qqmusic_metadata.py` 实现 QQ 音乐私有 provider，真实调用 QQ 搜索和歌词接口；测试《晴天》命中 `周杰伦 / 叶惠美` 原曲，下载 QQ 专辑封面，写入 LRC 歌词并通过 `/v1/music/covers/{id}` 返回封面图片。
- 元数据刮削任务化：新增 `music_metadata_scrape_jobs/music_metadata_scrape_candidates` 表和 `/metadata/scrape/jobs` 后台任务接口，批量刮削会保存每首歌候选、置信度、应用状态和错误；支持高置信度自动应用，也支持后续手动应用已保存候选。已用本地私有 provider 验证任务创建、候选保存、自动应用和进度显示。
- sqmusic 接口文档接入：读取 `sqmusic_api.json` 后新增 ignored 的 `sqmusic_metadata.py` 私有 provider，按 `/api/music/searchSong` 搜索、`/api/music/getLyric` 获取 LRC，并把搜索结果的 `pic` 作为封面候选；公开仓库只更新 `SQMUSIC_BASE_URL`/`SQMUSIC_PLUG_NAMES` 示例配置和协议说明。
- sqmusic 下载桥接：新增 `/v1/music/api/download/sqmusic/status|search|song|tasks|rescan`，服务端只通过 sqmusic 搜索、选择音质和提交下载任务；下载后的缺失歌词/封面不走 sqmusic，`rescan` 会扫描本地曲库并可自动启动 `qqmusic` 元数据刮削任务补全。
- sqmusic 下载真实验证：通过 `kw` 下载英文歌 `Shape of You - Ed Sheeran`，自动选择 `KW_FLAC_2000`，sqmusic 返回任务 `id=58` 且状态轮询为 `success`；新增可选 `SQMUSIC_USERNAME/SQMUSIC_PASSWORD` 登录配置，登录会话只在单次代理请求内使用。Mac 本地无法扫描 NAS 的 `/volume1/media/音乐`，需部署到 NAS 后执行 `rescan` 扫入曲库。
- 电台合并生成第一版：新增 `/v1/music/radio/daily/build`，根据日期、陕西西安天气和最近听歌记录生成电台脚本，MiniMax 对话模型负责文案，MiniMax TTS 生成开头/结束口播，中间串入本地音乐文件，最后用 ffmpeg 合并为完整 MP3；本地缺歌时会尝试 sqmusic 下载，下载后扫描曲库并启动 `qqmusic` 歌词/封面刮削。Docker 镜像新增 ffmpeg 依赖。
- NAS 音乐目录收口：Agent Server 音乐库扫描根目录改为三路合并 `/data/media/daoliyu,/data/media/sqmusic,/data/media/local`，分别映射宿主机 `/volume1/media/音乐`、`/volume1/docker/sqmusic/file`、`/volume1/docker/personal-os-agent/data/media`；新增 `/api/admin/scan/full` 作为全量扫描别名，客户端可调用全量/增量/后台扫描接口刷新曲库。
- Flutter 客户端接入新 NAS 能力：桌面音乐页新增增量扫描、全量扫描和 sqmusic 下载入口；“今日电台/生成电台”统一调用新的 `/radio/daily/build` 合并音频接口；合并电台节目在客户端只作为一条完整音频播放，避免把口播、歌曲和 full mix 重复塞入播放队列。
- Flutter macOS 窗口体验修正：原生窗口默认改为 `1440x900`、最小 `1180x760` 并居中打开；macOS 标题栏改为透明隐藏标题，内容延伸到标题栏区域，去掉页面内伪造的最小化/关闭按钮；左侧导航和右侧信息栏增加滚动/高度约束，底部播放栏缩到 108px，减少小窗口 overflow。
- Flutter 桌面音乐页第一轮模块拆分：`desktop_music_home.dart` 从 3489 行降到 1889 行；新增 `pages/desktop_music/desktop_music_models.dart`、`desktop_music_background.dart`、`desktop_music_reference_widgets.dart`、`desktop_music_library_widgets.dart`，把视图枚举、星点背景、参考图风格按钮/卡片/导航、电台条目等拆出；删除旧桌面 UI 残留组件，并把新顶部“导入音乐/刷新”接回 sqmusic 下载和增量扫描逻辑。
- Docker Compose 服务命名更新：服务名从 `agent-server` 改为 `music-server`，容器名从 `personal-os-agent-server` 改为 `mu-music-server`；数据卷和 SQLite 路径暂时保留原值，避免 NAS 重新部署后丢失已有数据和密钥。
- 今日电台重复生成修正：`/v1/music/radio/daily/build` 默认复用当天已经合成好的 ffmpeg 电台节目，不再每次点击都生成重复音频；客户端按 `episode.id` 去重更新列表。MiniMax Chat 电台 prompt 改为更口语化的私人主持人口吻，避免“测试音频、生成中、推荐理由”等生硬文案。
- Claudio 氛围电台第一版：Flutter “今日电台”改为私人 DJ 房间布局，包含 LIVE 状态、动态波形、DJ 开场文本、本期歌单、最近电台、对话面板和音乐画像候选面板；新增 `/radio/chat` 对话接口和 `/radio/memories/{id}/remember|ignore` 记忆确认接口，聊天内容先分类为当前指令、长期偏好候选或普通聊天，长期画像默认待确认，不会自动写死。
- 电台聊天接入 MiniMax M3：`POST /v1/music/radio/chat` 从本地模板回复升级为 MiniMax Chat 调用，M3 会结合已确认音乐偏好和最近对话生成 DJ 回复，并判断当前指令/长期偏好候选/普通聊天；MiniMax 不可用时继续使用本地规则兜底。
- Claudio 竖版视觉复刻第一轮：Flutter “今日电台”切换为居中的竖版播放器卡片，结构参考 Claudio 视频中的黑色头部、Speaking 状态、白色节目卡片、进度条、transcript 区和底部波形播放按钮；新增可复用的动态粒子云背景 `_ClaudioParticleField`，右侧继续保留私人 DJ 对话和音乐画像确认面板。
- Flutter 客户端单用途竖屏化：启动即进入 Claudio/Muo FM 竖版 AI DJ，不再进入旧首页、底部导航、音乐列表、推荐、搜索、歌手、用户等页面；macOS 窗口固定为 `520x860`，禁用缩放和全屏，只保留系统关闭与最小化按钮，方便后续手机端复用同一竖屏体验。
- Claudio 竖屏三状态重构：客户端新增 `CHAT / ON AIR / ME` 三个竖屏状态，默认聊天页承载电台对话与播放控制，播放页承载黑色点阵波形、进度和歌词高亮，画像页承载个人音乐画像、标签和记忆统计；顶部增加黑白主题切换。粒子背景升级为点阵+粒子云，画像页支持鼠标悬停后星点向鼠标位置聚集成球体感，播放页支持轻微脉冲氛围。
- Claudio 视觉贴近第二轮：撤掉竖版应用外置普通顶部栏，把导航、主题切换和状态收进 Claudio 面板内部；默认 `CHAT` 页改成整块黑色点阵终端卡片，包含巨大时间、`ON AIR` 胶囊、播放控制条、`QUEUE/TRACKS` 信息、黑色终端聊天气泡和输入栏；播放页和画像页统一内部 Claudio 标题栏，画像页改成更接近参考图的个人主页名片结构。
- 竖屏体验重置为纯背景：按新的设计节奏，临时清空客户端所有可见页面内容，只保留 Claudio 点阵/粒子背景层；播放、电台、聊天、画像等数据和业务方法暂时保留在代码中但不渲染，后续按“一个页面一个页面”重新加回。
- Flutter 客户端字体切换：使用用户提供的 `LXGWWenKai-Regular.ttf` 作为新全局字体，注册字体族 `LXGWWenKai` 并替换原 `CustomFont`；旧 `1.ttf` 暂时保留但不再作为全局字体使用。
- 纯背景页增加主题切换：在竖屏背景基线上仅加入右上角 `DARK/LIGHT` 分段开关，复用现有 `ThemeStore` 与 `AppColors`，不恢复其它页面元素，方便后续逐页搭建。
- NAS DJ Agent Claudio 流程第一版：新增 `/v1/dj` 协议层和 `dj_profile_documents/dj_plans` 表，把 `taste.md`、`routines.md`、`mood-rules.md`、Migi-inspired 口吻技能、天气、听歌画像、最近播放、记忆和执行轨迹组装成 context window；MiniMax M3 输出结构化 `say/play/reason/segue/memoryCandidate`，客户端后续可直接按 DJ Agent 流程接入。
- 私人 DJ 画像和每日歌单规则写入：默认语料加入用户明确偏好（周杰伦、Beyond、《后来》《喜欢你》、避开太吵/土嗨/喊麦、工作偏纯音乐且节奏强、上午中文歌、下午提神、晚上安静、结合天气推荐、每期 3 首、口播 30 秒以上但不拖长）；每日定时从 07:30 改为 07:00，并新增 `/v1/dj/today` 供客户端首次进入读取当天节目，必要时可 `autoBuild=true` 自动补生成。
- 全天歌单定时升级：07:00 定时任务和 `/v1/dj/today?autoBuild=true` 改为生成全天三阶段电台，上午/中午下午/晚上各 3 首，每个阶段都有单独口播，最后合并成一条完整 MP3；客户端首次进入只读取当天节目并播放，不需要用户像 mmguo 一样手动输入。
- 全天电台混音升级：服务端合成从硬拼接改为 ffmpeg 混音流程，口播后进入歌曲时歌曲开头自动降音量，片段之间使用 `acrossfade` 淡入淡出，避免生硬切换；新增 `RADIO_MIX_CROSSFADE_SECONDS`、`RADIO_MIX_DUCKING_VOLUME`、`RADIO_MIX_MUSIC_VOLUME` 可调参数。
- DJ 聊天播放动作协议：`POST /v1/dj/chat` 现在会随回复返回 `action`，支持 `play_episode` 播放今日完整电台、`play_tracks` 播放本地曲库中的推荐歌曲队列、`build_and_play_today` 自动补生成今日电台后播放，以及 `none` 纯聊天；聊天请求不会阻塞等待 sqmusic 下载，找不到单曲时回退到今日电台动作。
- 缺歌队列和全局补库定时：新增 `music_missing_track_queue`，聊天/电台推荐中本地匹配不到的歌会先记录到队列；后台调度每天 07:00 到 20:00 每 2 小时处理一批，先扫描匹配已下载歌曲，再对仍缺失的歌提交 sqmusic 下载，随后重新扫描并启动 QQ 音乐歌词/封面刮削；新增 `/v1/dj/missing-tracks` 和 `/v1/dj/missing-tracks/process` 查看/手动处理。
- NAS 部署探针：新增公开接口 `GET /version`，不需要账号密码，返回当前服务版本 `v0.1` 和 `dj/daypartRadio/missingTrackQueue/mixedRadio` 功能开关；以后 NAS 重建镜像后先访问这个接口判断是否已经运行新代码，再测需要登录的 `/v1/*` 接口。
- Flutter 竖屏 DJ 聊天/电台修正：客户端新增 root-level `/v1` 请求通道，`/dj/chat` 和 `/dj/today` 不再错误拼成 `/v1/music/dj/*`；聊天失败会在界面追加 Migi 错误气泡，回车键改为单行发送；新增 `clients/mu-music/scripts/run_macos_private.sh` 从 ignored 的 `data/secrets/agent-server.env` 注入 Basic Auth，避免把账号密码写进源码。
- 今日电台可播放兜底：客户端首次进入改为读取 `/v1/dj/today?autoBuild=true`，找到或生成当天节目后写入播放队列；播放按钮在播放器未加载时会先加载当前电台/歌曲再播放。服务端 `/v1/dj/today` 捕获全天三阶段生成异常，自动降级到 mockTTS 的简化混音电台，兜底也失败时返回 JSON 错误而不是 HTTP 500 空白。
- Flutter 客户端本地鉴权配置：新增 `ClientConfig` 启动读取逻辑，客户端优先从 ignored 的 `clients/mu-music/private/client_config.env` 或 `~/.mu_music/client_config.env` 读取 `AGENT_SERVER_USERNAME/AGENT_SERVER_PASSWORD`，再 fallback 到 `--dart-define`；已从 `data/secrets/agent-server.env` 同步生成两份本机私有配置文件，真实账号密码不进入 git。

- NAS DJ 供应商切换：主路径从 MiniMax 改为 0029 OpenAI-compatible 文本模型 + Fish Audio `s2.1-pro-free` TTS；真实 Fish key 写入 ignored 的 `data/secrets/agent-server.env`，MiniMax 字段清空停用，0029 key 预留 `OPENAI_COMPAT_API_KEY`。
- 今日电台播放形态调整：`/v1/dj/today` 不再复用/生成 ffmpeg 合并长音频，改为 Claudio/mmguo 式 playlist segments（阶段口播、真实歌曲、收尾口播）；新增 `/v1/music/radio/episodes/{episode_id}/segments/{segment_id}/stream` 用于播放每段口播。

- 0029 文本模型配置调整：`OPENAI_COMPAT_MODEL` 从默认示例 `gpt-4o-mini` 统一改为 `gpt-5.5`，真实 ignored 的 `data/secrets/agent-server.env` 也已同步更新。

- DJ 记忆与每日生成落库：新增 `radio_daily_generations`、`radio_daily_tracks`、`radio_spoken_segments`，每天电台生成会保存文案、天气、歌曲、推荐理由和 Fish 口播文件信息；新口播音频命名使用 `migi-YYYY-MM-DD-...`。聊天确认词接入：`记住` 写长期记忆并追加到画像文档，`这次有效` 标记 session-only，`忽略` 丢弃候选。

- 每日电台旧记录回填：数据库初始化时会扫描 `music_radio_episodes` 旧节目，从 `episode_date`、标题日期或 script JSON 中识别日期，并把可解析的 segments 回填到 `radio_daily_generations`、`radio_daily_tracks`、`radio_spoken_segments`；已存在当天记录时跳过，避免覆盖新数据。

- 接口收口第一批：客户端停止调用旧 `/v1/music/radio/*` 控制接口和 Daoliyu 登录接口，改为 `/v1/dj/status`、`/v1/dj/chat`、`/v1/dj/today`、`/v1/dj/memories/*`；服务端不再注册旧 `music_router`，删除 `music.py` 中旧 Daoliyu OpenAPI 列表、旧 radio 生成/聊天/jobs 路由和旧代理流 helper，仅在 `local_music.py` 保留 episode 音频流读取接口以兼容已有 `streamUrl`。

- NAS 部署探针版本提升：公开接口 `GET /version` 从 `v0.1` 提升到 `v0.2`，NAS 重新构建镜像后访问该接口即可确认是否已经运行最新服务代码。

- NAS 启动错误修复：服务启动时 `listening.py` 仍从 `music.py` 导入已移除的 Daoliyu helper，导致 uvicorn import 阶段崩溃；已改为听歌同步和电台最近播放都只读取本地曲库/播放历史，不再依赖旧 Daoliyu 代理函数。

- NAS 启动修复验证：使用 Python 3.12 临时环境安装 `services/agent-server/requirements.txt` 后成功导入 `app.main`；FastAPI TestClient 请求 `GET /version` 返回 200，版本为 `v0.2`。

- 旧数据库迁移修复：`music_radio_episodes` 旧表没有 `episode_date` 列时，`SCHEMA` 里提前创建 `idx_music_radio_episodes_date` 会导致启动阶段 `no such column: episode_date`；已把该索引移到 `ensure_column` 补列之后创建，并用旧表模拟验证迁移成功。

- Flutter 桌面端 DJ 播放动作接入：聊天返回的 `play_episode`、`play_tracks`、`build_and_play_today` 现在会直接切换播放队列并加载音频；`normalizeTrack` 保留后端 action 的 `streamUrl`，今日电台首次自动读取后会直接初始化播放器。验证：`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，`flutter build macos --debug` 成功生成 `mu_music.app`。

- Flutter 客户端鉴权修复：`HttpUtil` 改为每次 GET/POST/PUT/DELETE 请求动态合并 `ClientConfig` 的 Basic Auth header，避免 Dio 单例早于配置加载或请求自带 Options 时丢失账号密码，修复 `/v1/dj/today` 401 和音频流 401 导致的 macOS `NSURLErrorDomain -1013`。

- Flutter macOS 鉴权配置打包：由于 macOS app sandbox 可能读不到项目目录或 `~/.mu_music/client_config.env`，`ClientConfig` 新增 bundle asset fallback；`private/client_config.env` 加入 Flutter assets，但该文件仍被 `.gitignore` 忽略，不进入 git。

- Flutter 竖屏聊天布局修复：聊天消息改为显示最新 80 条，消息不足一屏时从输入框上方开始向上堆叠；发送/回复/刷新后增加延迟二次滚动，避免新回复因为布局高度尚未计算完成而停在上方。

- Flutter DJ 今日电台超时修复：`/v1/dj/today?autoBuild=true` 属于长任务接口，客户端 receiveTimeout 从默认 15 秒提升到 180 秒；root/music 请求顺序改为固定优先局域网地址，再尝试公网，避免上次 activeBaseUrl 为公网时下次仍先走公网。

- Flutter 电台旧流 404 修复：客户端不再把缺少 `segments` 的旧电台记录回退为完整 episode stream，避免请求 `/v1/music/radio/episodes/{id}/stream` 时因无 full mix 文件而 404；缺少分段时会触发重新生成今日电台。`autoBuild=true` 超时提升到 600 秒，适配 AI 文案/TTS/歌曲匹配较慢的生成链路。

- 聊天消息顺序修复：客户端按 `clientOrder/createdAt` 稳定排序，同一时间戳时固定 user 在 assistant 前，避免回复显示到用户消息上方；服务端新写入聊天 turn 时 assistant 的 `created_at` 比 user 延后 1ms，从源头保证同轮对话顺序。

- NAS DJ 旧合并兜底移除：`/v1/dj/today` 主路径失败时不再降级调用 `create_daily_radio_mix_episode` / full mix 合并模式；所有兜底均改为 `create_daily_radio_daypart_episode` 分段节目，优先 mockTTS，必要时本地规则文案 + mockTTS，确保后台不会再生成旧拼接/混音电台。

- NAS 服务版本提升：`GET /version` 从 `v0.2` 提升到 `v0.3`，用于确认已部署“不再降级旧 full mix 合并模式”的服务端代码。

- NAS DJ 生成状态修复：`GET /v1/dj/today?autoBuild=true` 在曲库为空或生成失败时不再误报“已生成”，会返回真实错误原因；`GET /v1/dj/status` 新增内置定时器状态、每日生成时间、时区和下一次运行时间；服务版本提升到 `v0.3.1`。

- NAS DJ 口播诊断修复：发现今日电台使用 `mock-tts`，实际生成的是 440Hz WAV 测试音而非人声；`/v1/dj/today` 不再在 TTS 失败时自动降级 mock 口播，`/v1/dj/episode/build` 会返回明确异常类型；新增 `POST /v1/dj/tts/probe` 用于测试 NAS 到 Fish Audio 的真实 TTS 连通性；Fish TTS 请求超时提升并补充 HTTP 异常详情；服务版本提升到 `v0.3.2`。

- Flutter 客户端接入口播自检和真人口播重生成：新增 `probeDjTts`、`buildDjEpisode` API 封装；播放今日电台前如果检测到旧 `mock-tts`/WAV 测试口播，会先调用 Fish TTS 探针，成功后强制重生成 `fish-tts` 分段电台并播放；电台队列末尾自动追加本期真实歌曲，让收尾口播结束后继续播放音乐而不是停在口播队列末尾。验证：`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，`flutter build macos --debug` 成功。

- Flutter 歌词/口播文本自动滚动：为无时间戳的口播文本和 fallback 歌词增加独立滚动控制器，根据当前播放进度估算高亮行并自动居中滚动；有 LRC 时间戳的歌词继续使用 `GlobalMusicController.lyricScrollController` 按时间戳滚动。验证：`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，`flutter build macos --debug` 成功。

- Flutter 口播文案显示修复：电台分段播放项的 `lyrics` 改为优先使用 segment 自带 `text`，竖屏 `LYRIC` 面板优先显示当前播放项的口播/歌词文本；播放上午、中午/下午、晚上或收尾口播时会显示对应段落内容，而不是整期脚本或固定 intro。验证：`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过。

- Flutter/NAS 播放流与聊天输入修复：服务端 `music_radio_episodes` 返回新增 `playbackFlow`，服务版本提升到 `v0.3.3`；客户端优先按 `playbackFlow` 组装“口播 -> 歌曲 -> 口播 -> 续播歌曲”的单一播放队列，不再把口播工作流和音乐工作流分开处理；聊天发送改为先失焦并延后一帧清空输入框，避免 `TextEditingController` 通知异常；聊天排序补充 `created_at/updatedAt` 解析和稳定顺序兜底，避免回复跑到用户消息上方；竖屏 `LYRIC` 面板切歌时重新读取当前播放项，口播显示正文，歌曲段显示推荐理由作为歌词兜底。验证：`python3 -m py_compile services/agent-server/app/*.py` 通过，`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，本轮未打包 macOS。

- Flutter/NAS 歌词与 Claudio 播放方向调整：确认 Claudio FM 是口播音频和歌曲音频双音轨同时播放，后续按“音乐流持续播放 + 口播流插话 + 音乐 ducking 压低/恢复”实现；本轮先修歌词和高亮样式，新生成的 NAS 电台 track segment 会带 `lyrics`、`coverArtUrl`、`reason`，服务版本提升到 `v0.3.4`；竖屏歌词高亮改为只改变文字颜色，不再给当前行添加背景块。验证：`python3 -m py_compile services/agent-server/app/*.py` 通过，`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，本轮未打包 macOS。

- Flutter 聊天输入异常字符修复：电台聊天发送改为使用 `onSubmitted` 传入文本，所有电台聊天输入框统一增加 formatter，过滤 `┤├` 和控制字符；发送后延迟重置 `TextEditingValue`，避免 macOS/IME 在 `TextEditingController` 正在通知时同步 clear 引发报错。验证：`dart format` 通过，`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，本轮未打包 macOS。

- Flutter NAS 地址兜底修复：默认请求候选地址移除 `127.0.0.1:8088` 和 `localhost:8088`，避免 NAS 不在本机时聊天请求最终报 connection refused；本机调试仍可通过 `NAS_LOCAL_API_URL` / `NAS_LOCAL_ROOT_API_URL` 显式配置。聊天错误展示改为中文短提示，不再把完整 `DioException` 堆栈塞进聊天气泡。验证：`dart format` 通过，`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，本轮未打包 macOS。

- Flutter DJ 聊天超时修复：`/v1/dj/chat` 属于模型/记忆/播放动作接口，默认 15 秒 receiveTimeout 太短；客户端单独把聊天请求接收超时提升到 120 秒、发送超时 20 秒，避免 Migi 正常思考时被客户端提前中断。验证：`dart format` 通过，`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，本轮未打包 macOS。

- NAS/Flutter Claudio 双音轨第一版：`/v1/dj/chat` 返回新增 `spoken` 口播音频信息，服务端新增 `/v1/dj/spoken/{plan_id}/stream` 输出 Migi 口播 mp3；客户端新增第二个 `AudioPlayer` 播放口播，口播开始时主音乐音量 ducking 到 28%，口播结束后恢复，实现“主音乐流持续播放 + 口播流插话”的 Claudio 模式。服务版本提升到 `v0.3.5`。同时修复点播强匹配：服务端从“播放/点播/听听 + 歌名”中直接提取歌曲名先查本地曲库，`/v1/music/api/tracks` 兼容 `query/q/keyword` 三种搜索参数。验证：`python3 -m py_compile services/agent-server/app/*.py` 通过，`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过，本轮未打包 macOS。

- Docker Compose 配置精简：`docker-compose.yml` 移除当前流程不再需要的 MiniMax 环境变量、Daoliyu 代理 URL 和旧 ffmpeg mix 参数，保留 NAS 音乐路径、0029 文本模型、Fish TTS、天气/定时、缺失下载和 sqmusic 基础配置；新增 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY` 代理变量占位，真实密钥仍只放 `/data/secrets/agent-server.env`。验证：Ruby YAML 解析通过，`python3 -m py_compile services/agent-server/app/*.py` 通过；本机无 `docker` 命令，未运行 `docker compose config`。

- Docker Compose 代理固定：按 NAS 部署习惯把 `HTTP_PROXY` 和 `HTTPS_PROXY` 从外部变量占位改为固定 `http://192.168.10.4:7897`，避免图形界面重新部署时环境变量丢失；`NO_PROXY` 继续保留默认局域网/本机排除列表。验证：Ruby YAML 解析通过，`python3 -m py_compile services/agent-server/app/*.py` 通过。

- NAS 启动错误修复：FastAPI 不接受路由返回类型标注 `FileResponse | JSONResponse` 作为 response model，导致 `/v1/dj/spoken/{plan_id}/stream` 注册阶段启动失败；已为该路由设置 `response_model=None` 并移除 union 返回注解。验证：`python3 -m py_compile services/agent-server/app/*.py` 通过；本机缺少 FastAPI 依赖，未做完整 app import。

- Flutter/NAS 点播与双音轨修复：确认线上 `GET /version` 为 `v0.3.5`，但《夜曲》在 NAS 本地曲库搜索结果为 0，`/v1/dj/chat` 退回了周杰伦其他歌曲；本轮把服务端点播逻辑改为强点播优先，缺歌时立即加入缺失下载/刮削队列，不再假装已播放相似歌，并把服务版本提升到 `v0.3.6`。客户端修复 `/v1/dj/spoken/...` 口播 URL 解析，避免错误拼成 `/v1/music/v1/dj/...`，Migi 插话才能进入第二音轨并触发 ducking；修复 sqmusic 客户端路径缺少 `/api` 的问题；DJ action track 增加 `lyrics` 字段，客户端音乐搜索改为把 keyword 传给 NAS 服务端。验证：`dart format` 通过，`python3 -m py_compile services/agent-server/app/*.py` 通过，`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过；本轮按要求未打包 macOS。

- Flutter/NAS 首次进入电台双音轨修复：客户端不再让 `full_mix` 合并音频抢占入口，电台播放列表改为只放真实歌曲，把前置 Migi 口播挂到下一首歌的 `radioSpokenStreamUrl` 上，歌曲开始后由全局第二播放器自动播放口播并 ducking 主音乐；歌词解析器扩展支持 `[mm:ss]`、`[mm:ss.xx]`、`[mm:ss.xxx]`、`[mm:ss:xx]` 和纯文本歌词，避免歌词格式稍有不同就解析为 0 行。NAS 服务版本提升到 `v0.3.7`；Fish TTS 新增固定 `FISH_TTS_REFERENCE_ID=802e3bc2b27e49c2995d23ef70e6ac89`，所有 Migi 口播统一使用同一个较有磁性的男声音色；DJ 点播播放前若发现歌曲缺歌词/封面，会后台触发 QQ 音乐元数据刮削任务。

- Flutter/NAS 点播、歌词、喜欢列表修复：NAS 服务版本提升到 `v0.3.8`；本地曲库点播匹配改为同时查 `title/file_name/source_path`，并把文件名/路径命中作为强匹配，修复“本地有《后来》但聊天仍提示缺歌”的情况；客户端搜索二次过滤也纳入 `fileName/filePath/sourcePath`，避免服务端已搜到又被前端过滤。缺歌词/封面时刮削任务现在可以指定当前播放歌曲 ID，不再随机扫全库缺失项；扫描曲库时会保留已刮削歌词和封面，不会被空标签覆盖。Fish Audio 默认音色改为 `802e3bc2b27e49c2995d23ef70e6ac89` 的男声，`/v1/dj/tts/probe` 成功返回修复。竖屏播放器新增可拖动进度条、当前播放列表弹层、喜欢歌曲弹层；点击心会调用 NAS 喜欢接口落库，喜欢列表可“播放全部”并替换当前队列。验证：`python3 -m py_compile services/agent-server/app/*.py`、`dart format`、`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过；本轮按要求未打包 macOS。

- Flutter/NAS 播放列表重复、首播口播和歌词链路修复：NAS 服务版本提升到 `v0.3.9`；客户端移除电台播放列表中把真实歌曲再追加一遍的 `continuation_track` 逻辑，播放列表弹层、点播、喜欢列表和今日电台写入队列前统一按歌曲 ID 去重。启动时不再把曲库第一首普通歌写入 `currentTrack` 占位，今日电台自动播放改为检查真实播放器是否已加载/播放，避免首次进入被占位歌曲拦截而不播放 Migi 口播；手动写入播放列表时短暂抑制 playlist listener，避免同一首歌双加载打断口播。歌词显示增加后台兜底：如果当前 NAS track 没有歌词，客户端会提交当前歌曲的定向 QQ 元数据刮削任务并轮询刷新，拿到歌词后自动更新当前歌词面板。部署层新增 `services/agent-server/private_plugins` 到 `/data/private_plugins/music_metadata` 和 `/data/private_plugins/music_sources` 的只读挂载；线上探测显示当前 `v0.3.8` 的 `providers` 为空，重新部署后应能看到 `qqmusic` provider。验证：`python3 -m py_compile services/agent-server/app/*.py`、`ruby YAML.load_file("docker-compose.yml")`、`dart format`、`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过；本轮按要求未打包 macOS。

- NAS 媒体库导入修复：线上验证 `GET /version` 仍是 `v0.3.8`，且 `/v1/music/api/tracks?keyword=后来` 返回 0；sqmusic 可搜索并下载《后来 - 刘若英》，下载任务已有成功记录，但本地媒体扫描 382 个文件时只有 22 首跳过、361 个失败，导致已下载歌曲没有进入 `music_tracks`。本轮把服务版本提升到 `v0.4.0`，新增 `music_tracks` 旧库字段迁移，修复老 SQLite 表结构导致新文件导入失败的问题；扫描错误信息改为在 `str(error)` 为空时返回异常类型，避免 NAS 扫描报告出现空白错误。验证：`python3 -m py_compile services/agent-server/app/*.py`、`ruby YAML.load_file("docker-compose.yml")`、SQLite 旧表补字段等价测试通过；本轮按要求未打包 macOS。

- NAS 缺歌定时流水线补扫描：服务版本提升到 `v0.4.1`；`process_missing_track_queue()` 现在会返回处理前增量扫描、下载后增量扫描和刮削任务信息。缺歌下载后创建 QQ 音乐歌词/封面刮削 job 时新增 `scanAfterComplete=true`，刮削后台线程结束后会自动再跑一次 `scan_local_music_library(incremental=True)`，避免定时任务下载完、歌词刮完后曲库仍然需要手动刷新。验证：`python3 -m py_compile services/agent-server/app/*.py` 通过；本轮按要求未打包 macOS。

- Flutter 首次进入今日电台口播修复：线上 `/v1/dj/today` 验证今日节目 `playbackFlow` 首段为 `stage_intro` 且有口播 stream，问题在客户端入口判断过于保守以及口播只依赖播放器内部延迟触发。客户端现在在没播放时会自动接管今日 episode，不再被旧 `currentMusic` 或历史 playlist 卡住；`GlobalMusicController` 新增口播触发去重，`_playRadioEpisode()` 加载第一首歌后会主动兜底触发 Migi 口播，避免刚进入只播音乐不播文案。验证：`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过；本轮按要求未打包 macOS。

- Flutter 口播延迟到首次暂停的根因修复：确认 `GlobalMusicController.loadMusic()` 中 `await _audioPlayer.play()` 会一直等到主音乐被暂停/结束后才继续执行，导致排队 Migi 文案口播的代码在“第一次暂停”后才运行。主音乐播放现在改为非阻塞 `_startAudioPlayback()`，并把口播挂起到主播放器 `ready + playing` 状态后触发；切换播放、上一首/下一首中的 `_audioPlayer.play()` 也改为非阻塞启动，避免播放流程卡住后续逻辑。验证：`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过；本轮按要求未打包 macOS。

- Fish Audio 口播音色切换：已将 Migi 默认 Fish `FISH_TTS_REFERENCE_ID` 从旧男声切换为用户试听确认的中文口播音色 `c43ae8e1c3664eac9203f9293fabc3c9`，同步更新 `docker-compose.yml`、服务端默认配置和 README 示例；真实 Fish API key 仍只从 secret env 读取，不写入仓库。验证：`python3 -m py_compile services/agent-server/app/*.py`、`ruby YAML.load_file("docker-compose.yml")` 通过；本轮按要求未打包 macOS。

- NAS 下载歌曲读不到修复：线上 `v0.4.1` 增量扫描可见 `/data/media/daoliyu`、`/data/media/sqmusic`、`/data/media/local` 三个根目录，说明挂载正常；但扫描 382 个音频时只有 22 首跳过、361 首导入失败，失败类型均为 `ValueError`，导致已下载的《后来》没有进入 `music_tracks`，客户端搜索自然读不到。本轮将元数据解析失败改为降级入库：Mutagen 读取时长异常、返回 `NaN`/无穷大/异常字符串时降级为 0 秒；标签读取失败时仍按文件名、路径、文件大小和修改时间生成可播放记录。另修复 `刘若英-后来.flac` 这类 sqmusic 文件名兜底解析，确保歌手为“刘若英”、歌名为“后来”，不会被父目录名干扰；服务版本提升到 `v0.4.2`。验证：`python3 -m py_compile services/agent-server/app/*.py`、`ruby YAML.load_file("docker-compose.yml")` 通过；Python 3.13 临时 venv 下 `python -m unittest discover -s services/agent-server/tests -v` 通过。

- 文档补充 0029 中转入口：根 README、服务端 README 和 data README 中的 0029 文案/配置说明已补充入口链接 `https://www.0029.org/?promo=AFF1K9`，方便后续查看和配置 OpenAI 兼容中转；未修改任何密钥或运行时配置。

- NAS 扫描报告语义修正：线上 `v0.4.2` 验证通过，增量扫描后曲库从 22 首变为 382 首，`/v1/music/api/tracks?keyword=后来` 已能返回《后来 - 刘若英》，音频流 `/v1/music/audio/51276ab09eb94ce85edae9b5` 返回 `206 Partial Content`，说明下载文件已可播放；但降级导入成功的文件仍计入 `errorCount`，扫描报告看起来像失败。本轮将“元数据读取失败但已按文件名导入”的记录移到 `fallbacks/fallbackCount`，真正导入失败才进入 `errors/errorCount`，服务版本提升到 `v0.4.3`。

- Flutter 客户端正式命名和 release 打包：应用展示名改为 `Migi`，macOS/Android/iOS/Web 图标使用新的 Migi 图标资源，macOS bundle id 与 Android application id 统一为 `com.xuguopeng.migi`。验证：`flutter analyze --no-fatal-infos --no-fatal-warnings` 通过；`flutter build macos --release` 成功生成 `clients/mu-music/build/macos/Build/Products/Release/Migi.app`；`flutter build apk --release` 成功生成 `clients/mu-music/build/app/outputs/flutter-apk/app-release.apk`；并额外整理 `clients/mu-music/build/distribution/Migi-macos-release.zip` 和 `clients/mu-music/build/distribution/Migi-android-release.apk` 方便安装分发。
