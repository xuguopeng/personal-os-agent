# Step 11 Plan: Chat Persistence

Date: 2026-06-29

## Goal

Persist Agent chat sessions and messages locally.

Step 11 turns the right-side chat from an in-memory UI into a durable conversation record.

## User Problem

The Agent should become more understanding through chat.

That requires chat history to survive reloads and be linked to:

- User messages.
- Assistant replies.
- Model call status.
- Task session logs.
- Retrieved memory and knowledge context.

## Scope

Step 11 includes:

- SQLite tables:
  - `chat_sessions`
  - `chat_messages`
- Backend commands:
  - `get_or_create_active_chat_session`
  - `list_chat_messages`
  - `append_chat_message`
  - `update_chat_message`
- Frontend adapter support with browser fallback.
- Right chat loads persisted messages on startup.
- User messages are saved when sent.
- Assistant placeholder is saved and updated after reply streaming completes.
- Assistant messages store model name, status, and linked task session id.

## Out Of Scope

Step 11 does not include:

- Multiple chat thread UI.
- Rename/delete chat sessions.
- Full text search over chat history.
- Long-term memory extraction from past messages.
- Token budget summarization.

## Data Shape

`chat_sessions`:

- `id`
- `title`
- `status`
- `created_at`
- `updated_at`

`chat_messages`:

- `id`
- `session_id`
- `role`
- `content`
- `model_name`
- `status`
- `task_session_id`
- `created_at`
- `updated_at`

## Process Log

No separate task step is required for saving chat messages.

The existing task session logs remain the observability layer for Agent work.

## Test Plan

Rust:

- Create active chat session.
- Append user and assistant messages.
- Update assistant message content/status/task session id.
- List messages in order.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Send a chat message.
- Reload the page.
- Confirm the user message and assistant reply remain visible.
- Confirm console has no errors.

## Acceptance Criteria

Step 11 is complete when:

- Chat messages persist locally.
- Reloading keeps the latest conversation.
- Assistant replies can be updated after streaming.
- Tests pass.
