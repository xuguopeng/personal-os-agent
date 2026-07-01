# Personal OS Agent

Local-first Personal OS desktop app built with Tauri 2, React, TypeScript, and shadcn/ui-style components.

## Current Checkpoint

The app shell is in place, but most module actions are not real workflows yet:

- Left navigation for primary work modules.
- Resizable workspace and Agent chat panes.
- Bottom process log accordion.
- Placeholder workspaces for novel, music, blog, comics/stickers, and video canvas.
- Utility entries for memory, knowledge, and settings live outside the left work-module menu.
- Multiple AI model profiles for chat and embedding, with active profile selection.
- Palmier Pro MCP connection placeholder for video editing.
- Local SQLite schema initialized from the Tauri side.
- Settings page can read and save chat/embedding model profiles.
- Browser preview uses localStorage fallback; desktop mode uses SQLite.
- Bottom process log is backed by task sessions and task steps.
- Agent chat can create a local simulated task and write log steps.
- API keys and publishing secrets use system keychain in desktop mode.
- Publishing channel configuration supports website, WeChat public account, and custom channels.
- Video canvas can check Palmier Pro MCP connection status.
- Settings includes an MCP / Skills capability list where new entries can be added, enabled/disabled, and deleted.

No real AI calls, memory CRUD, knowledge CRUD, vector indexing, automatic publishing, or Palmier editing actions are wired yet.

The next implementation target is not the full long-term vision. It is the focused real-use MVP in:

- `docs/superpowers/specs/2026-06-29-real-usable-mvp-v1.md`

That MVP prioritizes one real end-to-end loop: chat or manually create memory candidates, approve them into long-term memory, list/edit/delete saved memories, and show real process logs.

## Development

Install dependencies:

```bash
pnpm install
```

Run the web shell:

```bash
pnpm dev -- --host 127.0.0.1
```

Run the desktop app:

```bash
pnpm tauri dev
```

Build the frontend:

```bash
pnpm build
```

Check the Tauri Rust side:

```bash
cd src-tauri
cargo check
```

Run Rust tests:

```bash
cd src-tauri
cargo test
```

## Planning Docs

- `docs/superpowers/specs/2026-06-29-personal-os-agent-design.md`
- `docs/superpowers/specs/2026-06-29-personal-os-agent-implementation-plan.md`
- `docs/superpowers/specs/2026-06-29-real-usable-mvp-v1.md`
- `docs/superpowers/specs/2026-06-29-full-implementation-roadmap.md`
- `docs/superpowers/specs/2026-06-29-step-01-mvp-baseline-plan.md`
- `docs/superpowers/specs/2026-06-29-step-02-chat-to-memory-candidate-plan.md`
- `docs/superpowers/specs/2026-06-29-step-03-memory-candidate-review-plan.md`
- `docs/superpowers/specs/2026-06-29-step-04-memory-list-plan.md`
- `docs/superpowers/specs/2026-06-29-step-05-memory-management-plan.md`
