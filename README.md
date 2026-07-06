# Personal Music NAS

This repository is now focused on the NAS music service and the Flutter music client.

## Structure

- `services/agent-server/` - NAS-side Python service.
  - Scans and serves the NAS local music library.
  - Stores server data under `/data`.
  - Handles music status, playlists, favorites, playback streams, radio episodes, and MiniMax TTS radio generation.
  - Stores unified listening history for local NAS playback, NetEase imports, and client-side/manual imports.
- `clients/mu-music/` - Flutter client for Android, macOS, iOS, and web targets.
- `data/` - Local development data notes and secret examples.
- `docs/nas/` - NAS and music proxy implementation notes.
- `operateLog.md` - Local operation history.

## Open Source Boundary

The public repository should only include local-file music management and clean service/client code.

Do not commit:

- real `.env` files
- MiniMax subscription/API keys
- private metadata plugins
- QQ Music / NetEase / Kugou / Kuwo scraper implementations
- generated build output

Third-party metadata scraping should live in private plugin folders outside the public code path.

## NAS Service

Run with Docker Compose:

```bash
docker compose up -d --build
```

Current Compose service/container names:

- service: `music-server`
- container: `mu-music-server`

Local development:

```bash
cd services/agent-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

Useful endpoints:

- `GET /health`
- `GET /v1/music/status`
- `POST /v1/music/api/admin/scan`
- `GET /v1/music/api/tracks`
- `GET /v1/music/audio/{track_id}`
- `GET /v1/music/radio/status`
- `POST /v1/music/radio/daily/run`
- `GET /v1/listening/status`
- `POST /v1/listening/sync`
- `GET /v1/listening/profile`

When `AGENT_SERVER_USERNAME` and `AGENT_SERVER_PASSWORD` are configured, add
`-u "username:password"` to `/v1/*` requests. `/health` stays public.

## Flutter Client

```bash
cd clients/mu-music
flutter pub get
flutter run -d macos
```

Build examples:

```bash
flutter build macos --debug
flutter build apk --release --split-per-abi \
  --dart-define=NAS_LOCAL_API_URL=http://你的NAS局域网IP:8088/v1/music \
  --dart-define=NAS_PUBLIC_API_URL=https://os.xuguopeng.com/v1/music \
  --dart-define=AGENT_SERVER_USERNAME=你的账号 \
  --dart-define=AGENT_SERVER_PASSWORD=你的密码
```

The Flutter client tries NAS addresses in order: local/LAN first, then the public
domain. The first successful address is reused for API calls, covers, radio
audio, and track streaming.

## Secrets

For NAS deployment, store secrets in the mounted data volume:

```text
/volume1/docker/personal-os-agent/data/secrets/agent-server.env
/volume1/docker/personal-os-agent/data/secrets/daoliyu.env
/volume1/docker/personal-os-agent/data/secrets/music-sources.env
```

For local development, use:

```text
data/secrets/agent-server.env
data/secrets/daoliyu.env
data/secrets/music-sources.env
```

Only `*.env.example` files are intended to be committed.
