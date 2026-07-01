# Step 02 Plan: Chat To Memory Candidate Minimum Loop

Date: 2026-06-29

## Goal

Make long-term memory start from chat, not from manual database-style entry.

The user should be able to say something naturally in the Agent chat, and the app should turn it into a reviewable memory candidate.

## Why This Step Matters

The product goal is "the Agent that understands me."

That cannot happen if memory only comes from manual forms. Most memory should come from conversation:

- Preferences.
- Writing style.
- Work habits.
- Dislikes.
- Project context.
- Repeated instructions.

Manual memory creation is useful, but it is not the main path.

## MVP Flow

Example user message:

`记住我喜欢写宿命感强一点的都市故事`

Expected flow:

1. User sends the message in Agent Chat.
2. App detects a memory intent.
3. App creates a `memory_candidates` record.
4. App writes process log steps.
5. Chat replies that a memory candidate was created and needs review.
6. Memory Center can show the candidate in the next step.

For Step 02, candidate review UI can be minimal or deferred to Step 03, but the candidate must be persisted.

## Scope

Step 02 includes:

- Backend command to create a memory candidate.
- Backend command to list memory candidates.
- Backend command to update candidate status.
- Frontend adapter functions for these commands.
- Local rule-based memory intent detection in chat.
- Candidate creation from chat.
- Process log entries for the candidate creation.
- Clear chat copy that says this is a candidate, not a saved long-term memory yet.

## Out Of Scope

Step 02 does not include:

- Real AI-based memory extraction.
- Embedding or vector indexing.
- Full Memory Center UI.
- Editing candidate before approval.
- Approving candidate into `memory_items`.
- Manual memory CRUD.
- Using memory in future Agent responses.

Those come after the candidate loop exists.

## Data Impact

Use existing `memory_candidates` table:

- `id`
- `type`
- `content`
- `source_event_id`
- `status`
- `created_at`
- `updated_at`

Candidate statuses:

- `pending`
- `approved`
- `rejected`

Candidate types for local rules:

- `creative_preference`
- `work_style`
- `life_entertainment`
- `project_context`
- `disabled_memory`
- `general`

No new database table is required for Step 02 unless current schema is missing required fields.

## UI Impact

Agent Chat:

- Detect memory-like messages.
- Show a streaming response that says a memory candidate was created.
- Do not claim the memory has been permanently saved.

Memory Center:

- Step 02 may show a basic candidate count or basic list if low effort.
- Full review UI belongs to Step 03.

## Local Memory Intent Rules

Before real AI extraction exists, use conservative local rules.

Create a memory candidate when the message includes patterns such as:

- `记住`
- `以后你要知道`
- `你要记得`
- `我喜欢`
- `我不喜欢`
- `我的习惯`
- `我希望你以后`
- `以后写`
- `我的风格`

Do not create a candidate for every message. If unsure, do not write memory.

## Candidate Content Rule

For Step 02, use the original user message as candidate content after light cleanup.

Examples:

- Input: `记住我喜欢写宿命感强一点的都市故事`
- Candidate content: `我喜欢写宿命感强一点的都市故事`
- Type: `creative_preference`

The extraction does not need to be perfect yet. It only needs to be visible, reviewable, and not silently saved.

## Process Log Impact

When a memory candidate is created, write task steps:

1. `intent`
   - Input: user message.
   - Output: detected memory intent.
2. `memory_candidate`
   - Tool: `local.memory_candidate_extractor`.
   - Output: candidate content and type.
3. `confirmation`
   - Output: candidate is waiting for user review.

If no memory intent is detected, normal simulated task logging can continue, but it must say simulation clearly.

## Test Plan

Rust tests:

- Create memory candidate.
- List pending candidates.
- Update candidate status to rejected.
- Reject invalid status if validation is added.

Frontend build:

- `CI=true pnpm build`

Rust checks:

- `cargo check`
- `cargo test`

Browser verification:

- Send `记住我喜欢写宿命感强一点的都市故事`.
- Confirm chat says a candidate was created.
- Confirm bottom process log includes memory candidate step.
- Confirm candidate persists after refresh through backend list command or Memory Center display if implemented in this step.
- Confirm ordinary message does not create a memory candidate.

## Acceptance Criteria

Step 02 is complete when:

- Chat can create a persisted memory candidate.
- The candidate is not silently approved into long-term memory.
- Candidate creation is visible in the process log.
- Chat response clearly says review is needed.
- Non-memory messages do not create candidates.
- Tests pass.

