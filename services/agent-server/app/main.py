from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_basic_auth, websocket_auth_is_allowed
from .config import get_settings
from .db import db, initialize_database
from .models import (
    Device,
    DeviceRegisterRequest,
    ExternalAsset,
    HealthResponse,
    ModuleBlueprint,
    SkillSource,
    TaskCreateRequest,
    TaskSession,
)
from .repository import (
    create_task,
    list_rows,
    register_device,
    scan_default_assets,
    scan_default_skills,
)
from .music import router as music_router
from .music import start_radio_scheduler, stop_radio_scheduler
from .local_music import router as local_music_router
from .listening import router as listening_router
from .metadata_scrape import router as metadata_scrape_router
from .sqmusic_download import router as sqmusic_download_router

app = FastAPI(title="Personal OS Agent Server", version="0.1.0")
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
app.include_router(music_router)
app.include_router(listening_router)
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
        service="personal-os-agent-server",
        database=settings.db_path,
    )


@app.get("/v1/modules", response_model=list[ModuleBlueprint])
def list_modules() -> list[dict]:
    with db() as conn:
        return list_rows(conn, "module_blueprints", "module_key ASC")


@app.get("/v1/assets", response_model=list[ExternalAsset])
def list_assets() -> list[dict]:
    with db() as conn:
        return list_rows(conn, "external_assets", "module_key ASC, kind ASC, name ASC")


@app.post("/v1/assets/scan", response_model=list[ExternalAsset])
def scan_assets() -> list[dict]:
    with db() as conn:
        return scan_default_assets(conn)


@app.get("/v1/skills", response_model=list[SkillSource])
def list_skills() -> list[dict]:
    with db() as conn:
        return list_rows(conn, "skill_sources", "category ASC, title ASC")


@app.post("/v1/skills/scan", response_model=list[SkillSource])
def scan_skills() -> list[dict]:
    with db() as conn:
        return scan_default_skills(conn)


@app.get("/v1/devices", response_model=list[Device])
def list_devices() -> list[dict]:
    with db() as conn:
        return list_rows(conn, "devices", "updated_at DESC, name ASC")


@app.post("/v1/devices/register", response_model=Device)
def register_device_endpoint(input: DeviceRegisterRequest) -> dict:
    with db() as conn:
        return register_device(
            conn,
            name=input.name,
            device_type=input.device_type,
            role=input.role,
            device_id=input.id,
        )


@app.get("/v1/tasks", response_model=list[TaskSession])
def list_tasks() -> list[dict]:
    with db() as conn:
        return list_rows(conn, "task_sessions", "created_at DESC")


@app.post("/v1/tasks", response_model=TaskSession)
def create_task_endpoint(input: TaskCreateRequest) -> dict:
    with db() as conn:
        task = create_task(
            conn,
            title=input.title,
            module=input.module,
            source_device_id=input.source_device_id,
            target_device_id=input.target_device_id,
        )
    return task


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
