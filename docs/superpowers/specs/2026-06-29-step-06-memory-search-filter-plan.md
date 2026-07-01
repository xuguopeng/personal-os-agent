# Step 06 Plan: Memory Search And Filter

Date: 2026-06-29

## Goal

Let the user find saved long-term memories quickly.

Step 05 made memories manageable. Step 06 makes them searchable and filterable.

## User Problem

Once memories grow, a plain list becomes hard to use.

The user needs to quickly answer:

- Did the Agent remember this preference?
- Which creative preferences are saved?
- Which memories are disabled?
- What did I tell the Agent about a project or writing style?

## Scope

Step 06 includes:

- Extend `list_memory_items` to support:
  - Text query.
  - Memory type filter.
  - Enabled / disabled filter.
- Frontend adapter support.
- Browser fallback filtering.
- Memory Center UI:
  - Search input.
  - Type filter.
  - Status filter.
  - Result count.

## Out Of Scope

Step 06 does not include:

- Vector search.
- Embedding generation.
- Agent retrieval from memory.
- Tagging memories.
- Project-level memory filters.
- Bulk actions.

## Data Impact

Use existing `memory_items` table.

No schema changes required.

Search fields:

- `content`
- `summary`
- `type`
- `source`

## UI Impact

The long-term memory section should include:

- Search box.
- Type select.
- Status select:
  - All.
  - Enabled.
  - Disabled.
- Result count.

Changing filters should refresh the list.

## Process Log Impact

No task log is required for normal list filtering.

Search/filter is a local viewing action, not an Agent task.

## Test Plan

Rust:

- List all memories.
- Filter by query.
- Filter by type.
- Filter by enabled state.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Create or use existing memories.
- Search by text.
- Filter by type.
- Disable one memory and filter disabled.
- Confirm console has no errors.

## Acceptance Criteria

Step 06 is complete when:

- User can search saved memories by text.
- User can filter by memory type.
- User can filter by enabled/disabled state.
- Result count updates.
- Tests pass.

