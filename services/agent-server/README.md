# Personal OS Agent Server

NAS-side Agent service for Personal OS Agent.

This service is the shared brain and sync hub for the Tauri PC app and future Flutter mobile app.

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
docker compose up --build agent-server
```

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
- `AGENT_SERVER_TOKEN`: optional bearer token placeholder for later authentication.
- `DAOLIYU_BASE_URLS`: comma-separated Daoliyu music service base URLs. The server tries them in order. Default `http://127.0.0.1:5173,https://daoliyu.xuguopeng.com`.
- `DAOLIYU_BASE_URL`: legacy single URL fallback when `DAOLIYU_BASE_URLS` is not set.

## Daoliyu Music Proxy

The server exposes the NAS music service through `/v1/music`.

Examples:

```bash
curl http://127.0.0.1:8088/v1/music/status
curl http://127.0.0.1:8088/v1/music/endpoints
curl http://127.0.0.1:8088/v1/music/api/auth/bootstrap
curl -X POST http://127.0.0.1:8088/v1/music/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

Authenticated Daoliyu calls should pass the Daoliyu token through:

```bash
curl http://127.0.0.1:8088/v1/music/api/tracks \
  -H "Authorization: Bearer <daoliyu-token>"
```

When running in Docker on Linux NAS, `docker-compose.yml` defaults to trying the local host service first, then the public fallback:

```text
DAOLIYU_BASE_URLS=http://host.docker.internal:5173,https://daoliyu.xuguopeng.com
```

If Daoliyu runs as another container, set `DAOLIYU_BASE_URL` to that service URL.
