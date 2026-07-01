# Personal OS Agent Design

Date: 2026-06-29

## Goal

Build a local-first personal desktop OS with an Agent at the center. The app should combine personal creation, knowledge, entertainment, and workflow modules into one Tauri 2 desktop application. The long-term vision is that the user can chat with the Agent to operate modules such as novel writing, music, blogging, comics, stickers, and video canvas.

The first version focuses on a usable foundation:

- A React + shadcn/ui + Tauri 2 desktop app.
- A transparent Agent that can chat, understand module commands, and create task drafts.
- A local memory system that helps the Agent understand the user over time.
- A knowledge base for project files, creative assets, notes, and documents.
- A visible process log that shows every module, MCP, skill, and tool call.
- First usable modules: novel, music, and blog.
- Placeholder entries for comics, stickers, infinite canvas, video, and future modules.

## Product Direction

This is not a collection of disconnected tools. It is a Personal OS with three cooperating surfaces:

1. Workspace: the current module's real working area.
2. Agent Chat: natural language and explicit module commands such as `@小说`, `@音乐`, and `@博客`.
3. Process Log: an expandable bottom panel that shows the Agent's workflow and tool usage.

The Agent should be powerful, but not a black box. When it works, the user should see what it understood, what it searched, what memory it used, what MCP or skill it called, what module action it prepared, and where the result was saved.

## Technical Direction

Use a new project based on:

- Tauri 2
- React
- shadcn/ui
- TypeScript
- Local database storage

The existing `Tauri2Public` project should be treated as a reference for reusable Tauri patterns and common code, not as the final app shell. This keeps the long-term UI ecosystem aligned with shadcn/ui while still allowing useful code to be copied or adapted.

## Layout

The main app layout has two vertical zones.

Top zone:

- Left: Workspace.
- Right: Agent Chat.
- Default split: 50 / 50.
- The divider is draggable.
- If the workspace becomes smaller, chat becomes larger.
- If chat becomes smaller, workspace becomes larger.
- Both sides have minimum widths to prevent layout collapse.

Bottom zone:

- Process Log accordion.
- It can be collapsed, half-expanded, or expanded.
- It should auto-expand when a task is running.
- It should stay compact when the user is mainly working in a module or chatting.

The workspace toolbar is module-specific. It is not a fixed global set of buttons.

Examples:

- Novel: outline, continue writing, export manuscript.
- Music: play, pause, favorite, open playlist.
- Blog: draft, publish, archive, export, channel settings.

## First Version Scope

Core foundations:

- Agent chat.
- Module command routing.
- Local memory.
- Knowledge base.
- Process log.
- MCP and skill registry.
- Task drafts and confirmation flow.
- Local backup import/export.

First usable modules:

- Novel workspace.
- Music workspace.
- Blog workspace.

Placeholder modules:

- Comics.
- Stickers.
- Infinite canvas.
- Video generation.
- Additional personal tools.

Video canvas direction:

- The app should reserve a video canvas workspace for AI video generation and editing.
- Palmier Pro should be treated as an external video editor engine first, not copied directly into the Tauri app.
- The Agent can connect to Palmier Pro through its local MCP server when Palmier Pro is open.
- The video canvas module should show connection status, project status, timeline actions, generation jobs, and export results.

## Agent Behavior

The first version should use a confirmation-first model.

The Agent can:

- Understand natural language.
- Recognize explicit module commands such as `@小说 写一章都市小说`.
- Read relevant memory and knowledge.
- Choose a skill, MCP, or module tool.
- Create a task draft.
- Show proposed actions.
- Ask for confirmation before saving important results or executing larger actions.

The Agent should not silently perform destructive or high-impact actions. The user must be able to inspect and confirm the proposed workflow.

## Data Layers

The app should separate data into three major stores: knowledge base, memory base, and task log.

### Knowledge Base

The knowledge base stores material and reference information.

Examples:

- Product docs and product wiki files.
- Novel settings, character profiles, outlines, and chapters.
- Comic scripts and storyboard notes.
- Sticker character settings.
- Blog drafts and source material.
- Public account article material.
- Music and video metadata.
- File summaries, webpage summaries, PDF summaries, and imported documents.

The knowledge base answers: "What material do I have?"

Required fields:

- `id`
- `title`
- `content`
- `summary`
- `type`
- `project`
- `module`
- `tags`
- `source_path`
- `created_at`
- `updated_at`
- `embedding_status`

It should support:

- Full-text search.
- Tag filtering.
- Project filtering.
- Module filtering.
- Vector search.
- Manual import and export.

### Memory Base

The memory base stores information about the user.

Examples:

- Creative preferences.
- Writing style preferences.
- Work habits.
- Preferred workflows.
- Entertainment preferences.
- Project preferences.
- Personal brand tone.
- Things the user dislikes or has disabled.

The memory base answers: "How should the Agent understand and adapt to me?"

Required fields:

- `id`
- `type`
- `content`
- `summary`
- `source`
- `source_event_id`
- `confidence`
- `enabled`
- `created_at`
- `updated_at`

Memory types:

- Creative preference.
- Work style.
- Life and entertainment.
- Project context.
- Character or brand setting.
- Disabled memory.

The first version should not silently write long-term memory. It should create memory candidates and ask the user to confirm before saving them.

The user must be able to:

- View memory.
- Edit memory.
- Disable memory.
- Delete memory.
- Export memory backup.
- Import memory backup.

When memory is used in a task, the process log should show which memories were used.

### Task Log

The task log stores what happened.

Examples:

- User message.
- Detected intent.
- Module route.
- Memory query.
- Knowledge query.
- MCP call.
- Skill call.
- Module tool call.
- Inputs and outputs.
- Result path.
- Errors.
- Duration.
- Token usage.

The task log answers: "What did the Agent do, and why?"

Required fields:

- `id`
- `session_id`
- `task_id`
- `step_type`
- `module`
- `tool_name`
- `input_summary`
- `output_summary`
- `status`
- `error`
- `duration_ms`
- `token_input`
- `token_output`
- `created_at`

The task log is for observability and review. It should not be loaded into the Agent context by default. The Agent should only retrieve recent or relevant task log summaries when needed.

## Retrieval Strategy

The Agent must not load the entire knowledge base or memory base into the model context.

Retrieval should be staged:

1. Identify intent and target module.
2. Filter by module, project, type, and tags.
3. Run keyword or full-text search.
4. Run vector search on the narrowed candidate set.
5. Retrieve only the most relevant snippets.
6. Prefer summaries over full documents unless full content is needed.
7. Apply a token budget before sending context to the chat model.
8. Record what was retrieved in the process log.

Example:

User message:

`@小说 继续写请回答1992第一集`

The Agent should retrieve:

- Knowledge base: project `请回答1992`, types such as character setting, episode outline, draft, and source material.
- Memory base: creative preferences for nostalgic writing, novel tone, output format, and pacing.
- Task log: the most recent relevant task summary for `请回答1992`.

It should not retrieve unrelated music, blog, sticker, or global project data.

## Token and Speed Controls

The design should control speed and token usage from the first version.

Required controls:

- Module-level filtering.
- Project-level filtering.
- Tag filtering.
- Summary-first retrieval.
- Top-K retrieval limits.
- Maximum token budget per task.
- Recently used context cache.
- Retrieval logs.
- Separate task log lookup from normal memory lookup.

Recommended first-version defaults:

- Knowledge snippets: 5 to 10 items.
- Memory snippets: 3 to 6 items.
- Recent task summaries: 1 to 3 items.
- Full document loading only after user confirmation or explicit Agent need.

## Vector Index and AI Configuration

Vector index requires an AI embedding model. It should be configured separately from the chat model.

There are two different model roles:

1. Chat model: used for conversation, planning, summarizing, and task drafting.
2. Embedding model: used to convert knowledge and memory text into vectors for semantic search.

The app should expose AI configuration for:

- Chat provider.
- Chat model.
- Embedding provider.
- Embedding model.
- API key or local endpoint.
- Embedding dimension.
- Batch size.
- Re-index button.
- Index status.

The first version should support a local-first storage design even if the AI provider is remote. Embeddings should be stored locally with the indexed records.

When a document, memory, or summary changes:

- Mark its embedding status as stale.
- Recompute embedding in the background.
- Show indexing status in the UI.

If no embedding model is configured:

- The app should still work with keyword and tag search.
- Vector search should show a clear "not configured" state.
- The Agent should continue operating with reduced retrieval quality.

First-version implementation default:

- Store knowledge, memory, settings, and task logs in a local database.
- Use local full-text search for keyword retrieval.
- Put vector search behind a storage adapter so the app can start simple and change vector backends later.
- Do not hard-code one AI vendor into the data model.
- Allow remote embedding APIs or local embedding endpoints through the same settings screen.
- Keep generated embeddings local even when the embedding model is remote.

This means the app needs AI configuration, but not every search depends on AI. Keyword search, tags, project filters, and module filters should work even before embedding is configured.

## MCP, Skill, and Module Tool System

The Agent should call capabilities through a visible registry.

Capability types:

- MCP tools.
- Skills.
- Internal module tools.

Each capability should have:

- Name.
- Type.
- Description.
- Input schema.
- Output schema.
- Permission level.
- Enabled state.
- Last used time.

The user should be able to invoke modules explicitly with `@`.

Examples:

- `@小说 生成一个男频都市开头`
- `@音乐 放一些适合写作的歌`
- `@博客 把今天的想法整理成一篇草稿`

The Agent should show each selected capability in the process log before or during execution.

### Palmier Pro Video Editing Integration

Palmier Pro is a Swift-native macOS video editor that exposes a local MCP server at `http://127.0.0.1:19789/mcp` while the app is open. It is a strong candidate for the video canvas module because the Agent can control timeline editing through MCP instead of reimplementing a full video editor inside the Tauri app.

Recommended integration mode:

- Do not copy Palmier Pro source code into the Tauri app as the first approach.
- Register Palmier Pro as an external MCP capability.
- Add a video canvas module inside this app that acts as a command center and status view.
- Let the Agent call Palmier MCP tools for timeline inspection, media import, clip editing, transcript edits, captions, generation, and export.
- Mirror important MCP calls and results into this app's process log and task log.

Reasons not to directly import the code first:

- Palmier Pro is Swift-native and macOS-focused, while this app is planned as Tauri 2 + React + shadcn/ui.
- Palmier Pro requires macOS 26 on Apple Silicon.
- Palmier Pro is GPLv3, so copying or deriving from its source has license implications.
- Palmier Pro's generative AI processing is not fully open source and requires account/subscription in its own system.

Example chat flows:

- `@视频 导入这个素材，剪掉所有停顿超过 1 秒的地方`
- `@视频 根据这个博客生成 30 秒短视频草稿`
- `@视频 给这段视频加标题、字幕和背景音乐`
- `@视频 检查时间线并导出 1080p`

Example Agent MCP flow:

1. Check whether Palmier Pro MCP is reachable.
2. Call `get_timeline` and `get_media`.
3. Import or generate media when needed.
4. Call timeline tools such as add clips, split clips, remove words, add captions, apply effects, or export.
5. Write every tool call to the bottom process log.
6. Ask for user confirmation before destructive edits or final export.

AI video generation can work in two ways:

- Use Palmier Pro's generation tools when the user is signed in and has credits.
- Use this app's own configured image/video generation APIs, then import generated assets into Palmier Pro for editing.

The second path keeps the Personal OS model configuration independent while still using Palmier Pro as a powerful timeline editor.

## Process Log

The process log is a bottom accordion panel.

It should show:

- Intent detection.
- Memory retrieval.
- Knowledge retrieval.
- MCP calls.
- Skill calls.
- Module tool calls.
- Inputs and outputs as summaries.
- Confirmation points.
- Result locations.
- Errors and retries.
- Token usage.
- Duration.

Log entries should be expandable. The default view should be readable and compact, with detailed input/output hidden until expanded.

## Backup

The first version uses local-first storage with manual backup.

Backup should include:

- Memory base.
- Knowledge metadata.
- Task log metadata.
- App settings.
- AI configuration without secrets by default.

Secrets such as API keys should not be exported unless the user explicitly chooses an encrypted backup mode in a future version.

## Publishing Channels

The blog module should be designed as a writing and publishing workspace, not only a local note editor.

First-version publishing targets to reserve in settings:

- Personal website.
- WeChat public account.

Future publishing targets can include:

- Zhihu.
- Xiaohongshu.
- Video account copy.
- Other custom channels.

Each publishing channel should have:

- Channel name.
- Channel type.
- Enabled state.
- Account or site identifier.
- API endpoint or publishing URL.
- Authentication method.
- Default category.
- Default tags.
- Default cover image behavior.
- Draft mode.
- Publish mode.
- Last sync time.

Sensitive values such as tokens, app secrets, cookies, and API keys should be stored separately from normal settings and should not appear in ordinary backups.

Blog publishing flow:

1. Create or import blog content.
2. Let the Agent adapt the content for a selected channel.
3. Preview title, summary, cover, body, tags, and category.
4. Create a publish task draft.
5. Show the target channel and required API/tool calls in the process log.
6. Ask for user confirmation before publishing.
7. Save the publish result, URL, status, error, and retry information to the task log.

The first version can support manual publishing records even before full API publishing is implemented. For example, the user can mark an article as "published to website" or "published to public account" and paste the final URL. This keeps the data model ready while allowing publishing integrations to be added gradually.

## Implementation Decisions To Confirm

These are not product ambiguities. They should be decided in the implementation plan:

- Local database: use one local database for app data, with migrations from the start.
- Vector backend: start behind an adapter so the first version can choose the simplest stable local option.
- Embedding provider: configure in settings instead of hard-coding a single provider.
- `Tauri2Public` reuse: inspect and copy only reusable Tauri patterns or utilities, not the Vue app shell.
- Music module: first version can start with manual playlist/library records unless local music scanning is explicitly chosen during implementation planning.
- Blog publishing: first version should decide whether website and WeChat public account use real API publishing immediately or start with manual publish records plus saved channel configuration.
