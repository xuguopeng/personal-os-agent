from functools import lru_cache
from os import getenv

from pydantic import BaseModel


class Settings(BaseModel):
    db_path: str = getenv(
        "AGENT_SERVER_DB_PATH",
        "./data/personal-os-agent-server.sqlite3",
    )
    bind_host: str = getenv("AGENT_SERVER_BIND_HOST", "0.0.0.0")
    port: int = int(getenv("AGENT_SERVER_PORT", "8088"))
    token: str = getenv("AGENT_SERVER_TOKEN", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
