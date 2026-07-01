# Step 09 Plan: Agent Knowledge Retrieval

Date: 2026-06-29

## Goal

Let Agent chat retrieve relevant Knowledge Base items before responding.

Step 09 connects the Knowledge Base data loop from Step 08 into the chat workflow.

## User Problem

The Agent should work from the user's saved material, not only from long-term preferences.

For example:

- Blog drafts should use saved publishing notes.
- Novel tasks should use saved character or style references.
- Video tasks should use saved project notes.

## Scope

Step 09 includes:

- Backend command `retrieve_agent_knowledge`.
- Local keyword and module-aware retrieval over `knowledge_items`.
- Frontend adapter support with browser fallback.
- Chat calls knowledge retrieval after memory retrieval.
- Agent response mentions matched knowledge context.
- Process log includes a `knowledge_retrieval` step.

## Out Of Scope

Step 09 does not include:

- Embedding generation.
- Vector search.
- File import.
- Markdown preview.
- Real LLM prompt construction.
- Automatic editing of knowledge items from chat.

## Retrieval Behavior

Inputs:

- Current chat message.
- Optional module key.
- Limit, default 5.

Matching:

- Search title, content, summary, type, project, module, tags, and source.
- Give extra score to items matching the active module.
- Use simple keyword matching first.
- Sort by score and recency.

## Process Log

Each ordinary chat task should write:

- `memory_retrieval`
- `knowledge_retrieval`
- Existing intent, context, capability, confirmation steps.

`knowledge_retrieval` output should show:

- Match count.
- Matched item titles or summaries.

## UI Impact

Agent chat response should show:

- Memory context count.
- Knowledge context count.
- Short matched titles/summaries.

Detailed transparency stays in the bottom process log.

## Test Plan

Rust:

- Retrieval matches query keywords.
- Retrieval favors active module.
- Retrieval respects limit.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Create a unique knowledge item.
- Send a related non-memory command.
- Confirm chat response mentions knowledge context.
- Confirm bottom log contains `knowledge_retrieval`.
- Confirm console has no errors.

## Acceptance Criteria

Step 09 is complete when:

- Chat retrieves relevant knowledge items.
- Retrieval is visible in the process log.
- Agent reply shows knowledge context was used.
- Tests pass.
