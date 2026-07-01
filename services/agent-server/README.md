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
