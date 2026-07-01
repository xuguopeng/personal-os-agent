# Step 08 Plan: Knowledge Base CRUD

Date: 2026-06-29

## Goal

Make the Knowledge Base usable with real local records.

Step 08 creates the first data loop for project notes, blog material, writing references, and reusable context.

## User Problem

The Agent should eventually work from the user's own material.

Before vector search or document import, the app needs a simple way to:

- Add a knowledge item.
- Search knowledge items.
- Edit an item.
- Delete an item.
- Keep records grouped by module, project, and tags.

## Scope

Step 08 includes:

- Backend commands:
  - `list_knowledge_items`
  - `save_knowledge_item`
  - `delete_knowledge_item`
- Frontend adapter support with browser fallback.
- Knowledge Base UI:
  - Create form.
  - Keyword search.
  - Module filter.
  - List cards.
  - Edit and delete.
- Process log entries for create, update, and delete.

## Out Of Scope

Step 08 does not include:

- File import.
- Markdown preview.
- Vector indexing.
- Embedding generation.
- Agent retrieval from knowledge.
- Web publishing.

## Data Fields

Use the existing `knowledge_items` table.

Fields:

- Title.
- Content.
- Source.
- Project.
- Module.
- Tags.
- Created and updated time.

## Search Behavior

Use local keyword search over:

- Title.
- Content.
- Source.
- Project.
- Module.
- Tags.

Module filter supports:

- All.
- Novel.
- Music.
- Blog.
- Image.
- Video.
- Memory.
- Knowledge.
- Settings.

## Process Log

Knowledge mutations write task steps:

- `knowledge_create`
- `knowledge_update`
- `knowledge_delete`

Filtering and search are view actions and do not write logs.

## Test Plan

Rust:

- Create knowledge item.
- Update knowledge item.
- List with query.
- List with module filter.
- Delete knowledge item.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- Create a unique knowledge item.
- Search for it.
- Edit it.
- Filter by module.
- Delete it.
- Confirm console has no errors.

## Acceptance Criteria

Step 08 is complete when:

- The Knowledge Base page stores real records.
- Records can be searched and filtered.
- Records can be edited and deleted.
- Mutations are visible in the process log.
- Tests pass.
