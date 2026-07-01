# Step 10 Plan: Real Chat Model Foundation

Date: 2026-06-29

## Goal

Connect Agent chat to the active chat model profile when credentials are configured.

Step 10 keeps the current local simulated flow as fallback, but adds a real model call path.

## User Problem

The Agent now retrieves memory and knowledge context, but the visible reply is still local simulated text.

The user needs:

- Active chat model profile selection to matter.
- API keys to stay in secure storage.
- Real model errors to be visible.
- Local simulation to remain available when no key is configured.

## Scope

Step 10 includes:

- Backend command `send_chat_completion`.
- Read the active chat model profile.
- Read the profile API key from system keychain.
- Build an OpenAI-compatible chat completion request.
- Return one assistant message.
- Frontend calls the backend after memory and knowledge retrieval.
- If no active configured chat profile exists, use local simulation.
- If the real call fails, show the error and use local simulation fallback.
- Process log records `model_call` success, skipped, or fallback.

## Out Of Scope

Step 10 does not include:

- True token-by-token backend streaming.
- Tool calling.
- Multi-turn persisted conversations.
- Provider-specific adapters beyond OpenAI-compatible chat completions.
- Automatic spending without user-configured key.

## API Contract

Command:

- `send_chat_completion`

Input:

- `message`
- `module`
- `memory_context`
- `knowledge_context`

Output:

- `used_real_model`
- `profile_name`
- `model`
- `content`
- `error`

Behavior:

- If no active chat profile exists or no key is configured, return `used_real_model = false` with a clear reason.
- If endpoint is empty, default to OpenAI-compatible `/v1/chat/completions`.
- If endpoint ends with `/chat/completions`, use it directly.
- Otherwise append `/chat/completions`.

## Prompt Shape

System message:

- The assistant is the user's Personal OS Agent.
- Use retrieved memory and knowledge only as context.
- Keep responses concise.
- Do not claim actions were completed if they were only planned/logged.

User message:

- Current module.
- User message.
- Retrieved long-term memories.
- Retrieved knowledge items.

## Process Log

Add one task step:

- `model_call`

Status:

- `success` when real model responds.
- `skipped` when no configured profile/key exists.
- `fallback` when real model errors and local simulation is used.

## Test Plan

Rust:

- Endpoint resolution appends `/chat/completions` correctly.
- Chat prompt includes memory and knowledge context.
- Missing active profile returns skipped result without plaintext key.

Frontend:

- `CI=true pnpm build`

Rust:

- `cargo check`
- `cargo test`

Browser:

- With no real key configured, send a chat message.
- Confirm local simulation still works.
- Confirm process log contains `model_call` skipped.
- Confirm console has no errors.

## Acceptance Criteria

Step 10 is complete when:

- Chat has a backend real-model path.
- Missing keys do not break chat.
- Errors are visible and fallback works.
- No API key is returned to the frontend.
- Tests pass.
