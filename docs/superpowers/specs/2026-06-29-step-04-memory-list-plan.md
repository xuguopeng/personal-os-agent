# Step 04 Plan: Long-Term Memory List

Date: 2026-06-29

## Goal

Show approved long-term memories in the Memory Center.

Step 03 writes approved candidates into `memory_items`, but the user still needs to see the saved memory. This step makes the saved result visible after approval and refresh.

## User Problem

If a candidate is confirmed but the saved memory is not visible, the user cannot trust that the Agent actually remembered anything.

The Memory Center needs two visible sections:

- Pending memory candidates.
- Saved long-term memories.

## Scope

Step 04 includes:

- Backend command to list memory items.
- Frontend adapter function.
- Browser fallback storage support.
- Memory Center saved-memory list.
- Refresh saved memories after approving a candidate.

## Out Of Scope

Step 04 does not include:

- Editing memory.
- Disabling memory.
- Deleting memory.
- Searching memory.
- Memory detail view.
- Using saved memories in Agent responses.
- Embedding saved memories.

Those come later.

## Data Impact

Use existing `memory_items` table.

No schema change required.

List command should return:

- `id`
- `memoryType`
- `content`
- `summary`
- `source`
- `sourceEventId`
- `confidence`
- `enabled`
- `createdAt`
- `updatedAt`

Default list behavior:

- Show newest first.
- Include enabled and disabled memories for now.
- Limit to 100.

## UI Impact

Memory Center shows:

1. Memory candidates.
2. Long-term memories.

Saved memory card shows:

- Type.
- Content.
- Source.
- Confidence.
- Enabled status.
- Created time.

Empty state:

- "还没有长期记忆。确认聊天生成的记忆候选后会出现在这里。"

## Process Log Impact

No new process log step is required for simply listing memories.

Approving a candidate already writes process log steps in Step 03.

## Test Plan

Rust tests:

- Insert memory item.
- List memory items.
- Confirm newest-first ordering if practical.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Send memory message.
- Open Memory.
- Confirm candidate.
- Confirm saved memory appears in long-term memory list.
- Reload page.
- Confirm saved memory still appears in browser fallback.

## Acceptance Criteria

Step 04 is complete when:

- Approved memories are visible in Memory Center.
- The saved memory list refreshes after confirmation.
- Empty state is clear.
- Tests pass.

