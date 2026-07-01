# Full Implementation Roadmap

Date: 2026-06-29

## Purpose

This roadmap defines the full build order for the Personal OS Agent.

The project should not be implemented as a pile of pages. It should be implemented as a set of real working loops, starting small and becoming broader over time.

The first priority is to stop building fake entrances. Every major step below should produce a usable workflow before the next layer is expanded.

## Roadmap

### 1. Reset The MVP Baseline

Define the current phase around real functionality, not placeholder UI.

The first real loop is:

- Agent chat.
- Memory candidate creation.
- User review.
- Long-term memory persistence.
- Process log visibility.

### 2. Organize Navigation And Information Architecture

Left navigation only contains primary work modules:

- Novel.
- Music.
- Blog.
- Comics / Stickers.
- Video Canvas.

Utility areas live outside the left work-module menu:

- Memory.
- Knowledge Base.
- Settings.

The Agent chat remains on the right. The process log remains at the bottom.

### 3. Complete The Local Data Foundation

Make the local database reliable before adding more agent behavior.

Required foundations:

- SQLite tables.
- Migrations.
- Basic CRUD commands.
- Unified error handling.
- Data refresh patterns.

Core data areas:

- Memory.
- Knowledge.
- Task logs.
- Model configuration.
- Publishing channels.
- Capability registry.

### 4. Build The Real Memory System

Memory is the first real product loop because it directly supports the goal of making the Agent understand the user.

Required features:

- Manual memory creation.
- Memory list.
- Edit memory.
- Disable memory.
- Delete memory.
- Memory candidates.
- Approve candidate.
- Reject candidate.

### 5. Connect Agent Chat To Memory

The Agent should be able to create memory candidates from conversation.

Example:

`记住我喜欢写有宿命感的都市故事`

Flow:

1. User sends message.
2. App detects memory intent.
3. App creates memory candidate.
4. Memory center shows the candidate.
5. User approves or rejects.
6. Process log records every step.

### 6. Complete The Process Log System

The process log should become the app's observability layer.

Every real action writes task steps.

Log entries should show:

- Intent.
- Module.
- Tool or command.
- Input summary.
- Output summary.
- Status.
- Error.
- Duration when available.

### 7. Complete AI Configuration

The app must support multiple model profiles.

Required:

- Multiple chat model profiles.
- Active chat model selection.
- Multiple embedding model profiles.
- Active embedding profile selection.
- Secret status only.
- No plaintext key echo.

Secrets stay in system secure storage in desktop mode.

### 8. Connect A Real Chat Model

Use the active chat model profile for real streaming chat.

If no model is configured, the UI must clearly show local simulation mode.

Errors should appear in:

- Chat.
- Process log.

### 9. Build The Minimal Knowledge Base

The knowledge base should start with simple local records before complex import.

Required:

- Manual item creation.
- Text / Markdown import.
- List.
- Detail view.
- Edit.
- Delete.
- Tags.
- Project.
- Module.
- Keyword search.

### 10. Build Retrieval

Retrieval should start without vectors.

Phase 1:

- Keyword search.
- Tag filtering.
- Module filtering.
- Project filtering.

Phase 2:

- Summary-first retrieval.
- Top-K limits.
- Token budget.

Phase 3:

- Embedding generation.
- Vector search.
- Stale index status.

### 11. Connect Agent To Memory And Knowledge

The Agent should not load everything.

Flow:

1. Detect module and intent.
2. Retrieve relevant memories.
3. Retrieve relevant knowledge.
4. Show retrieved items in process log.
5. Use only selected snippets in the model context.

### 12. Build Capability Registry

All callable capabilities should be visible and controllable.

Capability types:

- MCP.
- Skill.
- Internal module tool.

Each capability should have:

- Name.
- Type.
- Description.
- Endpoint or command.
- Enabled state.
- Created time.
- Updated time.

### 13. Add Skill Creation, Registration, And Calling

Settings should allow Skills to be added and managed.

The Agent should be able to:

- List available Skills.
- Select a Skill.
- Call a Skill.
- Write Skill usage to the process log.

### 14. Add MCP Registration And Detection

Settings should allow MCP services to be added and managed.

Palmier Pro is the first default example.

Required:

- Add MCP endpoint.
- Enable or disable MCP.
- Detect status.
- Show connected, not running, and error states.

### 15. Implement The First Real Work Module: Blog

Blog is the first content module because it connects writing, publishing, and Agent assistance.

Required:

- Create draft.
- Edit draft.
- Save draft.
- Draft list.
- Draft detail.
- Agent creates a blog draft from chat.

### 16. Implement Blog Publishing Channel Configuration

Publishing starts with configuration and manual records.

Required channel types:

- Personal website.
- WeChat public account.
- Custom channel.

First version:

- Save channel configuration.
- Store secrets separately.
- Record manual publish status and URL.

Later:

- Real website publishing API.
- Real WeChat publishing API.

### 17. Implement Novel Module

Required:

- Work list.
- Chapter list.
- Chapter editor.
- Outline.
- Character settings.
- Agent continue-writing action.
- Agent outline-generation action.

### 18. Implement Comics / Stickers Module

Required:

- Comic storyboard.
- Character visual notes.
- Prompt drafts.
- Sticker copywriting.
- Asset list.

After image generation is connected, this module can create real generation tasks.

### 19. Implement Music Module

Start with records and preferences.

Required first:

- Manual playlist records.
- Music preference memory.
- Listening scene tags.

Later:

- Local music scan.
- Playback.
- External music provider integration.

### 20. Implement Video Canvas Module

Start with project and task management.

Required first:

- Video project list.
- Material list.
- Generation task list.
- Palmier connection status.

When Palmier MCP is available:

- Read timeline information.
- Show timeline summary.
- Create edit task drafts.

### 21. Connect Image Generation Model

Required:

- Image model profile configuration.
- Image generation task creation.
- Result storage.
- Generated assets visible in the asset library.

Used by:

- Comics.
- Stickers.
- Blog covers.
- Novel illustrations.

### 22. Connect Video Generation Model

Required:

- Video model profile configuration.
- Video generation task creation.
- Result storage.
- Import generated result into video canvas or Palmier workflow.

### 23. Build Task Confirmation System

High-impact actions must require confirmation.

Confirmation required for:

- Publishing.
- Deleting.
- Exporting.
- Paid generation.
- Destructive video edits.
- External tool execution with side effects.

### 24. Build File And Asset Management

Create one system for imported and generated assets.

Assets include:

- Images.
- Videos.
- Blog attachments.
- Novel reference files.
- Comic references.
- Generated outputs.

### 25. Build Backup And Restore

Required:

- Export non-secret data.
- Import non-secret data.
- Preview backup contents before import.
- Never include API keys, tokens, cookies, or secrets in ordinary backups.

Future:

- Encrypted full backup.

### 26. Build Global Search

Search across:

- Memories.
- Knowledge.
- Blog drafts.
- Novel works.
- Assets.
- Task logs.

Search results should open the corresponding module and record.

### 27. Build Permission And Safety Boundaries

Every capability should have a safety level.

Examples:

- Read-only.
- Local write.
- External API call.
- Paid generation.
- Destructive edit.
- Publishing.

The Agent must respect these levels.

### 28. Build A Truly Observable Agent

The Agent should show:

- What it understood.
- What it searched.
- Which memories it used.
- Which knowledge records it used.
- Which tool it selected.
- What it saved.
- What still needs confirmation.

### 29. Polish The Product Experience

Polish after real loops exist.

Required:

- Empty states.
- Loading states.
- Error states.
- Disabled button states.
- Responsive layout.
- Keyboard shortcuts.
- Clear labels.
- Better log expansion.

### 30. Complete The Personal OS

The final product should make chat, modules, memory, knowledge, generation, publishing, and external tools work as one system.

At this stage, the Agent should be able to control:

- Novel writing.
- Blog drafting and publishing.
- Memory.
- Knowledge retrieval.
- Comics and stickers.
- Image generation.
- Video generation and editing.
- Music workflows.
- Publishing channels.
- MCP tools.
- Skills.

## Rule For All Future Work

Do not mark a feature as done because the button exists.

A feature is done only when the user can complete a real workflow and see the saved result after refresh.

