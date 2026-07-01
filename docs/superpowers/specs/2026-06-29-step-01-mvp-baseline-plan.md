# Step 01 Plan: Reset The MVP Baseline

Date: 2026-06-29

## Goal

Make the next development phase strict and usable.

The app should stop growing as a shell with many placeholder buttons. From this point forward, every feature must be planned around a real workflow, real saved data, visible state, and testable acceptance criteria.

## Current Problem

The existing app has useful foundations:

- Tauri 2 app shell.
- React UI.
- SQLite database.
- Agent chat panel.
- Bottom process log.
- AI model profile settings.
- Publishing channel settings.
- MCP / Skill registry UI.

But many interactions are still not real product workflows:

- Module buttons mostly create simulated logs.
- Memory does not yet have real CRUD.
- Knowledge base does not yet have real CRUD.
- Chat does not yet call a real model.
- Agent retrieval is simulated.
- Module workspaces are mostly placeholders.

This creates the feeling that the app cannot actually be used.

## MVP Baseline

The next real MVP is:

> A personal Agent that can remember things about the user through a visible review flow.

This means the first serious product loop is Memory, not novel writing, video editing, or publishing.

## MVP Loop

The MVP loop is:

1. User chats with the Agent or manually opens Memory.
2. User says something worth remembering.
3. App creates a memory candidate.
4. User reviews the candidate.
5. User approves or rejects it.
6. Approved candidates become long-term memories.
7. User can list, edit, disable, and delete saved memories.
8. Every step appears in the process log.

## Product Rule

A feature is not done because a button exists.

A feature is done only when:

- The user can start the action.
- The user can complete the action.
- The result is saved locally.
- The saved result is visible after refresh.
- Errors are visible.
- The process log describes what actually happened.

## Step 01 Deliverables

This step does not build the full memory system yet. It defines the strict baseline that all following implementation steps must obey.

Deliverables:

1. Document the MVP baseline.
2. Define what counts as real functionality.
3. Define what stays out of scope.
4. Define how future small features must be planned.
5. Define the next implementation sequence.

## In Scope

For Step 01:

- Clarify MVP direction.
- Clarify acceptance criteria.
- Clarify small-feature planning rule.
- Prepare the next implementation plan for real Memory.

## Out Of Scope

For Step 01:

- No new UI implementation.
- No new database command.
- No real AI call.
- No memory CRUD implementation yet.
- No knowledge base implementation yet.
- No module editor implementation yet.

Those begin in Step 02.

## Future Small Feature Planning Rule

Every feature, even a small one, must have a short plan before implementation.

Required mini-plan format:

1. Goal: what user problem this solves.
2. Scope: what will be included.
3. Out of scope: what will not be touched.
4. Data impact: what tables, files, or settings change.
5. UI impact: what the user will see.
6. Process log impact: what gets logged.
7. Test plan: how we prove it works.
8. Acceptance criteria: what must be true before calling it done.

If a feature is tiny, this can be 6 to 10 lines. If it touches data or Agent behavior, it must be more detailed.

## Next Implementation Sequence

After Step 01, the next concrete build steps are:

1. Step 02: Build the chat-to-memory-candidate minimum loop.
2. Step 03: Build the real Memory Center review UI.
3. Step 04: Approve candidates into long-term memory.
4. Step 05: Add memory list, edit, disable, and delete.
5. Step 06: Make process logs reflect real memory actions.
6. Step 07: Browser test the full memory loop.
7. Step 08: Connect real chat model memory extraction after the local rule-based loop works.

## Acceptance Criteria For Step 01

Step 01 is complete when:

- The MVP baseline is documented.
- The app's next real loop is clearly Memory.
- The team rule for future feature planning is documented.
- The next implementation sequence is clear.
- No one should need to guess whether the next task is a real feature or a placeholder.
