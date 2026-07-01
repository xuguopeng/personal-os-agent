# Step 12 Plan: Chat-Driven Memory Candidates

Date: 2026-06-29

## Goal

Let normal chat create memory candidates when the message contains durable user preferences or project context.

Step 12 makes the Agent more proactive without letting it silently write long-term memory.

## User Problem

The user should not need to always say `记住`.

If the user says things like:

- `我偏好博客先写短标题`
- `我之后想把公众号也一起发`
- `别每次都问我小步骤确认`
- `这个项目主要是个人工作台`

The Agent should notice that this may be useful long-term context.

## Scope

Step 12 includes:

- Add local implicit memory candidate detection.
- Run implicit detection during ordinary chat tasks.
- Create a pending memory candidate linked to the task session.
- Write a `memory_candidate` task step.
- Refresh Memory Center counts and candidate list.
- Mention in chat reply that a memory candidate was found.

## Out Of Scope

Step 12 does not include:

- Automatic approval into long-term memory.
- LLM-based extraction.
- Deduplication across all historical messages.
- Batch scanning old chat history.
- User-configurable memory rules.

## Detection Rules

The first version uses conservative local patterns:

- Creative preference:
  - `我偏好`
  - `我更喜欢`
  - `我想要...风格`
- Work style:
  - `我希望`
  - `我习惯`
  - `别每次`
  - `不要每次`
  - `以后...不用`
- Life entertainment:
  - `我常听`
  - `我喜欢听`
  - `想听`
- Project context:
  - `这个项目主要`
  - `我之后想`
  - `我的目标`
  - `我正在做`

Explicit memory instructions still use the existing direct memory candidate flow.

## Process Log

Ordinary chat tasks may add:

- `memory_candidate`
  - Tool: `local.implicit_memory_detector`
  - Status: `pending`
  - Output: pending candidate content.

## UI Impact

Agent reply should mention:

- A possible memory candidate was found.
- It still needs confirmation in Memory Center.

## Test Plan

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Send a normal chat message without `记住`, such as `我偏好博客先写短标题`.
- Confirm chat reply mentions a pending memory candidate.
- Open Memory Center and confirm the candidate appears.
- Confirm process log contains `local.implicit_memory_detector`.
- Confirm console has no errors.

## Acceptance Criteria

Step 12 is complete when:

- Ordinary chat can create pending memory candidates.
- Candidates still require user approval.
- Process log shows the detection step.
- Tests pass.
