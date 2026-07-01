# Step 07 Plan: Agent Memory Retrieval

Date: 2026-06-29

## Goal

Let Agent chat use approved long-term memories before responding.

Step 07 makes memory useful inside conversation instead of only visible in the Memory Center.

## User Problem

The user wants an Agent that becomes more understanding over time.

That requires the chat loop to:

- Search enabled memories for the current message.
- Use a small number of relevant memories.
- Show which memories were used.
- Record the retrieval process in the bottom log.

## Scope

Step 07 includes:

- Backend command `retrieve_agent_memories`.
- Local keyword retrieval over approved `memory_items`.
- Only enabled memories are eligible.
- Frontend chat calls retrieval before simulated task handling.
- Agent response mentions the memory context count.
- Process log includes a `memory_retrieval` step.

## Out Of Scope

Step 07 does not include:

- Embedding search.
- Token-budget compression.
- Real LLM prompt injection.
- Memory ranking using paid AI.
- Editing memories from chat.
- Cross-project memory scopes.

## Retrieval Behavior

Inputs:

- Current chat message.
- Optional module key.
- Limit, default 5.

Matching:

- Use normalized lowercase keyword matching.
- Search `content`, `summary`, `type`, and `source`.
- Give extra weight to memory type hints:
  - `小说`, `写`, `故事` -> creative preference.
  - `音乐`, `歌` -> life entertainment.
  - `计划`, `流程`, `开发` -> work style.
  - `项目`, `代码`, `应用` -> project context.
- Return top matches by score and recency.

## Process Log

Each non-memory-candidate chat task should write:

- `memory_retrieval`
  - Tool: `memory.retrieve_agent_memories`.
  - Input: user message.
  - Output: matched count and short summaries.
- Existing intent / module steps continue after retrieval.

For memory-candidate messages, the app keeps the current candidate flow and does not use retrieval yet.

## UI Impact

Agent chat message should show:

- Local simulation mode remains visible when no real model is connected.
- A short line when memories were found.
- The response text stays concise.

The process log is the main place for detailed transparency.

## Test Plan

Rust:

- Retrieval ignores disabled memories.
- Retrieval matches query keywords.
- Retrieval can use type hints.
- Retrieval respects limit.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Approve a memory.
- Send a related non-memory command such as `@小说 帮我继续写这个故事`.
- Confirm the chat response mentions memory context.
- Confirm the bottom log contains `memory_retrieval`.
- Confirm console has no errors.

## Acceptance Criteria

Step 07 is complete when:

- Chat can retrieve relevant enabled memories.
- Disabled memories are ignored.
- Retrieval is visible in the process log.
- User can see that memory affected the response.
- Tests pass.
