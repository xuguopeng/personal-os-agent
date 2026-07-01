# Step 03 Plan: Memory Candidate Review

Date: 2026-06-29

## Goal

Let the user review memory candidates created from chat and decide whether they become long-term memory.

Step 02 created persisted memory candidates. Step 03 makes those candidates actionable.

## User Problem

The Agent should learn from chat, but it must not silently write long-term memory.

The user needs a visible review gate:

- Confirm useful candidates.
- Reject wrong or unwanted candidates.
- See what happened in the process log.

## Scope

Step 03 includes:

- Backend command to approve a memory candidate.
- Backend command to reject a memory candidate.
- Approved candidates create `memory_items`.
- Candidate status changes to `approved`.
- Rejected candidates change to `rejected`.
- Frontend adapter functions.
- Memory Center buttons:
  - Confirm.
  - Reject.
- UI refresh after action.
- Process log entries for review actions.

## Out Of Scope

Step 03 does not include:

- Editing candidate content before approval.
- Searching long-term memories.
- Editing long-term memories.
- Disabling long-term memories.
- Deleting long-term memories.
- Embeddings.
- AI-based extraction.

Those come in later steps.

## Data Impact

Use existing tables:

- `memory_candidates`
- `memory_items`
- `task_sessions`
- `task_steps`

When approving:

1. Read candidate.
2. Insert into `memory_items`.
3. Set candidate status to `approved`.

Memory item defaults:

- `type`: candidate type.
- `content`: candidate content.
- `summary`: candidate content for now.
- `source`: `chat_candidate`.
- `source_event_id`: candidate source event id.
- `confidence`: `0.7`.
- `enabled`: `1`.

When rejecting:

1. Set candidate status to `rejected`.
2. Do not create a memory item.

## UI Impact

Memory Center candidate cards show:

- Candidate type.
- Candidate content.
- Created time.
- Confirm button.
- Reject button.

After confirm or reject:

- Pending list refreshes.
- Counts refresh.
- Process log opens to show the action.

## Process Log Impact

Confirm flow writes:

- `memory_review`
- `memory_create`
- `confirmation`

Reject flow writes:

- `memory_review`
- `memory_reject`

## Test Plan

Rust tests:

- Approve candidate creates one memory item.
- Approved candidate status becomes `approved`.
- Reject candidate does not create memory item.
- Rejected candidate status becomes `rejected`.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Send a memory message.
- Open Memory.
- Confirm candidate.
- Candidate disappears from pending list.
- Process log shows memory creation.
- Send another memory message.
- Reject candidate.
- Candidate disappears from pending list.
- Process log shows rejection.

## Acceptance Criteria

Step 03 is complete when:

- User can confirm a chat-created memory candidate.
- Confirmation creates a long-term memory item.
- User can reject a candidate.
- Rejection does not create memory.
- Pending candidate list updates.
- Process log records review actions.
- Tests pass.

