from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    database: str


class ModuleBlueprint(BaseModel):
    module_key: str
    display_name: str
    description: str
    source_refs_json: str
    agent_triggers_json: str
    current_phase: str
    next_action: str
    created_at: str
    updated_at: str


class ExternalAsset(BaseModel):
    id: str
    name: str
    kind: str
    module_key: str
    source_path: str
    summary: str
    status: str
    tags_json: str
    launch_command: str
    build_command: str
    last_scanned_at: str | None
    created_at: str
    updated_at: str


class SkillSource(BaseModel):
    id: str
    title: str
    category: str
    source_path: str
    summary: str
    enabled: bool
    indexed: bool
    last_indexed_at: str | None
    created_at: str
    updated_at: str


class DeviceRegisterRequest(BaseModel):
    id: str | None = None
    name: str
    device_type: str = Field(pattern="^(desktop|mobile|server|browser)$")
    role: str = ""


class Device(BaseModel):
    id: str
    name: str
    device_type: str
    role: str
    status: str
    last_seen_at: str | None
    created_at: str
    updated_at: str


class TaskCreateRequest(BaseModel):
    title: str
    module: str
    source_device_id: str | None = None
    target_device_id: str | None = None


class TaskSession(BaseModel):
    id: str
    title: str
    module: str
    status: str
    source_device_id: str | None
    target_device_id: str | None
    created_at: str
    updated_at: str
