from __future__ import annotations

import base64
import secrets
from typing import Any

from fastapi import WebSocket
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .config import get_settings


PROTECTED_PATHS = ("/v1", "/docs", "/redoc", "/openapi.json")


def auth_is_configured() -> bool:
    settings = get_settings()
    return bool(settings.username and settings.password)


def auth_is_misconfigured() -> bool:
    settings = get_settings()
    return bool(settings.username or settings.password) and not auth_is_configured()


def path_requires_auth(path: str) -> bool:
    return path.startswith(PROTECTED_PATHS)


def authenticate_header(authorization: str | None) -> bool:
    settings = get_settings()
    if not auth_is_configured():
        return False
    username, password = parse_basic_auth(authorization)
    return secrets.compare_digest(username, settings.username) and secrets.compare_digest(
        password,
        settings.password,
    )


async def require_basic_auth(request: Request, call_next: Any) -> Response:
    if not path_requires_auth(request.url.path):
        return await call_next(request)
    if auth_is_misconfigured():
        return JSONResponse(
            status_code=503,
            content={
                "detail": "AGENT_SERVER_USERNAME and AGENT_SERVER_PASSWORD must be configured together.",
            },
        )
    if not auth_is_configured():
        return await call_next(request)
    if authenticate_header(request.headers.get("authorization")):
        return await call_next(request)
    return unauthorized_response()


async def websocket_auth_is_allowed(websocket: WebSocket) -> bool:
    if auth_is_misconfigured():
        await websocket.close(code=1011, reason="Agent Server auth is misconfigured.")
        return False
    if not auth_is_configured():
        return True
    if authenticate_header(websocket.headers.get("authorization")):
        return True
    await websocket.close(code=1008, reason="Authentication required.")
    return False


def parse_basic_auth(authorization: str | None) -> tuple[str, str]:
    if not authorization:
        return "", ""
    scheme, _, encoded = authorization.partition(" ")
    if scheme.lower() != "basic" or not encoded:
        return "", ""
    try:
        decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return "", ""
    username, separator, password = decoded.partition(":")
    if not separator:
        return "", ""
    return username, password


def unauthorized_response() -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"detail": "Authentication required."},
        headers={"WWW-Authenticate": 'Basic realm="Personal OS Agent"'},
    )
