# Personal Music NAS Server

NAS-side music service for local music files, playback, listening history, and generated radio episodes.

## Development

```bash
cd services/agent-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8088 --reload
```

## Docker

From the repository root:

```bash
docker compose up --build music-server
```

The Docker Compose service is `music-server`; the container name is `mu-music-server`.

Health check:

```bash
curl http://127.0.0.1:8088/health
```

## Data

By default the Docker service stores data in the `agent_server_data` volume.

Environment variables:

- `AGENT_SERVER_DB_PATH`: SQLite database path.
- `AGENT_SERVER_BIND_HOST`: bind host, default `0.0.0.0`.
- `AGENT_SERVER_PORT`: service port, default `8088`.
- `AGENT_SERVER_USERNAME`: optional Basic Auth username. When both username and password are configured, `/v1/*`, `/docs`, `/redoc`, and `/openapi.json` require login.
- `AGENT_SERVER_PASSWORD`: optional Basic Auth password. Do not commit this value.
- `AGENT_SERVER_TOKEN`: legacy placeholder, not required by the current Basic Auth flow.
- `DAOLIYU_BASE_URLS`: comma-separated Daoliyu music service base URLs. The server tries them in order. Default `http://127.0.0.1:5173,https://daoliyu.xuguopeng.com`.
- `DAOLIYU_BASE_URL`: legacy single URL fallback when `DAOLIYU_BASE_URLS` is not set.
- `DAOLIYU_USERNAME`: optional Daoliyu login email/username for server-side login.
- `DAOLIYU_PASSWORD`: optional Daoliyu password for server-side login. Do not commit this value.
- `MUSIC_LIBRARY_ROOTS`: comma-separated local music folders scanned by the built-in NAS music service. Default `/data/media`.
- `MUSIC_COVER_DIR`: extracted embedded cover cache. Default `/data/covers`.
- `MINIMAX_SUBSCRIPTION_KEY`: MiniMax Token Plan subscription key for radio TTS. Preferred over `MINIMAX_API_KEY`.
- `MINIMAX_API_KEY`: MiniMax pay-as-you-go API key fallback. Token Plan keys and pay-as-you-go keys are not interchangeable.
- `MINIMAX_GROUP_ID`: MiniMax group ID used by the TTS endpoint.
- `MINIMAX_TTS_MODEL`: MiniMax speech model. Default `speech-2.8-hd`.
- `MINIMAX_TTS_VOICE_ID`: MiniMax voice ID. Default `male-qn-jingying`.
- `RADIO_OUTPUT_DIR`: generated radio audio directory. Default `/data/radio`.
- `LISTENING_PLUGIN_DIRS`: comma-separated private listening-source plugin directories. Default `/data/private_plugins/music_sources,./services/agent-server/private_plugins,./private_plugins`.
- `METADATA_PLUGIN_DIRS`: comma-separated private metadata scraper plugin directories. Default `/data/private_plugins/music_metadata,./services/agent-server/private_plugins,./private_plugins`.

Secret files:

If the NAS UI cannot add environment variables after container creation, create either of these files inside the data volume:

- `/data/secrets/agent-server.env`
- `/data/secrets/daoliyu.env`
- `/data/secrets/music-sources.env`

Example:

```env
AGENT_SERVER_USERNAME=your-admin-name
AGENT_SERVER_PASSWORD=your-long-password
DAOLIYU_MEDIA_ROOT=/data/media/daoliyu
MUSIC_LIBRARY_ROOTS=/data/media/daoliyu,/data/media/sqmusic,/data/media/local
MUSIC_COVER_DIR=/data/covers
MINIMAX_SUBSCRIPTION_KEY=your-token-plan-subscription-key
MINIMAX_GROUP_ID=your-minimax-group-id
MINIMAX_TTS_MODEL=speech-2.8-hd
MINIMAX_TTS_VOICE_ID=male-qn-jingying
RADIO_OUTPUT_DIR=/data/radio
LISTENING_PLUGIN_DIRS=/data/private_plugins/music_sources,./services/agent-server/private_plugins,./private_plugins
METADATA_PLUGIN_DIRS=/data/private_plugins/music_metadata,./services/agent-server/private_plugins,./private_plugins
```

Real environment variables override values from these files.

When auth is enabled, pass the NAS Agent Server username and password with requests:

```bash
curl -u "your-admin-name:your-long-password" http://127.0.0.1:8088/v1/listening/status
```

`/health` stays public for NAS and reverse-proxy health checks.

## Built-in NAS Music Service

The built-in NAS music service is the primary music backend. It handles the
track list, playlists, favorites, play history, covers, lyrics, and audio
streaming from files mounted into `MUSIC_LIBRARY_ROOTS`.

Scan local music files:

```bash
curl -u "your-admin-name:your-long-password" \
  -X POST http://127.0.0.1:8088/v1/music/api/admin/scan
```

Main client-compatible endpoints:

```text
GET    /v1/music/status
POST   /v1/music/api/admin/scan
POST   /v1/music/api/admin/scan/full
POST   /v1/music/api/admin/scan/background
POST   /v1/music/api/admin/scan/background/incremental
GET    /v1/music/api/admin/scan/status
POST   /v1/music/api/admin/scan/cancel
GET    /v1/music/api/admin/metadata/report
GET    /v1/music/api/admin/metadata/scrape/status
POST   /v1/music/api/admin/metadata/scrape/preview
POST   /v1/music/api/admin/metadata/scrape/missing
POST   /v1/music/api/admin/metadata/scrape/apply
POST   /v1/music/api/admin/metadata/scrape/jobs
GET    /v1/music/api/admin/metadata/scrape/jobs
GET    /v1/music/api/admin/metadata/scrape/jobs/{job_id}
POST   /v1/music/api/admin/metadata/scrape/jobs/{job_id}/apply
GET    /v1/music/api/download/sqmusic/status
GET    /v1/music/api/download/sqmusic/search
POST   /v1/music/api/download/sqmusic/song
GET    /v1/music/api/download/sqmusic/tasks
POST   /v1/music/api/download/sqmusic/tasks/{task_id}/refresh
DELETE /v1/music/api/download/sqmusic/tasks/{task_id}
POST   /v1/music/api/download/sqmusic/rescan
GET    /v1/music/api/tracks
GET    /v1/music/api/tracks/{id}
GET    /v1/music/api/tracks/{id}/lyrics
PUT    /v1/music/api/tracks/{id}/lyrics
PATCH  /v1/music/api/tracks/{id}/metadata
GET    /v1/music/audio/{id}
GET    /v1/music/covers/{id}
GET    /v1/music/api/artists
GET    /v1/music/api/artists/{id}
GET    /v1/music/api/artists/{id}/tracks
GET    /v1/music/api/albums
GET    /v1/music/api/albums/{id}
GET    /v1/music/api/albums/{id}/tracks
GET    /v1/music/api/playlists
POST   /v1/music/api/playlists
PATCH  /v1/music/api/playlists/{id}
DELETE /v1/music/api/playlists/{id}
GET    /v1/music/api/playlists/{id}
POST   /v1/music/api/playlists/{id}/tracks
POST   /v1/music/api/playlists/{id}/tracks/batch
PUT    /v1/music/api/playlists/{id}/tracks/order
DELETE /v1/music/api/playlists/{id}/tracks
GET    /v1/music/api/favorites/tracks
POST   /v1/music/api/favorites/tracks
PUT    /v1/music/api/favorites/tracks/{id}
DELETE /v1/music/api/favorites/tracks/{id}
GET    /v1/music/api/recently-played
GET    /v1/music/api/play-history
DELETE /v1/music/api/play-history
POST   /v1/music/api/player/play
POST   /v1/music/api/player/pause
GET    /v1/music/api/stats
POST   /v1/music/radio/daily/build
```

The scanner reads tags with Mutagen and falls back to file names when tags are
missing. Embedded covers are extracted into `MUSIC_COVER_DIR`.
Sidecar lyrics and covers are supported:

- `Song Name.lrc` or `Song Name.txt`
- `Song Name.jpg/png/webp`
- `cover.jpg`, `folder.jpg`, `front.jpg`, `album.jpg`, or `封面.jpg` in the same folder

For large libraries, use the background scan endpoint and poll scan status.

Recommended NAS music mounts:

```yaml
volumes:
  - /volume1/docker/personal-os-agent/data:/data
  - /volume1/media/音乐:/data/media/daoliyu
  - /volume1/docker/sqmusic/file:/data/media/sqmusic
```

The third library root `/data/media/local` is inside the `/data` volume, so its
NAS host path is `/volume1/docker/personal-os-agent/data/media/local`.

Then configure:

```env
DAOLIYU_MEDIA_ROOT=/data/media/daoliyu
MUSIC_LIBRARY_ROOTS=/data/media/daoliyu,/data/media/sqmusic,/data/media/local
```

The client can trigger full and incremental scans:

```text
POST /v1/music/api/admin/scan/full
POST /v1/music/api/admin/scan/incremental
POST /v1/music/api/admin/scan/background
POST /v1/music/api/admin/scan/background/incremental
```

Metadata scrape jobs:

- `POST /v1/music/api/admin/metadata/scrape/jobs` creates a background batch job for tracks missing lyrics, covers, artists, or albums.
- Each job stores provider candidates in SQLite with confidence, status, sanitized raw data, and applied field history.
- `autoApply=true` only applies the best candidate when its confidence is at least `minConfidence`.
- `POST /v1/music/api/admin/metadata/scrape/jobs/{job_id}/apply` can apply saved candidates later.
- Private providers still live in git-ignored `private_plugins`; the public repository keeps only the protocol and task plumbing.
- A personal `sqmusic_metadata.py` provider can use `SQMUSIC_BASE_URL` plus
  `SQMUSIC_PLUG_NAMES` to search sqmusic and return lyrics/covers through the
  same candidate protocol.

sqmusic download bridge:

- `GET /v1/music/api/download/sqmusic/search` searches sqmusic and returns
  normalized tracks with `brTypes` and `preferredBrType`.
- `POST /v1/music/api/download/sqmusic/song` submits one selected track to
  sqmusic `/api/download/downloadSong`; it does not scrape lyrics or covers.
- If `SQMUSIC_USERNAME` and `SQMUSIC_PASSWORD` are configured, the bridge logs
  in to sqmusic before each proxied request and keeps the returned session only
  inside that request.
- `GET /v1/music/api/download/sqmusic/tasks` proxies sqmusic task status.
- `POST /v1/music/api/download/sqmusic/rescan` scans the local NAS library
  after downloads finish. When enabled, it starts a QQ Music metadata scrape job
  only for missing lyrics and covers.

Daily radio mix:

- `POST /v1/music/radio/daily/build` creates a full mixed radio episode:
  MiniMax chat script -> MiniMax TTS intro -> local music files -> MiniMax TTS
  outro -> ffmpeg merged MP3.
- The script uses the current date, Xi'an weather, local/recent playback
  history, and configured MiniMax credentials.
- If the generated recommendation is missing locally, the server attempts a
  sqmusic download, rescans the local library, then starts a QQ Music metadata
  scrape job for missing lyrics/covers.
- The Docker image installs `ffmpeg`; custom deployments must also provide
  `ffmpeg` and `ffprobe` on PATH.

## Daoliyu Music Proxy

The server still exposes unmatched Daoliyu-compatible paths through `/v1/music`
as a fallback while migration is in progress.

Examples:

```bash
curl http://127.0.0.1:8088/v1/music/status
curl http://127.0.0.1:8088/v1/music/endpoints
curl -X POST http://127.0.0.1:8088/v1/music/auth/login
curl http://127.0.0.1:8088/v1/music/auth/status
curl http://127.0.0.1:8088/v1/music/api/auth/bootstrap
curl -X POST http://127.0.0.1:8088/v1/music/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

If Basic Auth is enabled, add `-u "your-admin-name:your-long-password"` to the commands above.

Authenticated Daoliyu calls should pass the Daoliyu token through:

```bash
curl http://127.0.0.1:8088/v1/music/api/tracks \
  -H "Authorization: Bearer <daoliyu-token>"
```

If `DAOLIYU_USERNAME` and `DAOLIYU_PASSWORD` are configured, the Agent Server can login by itself and attach the token to proxied Daoliyu requests when the incoming request has no `Authorization` header.

When running in Docker on Linux NAS, `docker-compose.yml` defaults to trying the local host service first, then the public fallback:

```text
DAOLIYU_BASE_URLS=http://host.docker.internal:5173,https://daoliyu.xuguopeng.com
```

If Daoliyu runs as another container, set `DAOLIYU_BASE_URL` to that service URL.

## Real Audio Playback

The client should play audio through the Agent Server proxy:

```text
GET /v1/music/audio/{track_id}
GET /v1/music/audio/{track_id}/status
```

The Agent Server streams the matched local file with HTTP range support, so
Flutter/just_audio can seek and resume normally. Mount the music library into
the Agent Server container and point `MUSIC_LIBRARY_ROOTS` at that mount:

```yaml
volumes:
  - /volume1/docker/personal-os-agent/data:/data
  - /volume1/media/音乐:/data/media:ro
```

After changing the mounted music folder, run a full scan again.

## Listening History Center

The server exposes a unified listening-history API through `/v1/listening`.

Public/open-source behavior:

- stores unified listening events in SQLite
- syncs Daoliyu/NAS playback history
- defines the private plugin protocol
- does not include third-party music scraping code

Private/self-use behavior:

- NetEase Cloud Music can import copied API/JSON listening-rank data through `netease_history.py`
- QQ Music, Kugou, and Kuwo do not currently expose reliable web playback-history pages in this workflow
- collect QQ/Kugou/Kuwo history through client-side playback capture, manual JSON/CSV import, or a later personal-only desktop/mobile collector
- store only personal source config paths in `/data/secrets/music-sources.env`
- run sync manually or from a scheduled job later

Examples:

```bash
curl http://127.0.0.1:8088/v1/listening/status
curl -X POST http://127.0.0.1:8088/v1/listening/sync \
  -H 'Content-Type: application/json' \
  -d '{"source":"daoliyu","limit":200}'
curl http://127.0.0.1:8088/v1/listening/profile
curl http://127.0.0.1:8088/v1/listening/events?source=daoliyu
```

Private plugin protocol is documented in:

```text
services/agent-server/app/listening_plugins/README.md
```

Private plugin files are ignored by git. The local templates support JSON import first:

```env
NETEASE_HISTORY_JSON=/data/private_exports/netease-history.json
```

For QQ/Kugou/Kuwo, prefer importing normalized events through:

```text
POST /v1/listening/events/import
```

or recording plays from the Flutter client whenever a track is played. Cookie-based crawling should be implemented only in ignored private plugin files and only when a reliable personal-data endpoint is confirmed.
