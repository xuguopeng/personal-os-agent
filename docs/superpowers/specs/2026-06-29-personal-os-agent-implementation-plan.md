# Personal OS Agent Implementation Plan

Date: 2026-06-29

Related design:

- `2026-06-29-personal-os-agent-design.md`

## Implementation Goal

Build the first working version of the Personal OS Agent app as a local-first Tauri 2 desktop application with React and shadcn/ui.

The first version should prove these core loops:

1. The user can chat with the Agent.
2. The user can call modules with commands such as `@小说`, `@音乐`, and `@博客`.
3. The Agent can create a task draft instead of silently executing everything.
4. The app can store knowledge, memory, settings, and task logs locally.
5. The user can see the Agent workflow in a bottom process log.
6. The blog module can reserve publishing configuration for a personal website and WeChat public account.

## Milestone 1: Project Foundation

Purpose:

Create the long-term app shell.

Tasks:

- Create a new Tauri 2 + React + TypeScript project.
- Add shadcn/ui and required styling setup.
- Add app routing and base layout.
- Add a settings area.
- Add placeholder navigation for modules:
  - Novel
  - Music
  - Blog
  - Comics
  - Stickers
  - Infinite Canvas
  - Video
- Inspect `Tauri2Public` and copy only reusable Tauri patterns or utilities.
- Reserve Palmier Pro as a possible external MCP video editor integration.

Acceptance criteria:

- App launches in desktop mode.
- Main layout renders.
- shadcn/ui components work.
- Placeholder module pages can be opened.
- No Vue shell code is carried into the new React app.

## Milestone 2: Resizable Layout and Process Log Shell

Purpose:

Create the interface structure that makes the Agent observable.

Tasks:

- Build the top split layout:
  - Left workspace.
  - Right Agent chat.
  - Draggable divider.
  - Linked resizing.
  - Minimum width for both panes.
- Build the bottom process log accordion:
  - Collapsed mode.
  - Half-height mode.
  - Expanded mode.
  - Auto-open when a task starts.
- Add compact process step cards.
- Add expandable step detail panels.

Acceptance criteria:

- Workspace and chat default to 50 / 50.
- Resizing one side automatically resizes the other.
- Layout does not collapse on narrow widths.
- Process log can show mocked steps and expand details.

## Milestone 3: Local Data Layer

Purpose:

Create the storage foundation before adding real Agent behavior.

Tables or collections:

- `knowledge_items`
- `memory_items`
- `memory_candidates`
- `task_sessions`
- `task_steps`
- `app_settings`
- `ai_model_settings`
- `publishing_channels`
- `module_records`

Core requirements:

- Add local migrations from the start.
- Store normal settings separately from secrets.
- Support backup export/import for non-secret data.
- Include timestamps and stable ids.

Acceptance criteria:

- App can create, read, update, and delete local records.
- Settings persist after restart.
- Backup export includes memory, knowledge metadata, task log metadata, app settings, and non-secret AI configuration.
- Secrets are not included in ordinary backup.

## Milestone 4: AI Configuration

Purpose:

Let the user configure models without hard-coding one provider.

Settings groups:

- Chat model:
  - Provider.
  - Model.
  - API key or local endpoint.
  - Default temperature.
- Embedding model:
  - Provider.
  - Model.
  - API key or local endpoint.
  - Embedding dimension.
  - Batch size.
- Future model slots:
  - Image generation model.
  - Video generation model.
  - TTS or speech model.

Acceptance criteria:

- Chat and embedding models are configured separately.
- Missing embedding configuration does not break the app.
- The UI clearly shows whether vector search is configured.
- API keys are treated as secrets.

## Milestone 5: Knowledge Base, Memory Base, and Retrieval

Purpose:

Make the Agent fast and token-conscious before it becomes powerful.

Tasks:

- Build knowledge item CRUD.
- Build memory item CRUD.
- Build memory candidate review:
  - Approve.
  - Edit and approve.
  - Reject.
  - Disable.
- Add metadata filters:
  - Module.
  - Project.
  - Type.
  - Tags.
- Add summary fields.
- Add keyword/full-text search.
- Add vector index adapter interface.
- Add embedding status:
  - Not configured.
  - Pending.
  - Indexed.
  - Stale.
  - Failed.
- Add top-K and token budget settings.

Acceptance criteria:

- User can inspect, edit, disable, and delete memory.
- Agent retrieval can run with keyword/tag search before embeddings are configured.
- When embeddings are configured, changed records can be marked stale and queued for re-indexing.
- Retrieval results are recorded in task steps.

## Milestone 6: Agent Orchestrator

Purpose:

Create the first real Agent loop with transparent routing.

Agent pipeline:

1. Receive user message.
2. Detect target module and intent.
3. Retrieve relevant memory.
4. Retrieve relevant knowledge.
5. Select candidate capability:
   - Internal module tool.
   - MCP tool.
   - Skill.
6. Create a task draft.
7. Show proposed actions.
8. Wait for confirmation.
9. Execute confirmed safe actions.
10. Save results and logs.
11. Suggest memory candidates when useful.

Acceptance criteria:

- `@小说`, `@音乐`, and `@博客` route to the right module.
- Agent creates task drafts instead of silently executing important actions.
- Every pipeline step writes to the process log.
- User can see which memory and knowledge snippets were used.
- Token input/output estimates are stored when available.

## Milestone 7: Capability Registry for MCP, Skills, and Module Tools

Purpose:

Make every callable capability visible and controllable.

Registry fields:

- Name.
- Type.
- Description.
- Input schema.
- Output schema.
- Permission level.
- Enabled state.
- Last used time.

Tasks:

- Build registry UI.
- Add internal module tools for first modules.
- Reserve MCP connector records.
- Reserve skill records.
- Let the Agent list available capabilities.
- Log selected capabilities in task steps.

Acceptance criteria:

- User can see which tools the Agent can call.
- Disabled capabilities are not selected by the Agent.
- Process log shows chosen capability and why it was selected.

## Milestone 7.5: Palmier Pro MCP Video Bridge

Purpose:

Prove that the Personal OS Agent can control an external AI video editor through chat without importing a full video editor codebase.

Integration approach:

- Treat Palmier Pro as an external MCP server.
- Connect to `http://127.0.0.1:19789/mcp` when Palmier Pro is open.
- Add a Palmier connection card in the video canvas placeholder module.
- Show connection status:
  - Not configured.
  - App not running.
  - Connected.
  - Error.
- Import Palmier MCP tools into the capability registry.
- Map Palmier tool calls into this app's process log.

First supported chat commands:

- `@视频 检查当前时间线`
- `@视频 导入素材`
- `@视频 添加字幕`
- `@视频 剪掉口误或停顿`
- `@视频 生成一段视频素材`
- `@视频 导出项目`

Safety rules:

- Timeline-destructive actions require confirmation.
- Export requires confirmation.
- Generation actions should show model, duration, estimated cost or credit requirement when available.
- If Palmier generation requires sign-in or credits, show that as a clear task error instead of retrying silently.

Acceptance criteria:

- App can detect whether Palmier Pro MCP is reachable.
- Agent can list Palmier tools in the capability registry.
- Agent can run a read-only Palmier action such as timeline inspection.
- Process log shows MCP endpoint, tool name, input summary, output summary, status, and duration.
- Destructive video edit actions are drafted first and require confirmation.

## Milestone 8: First Module Set

Purpose:

Prove that the same Agent can operate different kinds of modules.

Novel module:

- Create project.
- Create outline draft.
- Continue writing draft.
- Store chapters as knowledge records.
- Use creative preference memory.

Music module:

- Create manual library or playlist records.
- Play local or configured tracks if available.
- Store listening preferences as memory candidates.
- Keep AI music generation out of first version unless explicitly chosen later.

Blog module:

- Create blog draft.
- Adapt draft for selected channel.
- Manage publishing channel settings.
- Record manual publish status and URL.
- Reserve website and WeChat public account integration.

Acceptance criteria:

- Each first-version module has a usable workspace.
- Each module exposes at least one internal module tool to the Agent.
- Agent can create a task draft for each module.
- Blog can store channel configuration and manual publish records.

## Milestone 9: Publishing Channels

Purpose:

Prepare blog content for real external publishing.

Tasks:

- Add publishing channel settings UI.
- Add channel types:
  - Personal website.
  - WeChat public account.
  - Custom channel.
- Add fields:
  - Account/site identifier.
  - API endpoint or publishing URL.
  - Auth method.
  - Default category.
  - Default tags.
  - Default cover behavior.
  - Draft mode.
  - Publish mode.
- Add manual publish record flow:
  - Mark as published.
  - Paste final URL.
  - Store channel, status, and timestamp.
- Add process log steps for publishing drafts.

Acceptance criteria:

- User can configure website and WeChat public account targets.
- Sensitive fields are stored separately.
- Agent can prepare a publishing task draft.
- User confirmation is required before real publishing.

## Milestone 10: Backup, Import, and Review

Purpose:

Make the local-first app resilient.

Tasks:

- Export non-secret backup.
- Import backup.
- Show backup contents before import.
- Add data integrity checks.
- Add basic app health page:
  - Knowledge item count.
  - Memory item count.
  - Task log count.
  - Embedding index status.
  - Last backup time.

Acceptance criteria:

- User can export and import normal app data.
- Secrets are not included in normal backup.
- App can show whether embedding index is healthy or stale.

## Suggested Build Order

1. Project foundation.
2. Main layout.
3. Local database and migrations.
4. Settings and AI configuration.
5. Process log data model and UI.
6. Knowledge and memory CRUD.
7. Retrieval pipeline.
8. Agent orchestrator.
9. Module tools for novel, music, and blog.
10. Palmier Pro MCP video bridge.
11. Publishing channel configuration.
12. Backup/import.

## First Implementation Checkpoint

The first checkpoint should be a running app with:

- Main shell.
- Resizable workspace/chat.
- Bottom process log.
- Settings page.
- AI configuration page.
- Empty module pages.
- Local database initialized.

No external AI call is required for this checkpoint.

## Risks

- Scope creep: many modules can make the first version too slow to finish.
- AI provider coupling: hard-coding one provider will make future model switching painful.
- Hidden Agent behavior: if logs are not built early, debugging will be hard.
- Token cost: retrieval must use filters, summaries, and top-K limits from the beginning.
- Secret handling: publishing and model API credentials must not be mixed into normal settings or backups.

## Next Decision

Before writing code, decide the local data stack:

- Local database choice.
- Migration approach.
- Secret storage approach.
- Vector storage approach for the first implementation.
