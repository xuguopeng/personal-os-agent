# Step 05 Plan: Long-Term Memory Management

Date: 2026-06-29

## Goal

Let the user manage saved long-term memories.

Step 04 made approved memories visible. Step 05 makes them controllable.

## User Problem

An Agent memory system is only trustworthy if the user can correct it.

The user must be able to:

- Edit a saved memory.
- Disable a memory without deleting it.
- Re-enable a memory.
- Delete a memory.

## Scope

Step 05 includes:

- Backend command to update memory content, summary, type, confidence, and enabled state.
- Backend command to delete a memory item.
- Frontend adapter functions.
- Browser fallback support.
- Memory Center UI actions:
  - Edit.
  - Save.
  - Cancel.
  - Disable / enable.
  - Delete.
- Process log entries for memory management actions.

## Out Of Scope

Step 05 does not include:

- Memory search.
- Memory filters.
- Memory detail page.
- Embeddings.
- Using memories in Agent responses.
- Bulk actions.
- Undo after delete.

## Data Impact

Use existing `memory_items` table.

Update fields:

- `type`
- `content`
- `summary`
- `confidence`
- `enabled`
- `updated_at`

Delete:

- Hard delete from `memory_items` for this step.

## UI Impact

Each long-term memory card should show:

- Edit button.
- Disable / enable button.
- Delete button.

When editing:

- Show editable content field.
- Show type selector.
- Show summary field.
- Show save/cancel.

## Process Log Impact

Write task steps for:

- `memory_update`
- `memory_disable`
- `memory_enable`
- `memory_delete`

## Test Plan

Rust:

- Update memory content.
- Disable memory.
- Re-enable memory.
- Delete memory.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Create candidate from chat.
- Confirm it into long-term memory.
- Edit memory.
- Disable memory.
- Re-enable memory.
- Delete memory.
- Confirm logs are written and console has no errors.

## Acceptance Criteria

Step 05 is complete when:

- User can edit a memory.
- User can disable and re-enable a memory.
- User can delete a memory.
- Memory list refreshes after each action.
- Process log records each action.
- Tests pass.

