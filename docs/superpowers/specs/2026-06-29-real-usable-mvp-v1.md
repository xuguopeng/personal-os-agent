# Real Usable MVP v1

Date: 2026-06-29

## Why This Exists

The earlier design document describes the long-term Personal OS Agent vision. It is useful as direction, but it is too broad for the next implementation step. If we keep building from that document directly, the app will keep becoming a shell with many impressive-looking buttons and few real workflows.

This document defines the next usable product slice. The goal is not to cover every module. The goal is to make one end-to-end loop genuinely work.

## MVP Principle

One real loop is better than ten fake entrances.

For this MVP, a feature counts as real only if it has:

- A visible UI entry.
- Real local persistence when data is created or changed.
- A readable list/detail view for saved data.
- Clear empty, loading, success, and error states.
- Process log entries that describe what actually happened.
- No misleading copy that suggests unsupported execution.

If a button only writes a simulated log or shows placeholder text, it must be labeled as a planned feature or removed from the primary path.

## MVP Scope

The first real loop is:

1. Configure or select a chat model profile.
2. Chat with the Agent.
3. Ask the Agent to remember something or manually add a memory.
4. Create a memory candidate.
5. Review the candidate.
6. Approve it into long-term memory or reject it.
7. Search/list saved memories.
8. Show every step in the bottom process log.

This makes the app begin to become "the Agent that understands me" instead of a generic dashboard.

## Required Screens

### Main Layout

- Left menu only contains primary work modules:
  - Novel
  - Music
  - Blog
  - Comics / Stickers
  - Video Canvas
- Utility areas live outside the left module menu:
  - Memory
  - Knowledge Base
  - Settings
- Agent chat remains visible on the right by default.
- The bottom process log remains visible and collapsible.

### Agent Chat

The chat panel must support:

- Streaming UI.
- Selected chat model display.
- A clear local/mock mode indicator when no real API call is being made.
- `@记忆` or natural-language memory commands.

For MVP v1, real model calls are optional. If real calls are not wired yet, the UI must say "local simulation" clearly.

### Memory Center

The memory center must support:

- Add memory manually.
- List saved memories.
- Edit memory.
- Disable memory.
- Delete memory.
- List memory candidates.
- Approve candidate.
- Reject candidate.

Memory item fields:

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

Memory candidate fields:

- `id`
- `type`
- `content`
- `source_event_id`
- `status`
- `created_at`
- `updated_at`

### Settings

Settings must support:

- Multiple chat model profiles.
- Selecting one active chat profile.
- Multiple embedding model profiles.
- Secret status only; no plaintext key echo.

Settings can keep MCP, Skills, and Publishing Channels, but they are not part of the MVP success path.

## Explicitly Out Of Scope For This MVP

These remain in the long-term design but should not drive the next build:

- Novel editor.
- Music playback.
- Blog publishing.
- WeChat publishing.
- Real image generation.
- Real video generation.
- Palmier timeline editing.
- Vector indexing.
- Full knowledge base import.
- Backup import/export.
- Real MCP tool execution.
- Real Skill execution.

They can stay visible only if the UI clearly marks them as planned or configuration-only.

## Data Flow

Manual memory flow:

1. User opens Memory.
2. User enters memory content.
3. App writes `memory_items`.
4. App refreshes the memory list.
5. App writes task steps:
   - `memory.create`
   - `memory.persist`
   - `memory.visible`

Agent memory candidate flow:

1. User sends a chat message such as "记住我喜欢写带宿命感的都市故事".
2. App creates a task session.
3. App extracts a memory candidate locally.
4. App writes `memory_candidates`.
5. App shows the candidate in Memory.
6. User approves or rejects.
7. Approval writes `memory_items` and updates candidate status.
8. Rejection only updates candidate status.

## Process Log Requirements

Every real action must create task steps.

Minimum step types:

- `intent`
- `memory_candidate`
- `memory_create`
- `memory_update`
- `memory_delete`
- `confirmation`
- `error`

The process log must not claim that the app searched knowledge, called MCP, or used a model unless that actually happened.

## UI Copy Rules

Avoid misleading future-tense promises on primary buttons.

Bad:

- "生成大纲" when no generation exists.
- "播放" when no player exists.
- "导出" when no export exists.

Acceptable:

- "计划功能"
- "配置入口"
- "创建任务草稿"
- "保存记忆"
- "批准记忆"

## Acceptance Criteria

MVP v1 is done when:

- User can add a memory manually and see it after refresh.
- User can edit, disable, and delete a memory.
- User can create a memory candidate from chat.
- User can approve or reject a memory candidate.
- Bottom process log shows real memory actions.
- Chat panel still works on the right.
- Settings supports multiple chat model profiles and active selection.
- The left menu contains only primary work modules.
- No primary button pretends to execute a feature that is not implemented.

## Implementation Order

1. Add backend commands for memory items and memory candidates.
2. Add frontend backend adapter functions.
3. Replace Memory placeholder with real Memory Center UI.
4. Wire chat memory command to create memory candidates.
5. Tighten process log copy so simulated steps are clearly simulated.
6. Hide or relabel module buttons that are not real yet.
7. Update README current checkpoint.
8. Run frontend build, Rust tests, and browser verification.

