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
- `LLM_PROVIDER`: text-generation provider label. Default `0029`.
- `OPENAI_COMPAT_BASE_URL`: OpenAI-compatible gateway base URL. Default `https://api.0029.org/v1`. Gateway site: [0029](https://www.0029.org/?promo=AFF1K9).
- `OPENAI_COMPAT_API_KEY`: 0029 API key for `/v1/responses` chat, DJ planning, and radio copywriting. Do not commit this value.
- `OPENAI_COMPAT_MODEL`: model name routed through 0029. Default `gpt-5.5`.
- `TTS_PROVIDER`: spoken-segment provider. Default `fish`.
- `FISH_API_KEY`: Fish Audio API key for DJ spoken segments. Do not commit this value.
- `FISH_TTS_MODEL`: Fish Audio TTS model. Default `s2.1-pro-free`.
- `FISH_TTS_REFERENCE_ID`: fixed Fish `reference_id` / voice model id for all Migi spoken segments. Default `c43ae8e1c3664eac9203f9293fabc3c9`.
- `MINIMAX_*`: legacy fallback fields only; the current DJ workflow does not require MiniMax.
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
LLM_PROVIDER=0029
OPENAI_COMPAT_BASE_URL=https://api.0029.org/v1
OPENAI_COMPAT_API_KEY=your-0029-api-key
OPENAI_COMPAT_MODEL=gpt-5.5
TTS_PROVIDER=fish
FISH_API_KEY=your-fish-audio-key
FISH_TTS_MODEL=s2.1-pro-free
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

Daily radio:

- `GET /v1/dj/today?autoBuild=true` is the preferred client path. It creates a
  Claudio/mmguo-style episode made of playable segments: spoken intro -> songs
  -> next spoken intro -> songs -> outro.
- `POST /v1/music/radio/daily/build` remains as a legacy compatibility endpoint.
- The script uses the current date, Xi'an weather, local/recent playback
  history, the configured 0029 text model, and Fish Audio spoken segments.
- If the generated recommendation is missing locally, the server attempts a
  sqmusic download, rescans the local library, then starts a QQ Music metadata
  scrape job for missing lyrics/covers.
- The Docker image installs `ffmpeg`; custom deployments must also provide
  `ffmpeg` and `ffprobe` on PATH.

## Claudio-Style DJ Agent

The service also exposes a higher-level DJ agent protocol through `/v1/dj`.
This layer keeps the older `/v1/music/radio/*` endpoints working, but adds a
Claudio-style flow:

- profile documents: `taste.md`, `routines.md`, and `mood-rules.md`
- persona skill: the bundled Migi-inspired rational DJ voice
- context window: profile docs, weather, listening profile, recent tracks,
  remembered preferences, recent chat, and execution trace
- structured plan: `say`, `play`, `reason`, `segue`, and optional
  `memoryCandidate`
- playback bridge: episode building returns queue segments. Spoken segments use
  Fish Audio; music segments point to local NAS tracks. It no longer needs to
  merge every song and spoken segment into one long file.
- daily auto-play shape: one episode per day, generated at 07:00, with morning,
  noon/afternoon, and night sections; each section has its own spoken intro and
  three songs

Deployment probe:

```text
GET /version
```

`/version` is intentionally public and does not require Basic Auth. It returns
the current service version and feature flags, for example `v0.3` and
`features.dj=true`. Use it after NAS redeploys to confirm that the running
container is the new image before testing protected `/v1/*` endpoints.

Useful endpoints:

```text
GET  /v1/dj/status
GET  /v1/dj/profile
GET  /v1/dj/context?message=...
GET  /v1/dj/today
POST /v1/dj/profile/intake
POST /v1/dj/chat
POST /v1/dj/plan/today
POST /v1/dj/plan/from-message
POST /v1/dj/episode/build
GET  /v1/dj/plans
GET  /v1/dj/missing-tracks
POST /v1/dj/missing-tracks/process
```

`GET /v1/dj/today` returns today's generated radio episode. Use
`autoBuild=true` if the client should build today's episode on first launch when
the 07:00 scheduler has not run yet. The generated episode is a full-day queue:
morning 3 songs, noon/afternoon 3 songs, night 3 songs, and spoken DJ intros for
each section. Clients should play `segments` in order.

Daily generation data is persisted in SQLite:

- `radio_daily_generations`: one row per day, keyed by `episode_date`.
- `radio_daily_tracks`: the exact songs, stage, order, and recommendation
  reasons used that day.
- `radio_spoken_segments`: spoken copy, Fish Audio output path, model, format,
  and duration for each intro/outro.
- generated spoken audio files use the readable base name
  `migi-YYYY-MM-DD`, for example `migi-2026-07-07-morning-intro.mp3`.

The memory model is mixed on purpose: tables store facts and queryable history,
while `dj_profile_documents` stores human-readable profile summaries such as
`taste.md`, `routines.md`, and `mood-rules.md`. Chat can create memory
candidates; replying `记住` promotes the latest candidate into long-term memory
and appends it to the matching profile document. Replying `这次有效` keeps it
session-only, and `忽略` discards it.

`POST /v1/dj/profile/intake` accepts one batch of answers for favorite artists,
disliked styles, work music, morning/afternoon/night preferences, weather rules,
and DJ speaking style. The answers update the profile documents and are included
in later context windows. The default bundled profile is personal and currently
prefers Jay Chou, Beyond, weather-aware selection, and a not-too-long
Claudio-style spoken intro. The daily playlist is split into three sections with
three tracks per section.

Legacy mix tuning for `/v1/music/radio/daily/build`:

```env
RADIO_MIX_CROSSFADE_SECONDS=2.5
RADIO_MIX_DUCKING_VOLUME=0.18
RADIO_MIX_MUSIC_VOLUME=0.92
```

`POST /v1/dj/chat` returns a playback action so clients can execute music from
chat:

```json
{
  "reply": "...",
  "action": {
    "type": "play_episode | play_tracks | build_and_play_today | none",
    "status": "ready",
    "episode": {"streamUrl": "/v1/music/radio/episodes/.../stream"},
    "tracks": [{"streamUrl": "/v1/music/audio/..."}]
  }
}
```

Client behavior:

- `play_episode`: play `episode.streamUrl` directly.
- `play_tracks`: replace the local queue with local-library `tracks` and start playback.
- `build_and_play_today`: call `GET /v1/dj/today?autoBuild=true`, then play the
  returned episode.
- `none`: keep the response as chat only.

Chat playback actions intentionally do not block on sqmusic downloads. If a
single-track request cannot be matched in the local library, the server falls
back to `build_and_play_today`; explicit download workflows should use the
download endpoints.

Missing-track queue:

- Recommendations that cannot be matched locally are saved to
  `music_missing_track_queue`.
- The global scheduler processes this queue every two hours from 07:00 to 20:00
  local time, with a five-minute startup grace window.
- Processing first rescans the local library, matches already-downloaded songs,
  then submits still-missing songs to sqmusic. After processing it rescans again
  and starts QQ Music metadata scraping for missing lyrics/covers.
- Use `GET /v1/dj/missing-tracks` to inspect the queue.
- Use `POST /v1/dj/missing-tracks/process?limit=20` to run one batch manually.

```env
MISSING_DOWNLOAD_ENABLED=true
MISSING_DOWNLOAD_START_HOUR=7
MISSING_DOWNLOAD_END_HOUR=20
MISSING_DOWNLOAD_INTERVAL_HOURS=2
MISSING_DOWNLOAD_BATCH_SIZE=20
```

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
