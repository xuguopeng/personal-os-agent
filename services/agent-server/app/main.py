from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_basic_auth, websocket_auth_is_allowed
from .config import get_settings
from .db import initialize_database
from .models import HealthResponse
from .music import start_radio_scheduler, stop_radio_scheduler
from .local_music import router as local_music_router
from .listening import router as listening_router
from .metadata_scrape import router as metadata_scrape_router
from .sqmusic_download import router as sqmusic_download_router
from .dj import router as dj_router

APP_VERSION = "v0.4.3"

app = FastAPI(title="Personal OS Agent Server", version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_headers=["*"],
    allow_methods=["*"],
    allow_origins=["*"],
)
app.middleware("http")(require_basic_auth)
app.include_router(local_music_router)
app.include_router(metadata_scrape_router)
app.include_router(sqmusic_download_router)
app.include_router(listening_router)
app.include_router(dj_router)
active_connections: dict[str, WebSocket] = {}


@app.on_event("startup")
async def startup() -> None:
    initialize_database()
    start_radio_scheduler()


@app.on_event("shutdown")
async def shutdown() -> None:
    await stop_radio_scheduler()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service="mu-music-server",
        database=settings.db_path,
    )


@app.get("/version")
def version() -> dict[str, object]:
    return {
        "version": APP_VERSION,
        "service": "mu-music-server",
        "features": {
            "dj": True,
            "daypartRadio": True,
            "missingTrackQueue": True,
            "playlistSegments": True,
        },
    }


@app.websocket("/v1/ws/{device_id}")
async def websocket_endpoint(websocket: WebSocket, device_id: str) -> None:
    if not await websocket_auth_is_allowed(websocket):
        return
    await websocket.accept()
    active_connections[device_id] = websocket
    try:
        await websocket.send_json(
            {
                "type": "connected",
                "deviceId": device_id,
                "message": "NAS Agent Server WebSocket connected.",
            }
        )
        while True:
            payload = await websocket.receive_json()
            await websocket.send_json(
                {
                    "type": "ack",
                    "deviceId": device_id,
                    "payload": payload,
                }
            )
    except WebSocketDisconnect:
        active_connections.pop(device_id, None)
