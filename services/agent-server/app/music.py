from __future__ import annotations

import asyncio
import base64
import json
import math
import sqlite3
import subprocess
import uuid
import wave
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse

from .config import get_settings
from .db import db

router = APIRouter(prefix="/v1/music", tags=["music"])

RADIO_SCHEDULER_TASK: asyncio.Task | None = None
RADIO_SCHEDULER_STATE: dict[str, Any] = {
    "running": False,
    "lastCheckAt": "",
    "lastRunDate": "",
    "lastRunJobId": "",
    "lastError": "",
}

DAOLIYU_TOKEN_CACHE: dict[str, Any] = {
    "token": "",
    "baseUrl": "",
    "user": None,
}

DAOLIYU_ENDPOINTS: list[dict[str, str]] = [
    {"method": "DELETE", "path": "/api/admin/scan-paths/{id}", "summary": "删除扫描路径"},
    {"method": "DELETE", "path": "/api/admin/users/{id}", "summary": "删除用户"},
    {"method": "PATCH", "path": "/api/admin/users/{id}", "summary": "更新用户"},
    {"method": "DELETE", "path": "/api/favorites/albums/{id}", "summary": "取消收藏专辑"},
    {"method": "DELETE", "path": "/api/favorites/audiobooks/{id}", "summary": "取消收藏有声书"},
    {"method": "DELETE", "path": "/api/favorites/playlists/{id}", "summary": "取消收藏歌单"},
    {"method": "DELETE", "path": "/api/favorites/tracks/{id}", "summary": "取消收藏曲目"},
    {"method": "DELETE", "path": "/api/library/audiobooks/{id}/cover", "summary": "删除有声书封面"},
    {"method": "POST", "path": "/api/library/audiobooks/{id}/cover", "summary": "上传有声书封面"},
    {"method": "DELETE", "path": "/api/player/queue/{id}", "summary": "删除播放队列项"},
    {"method": "DELETE", "path": "/api/playlists/{id}", "summary": "删除歌单"},
    {"method": "GET", "path": "/api/playlists/{id}", "summary": "获取歌单详情"},
    {"method": "PATCH", "path": "/api/playlists/{id}", "summary": "更新歌单"},
    {"method": "DELETE", "path": "/api/playlists/{id}/tracks/{trackId}", "summary": "删除歌单曲目"},
    {"method": "GET", "path": "/api/admin/audiobooks/settings", "summary": "获取有声书设置"},
    {"method": "PUT", "path": "/api/admin/audiobooks/settings", "summary": "更新有声书设置"},
    {"method": "GET", "path": "/api/admin/metadata-providers", "summary": "列出元数据提供商"},
    {"method": "GET", "path": "/api/admin/plugins", "summary": "获取插件"},
    {"method": "GET", "path": "/api/admin/scan-paths", "summary": "获取扫描路径"},
    {"method": "POST", "path": "/api/admin/scan-paths", "summary": "创建扫描路径"},
    {"method": "GET", "path": "/api/admin/shared-metadata", "summary": "列出共享元数据"},
    {"method": "PUT", "path": "/api/admin/shared-metadata", "summary": "更新共享元数据"},
    {"method": "GET", "path": "/api/admin/stats", "summary": "获取管理统计"},
    {"method": "GET", "path": "/api/admin/transcoding/config", "summary": "获取转码配置"},
    {"method": "POST", "path": "/api/admin/transcoding/config", "summary": "保存转码配置"},
    {"method": "GET", "path": "/api/admin/transcoding/stats", "summary": "获取转码统计"},
    {"method": "GET", "path": "/api/admin/users", "summary": "列出用户"},
    {"method": "POST", "path": "/api/admin/users", "summary": "创建用户"},
    {"method": "GET", "path": "/api/auth/bootstrap", "summary": "获取引导状态"},
    {"method": "GET", "path": "/api/auth/profile", "summary": "获取当前用户资料"},
    {"method": "GET", "path": "/api/favorites/albums", "summary": "列出收藏专辑"},
    {"method": "POST", "path": "/api/favorites/albums", "summary": "收藏专辑"},
    {"method": "GET", "path": "/api/favorites/audiobooks", "summary": "列出收藏有声书"},
    {"method": "POST", "path": "/api/favorites/audiobooks", "summary": "收藏有声书"},
    {"method": "GET", "path": "/api/favorites/playlists", "summary": "列出收藏歌单"},
    {"method": "POST", "path": "/api/favorites/playlists", "summary": "收藏歌单"},
    {"method": "GET", "path": "/api/favorites/tracks", "summary": "列出收藏曲目"},
    {"method": "POST", "path": "/api/favorites/tracks", "summary": "收藏曲目"},
    {"method": "GET", "path": "/api/library/albums", "summary": "列出专辑"},
    {"method": "GET", "path": "/api/library/albums/{id}", "summary": "获取专辑详情"},
    {"method": "GET", "path": "/api/library/artists", "summary": "列出艺术家"},
    {"method": "GET", "path": "/api/library/artists/{id}", "summary": "获取艺术家详情"},
    {"method": "GET", "path": "/api/library/audiobooks", "summary": "列出有声书"},
    {"method": "GET", "path": "/api/library/audiobooks/{id}", "summary": "获取有声书详情"},
    {"method": "PATCH", "path": "/api/library/audiobooks/{id}", "summary": "更新有声书"},
    {"method": "GET", "path": "/api/library/audiobooks/progress", "summary": "获取有声书进度"},
    {"method": "GET", "path": "/api/library/branding", "summary": "获取品牌配置"},
    {"method": "GET", "path": "/api/library/playback-history/recent", "summary": "获取最近播放"},
    {"method": "GET", "path": "/api/library/playback/top", "summary": "获取播放排行"},
    {"method": "GET", "path": "/api/library/recommendations/daily", "summary": "获取每日推荐"},
    {"method": "GET", "path": "/api/library/videos", "summary": "列出视频"},
    {"method": "GET", "path": "/api/library/videos/{id}", "summary": "获取视频详情"},
    {"method": "GET", "path": "/api/library/videos/playlists", "summary": "获取视频歌单"},
    {"method": "GET", "path": "/api/player", "summary": "获取播放器状态"},
    {"method": "GET", "path": "/api/playlists", "summary": "获取歌单"},
    {"method": "POST", "path": "/api/playlists", "summary": "创建歌单"},
    {"method": "GET", "path": "/api/playlists/{id}/track-ids", "summary": "获取歌单曲目 ID"},
    {"method": "GET", "path": "/api/playlists/mine", "summary": "获取我的歌单"},
    {"method": "GET", "path": "/api/playlists/public", "summary": "获取公开歌单"},
    {"method": "GET", "path": "/api/tracks", "summary": "列出曲目"},
    {"method": "GET", "path": "/api/tracks/{id}", "summary": "获取曲目详情"},
    {"method": "PATCH", "path": "/api/admin/albums/{id}", "summary": "更新专辑"},
    {"method": "PATCH", "path": "/api/admin/artists/{id}", "summary": "更新艺术家"},
    {"method": "PATCH", "path": "/api/admin/metadata-providers/{id}", "summary": "更新元数据提供商"},
    {"method": "PATCH", "path": "/api/admin/system-branding", "summary": "更新系统品牌"},
    {"method": "PATCH", "path": "/api/admin/tracks/{id}", "summary": "更新曲目"},
    {"method": "PATCH", "path": "/api/auth/myprofile", "summary": "更新我的资料"},
    {"method": "PATCH", "path": "/api/auth/password", "summary": "修改密码"},
    {"method": "PATCH", "path": "/api/favorites/albums/{id}/pin", "summary": "置顶收藏专辑"},
    {"method": "PATCH", "path": "/api/favorites/audiobooks/{id}/pin", "summary": "置顶收藏有声书"},
    {"method": "PATCH", "path": "/api/favorites/playlists/{id}/pin", "summary": "置顶收藏歌单"},
    {"method": "PATCH", "path": "/api/playlists/{id}/tracks/reorder", "summary": "重排歌单曲目"},
    {"method": "POST", "path": "/api/admin/metadata/apply", "summary": "应用元数据"},
    {"method": "POST", "path": "/api/admin/metadata/artists/enrich-missing", "summary": "补全缺失艺术家元数据"},
    {"method": "POST", "path": "/api/admin/metadata/artists/enrich/{id}", "summary": "丰富艺术家元数据"},
    {"method": "POST", "path": "/api/admin/metadata/preview", "summary": "预览元数据"},
    {"method": "POST", "path": "/api/admin/scan", "summary": "扫描音乐库"},
    {"method": "POST", "path": "/api/admin/scan/incremental", "summary": "增量扫描音乐库"},
    {"method": "POST", "path": "/api/admin/shared-metadata/enrich", "summary": "丰富共享元数据"},
    {"method": "POST", "path": "/api/admin/shared-metadata/push", "summary": "推送共享元数据"},
    {"method": "POST", "path": "/api/admin/system-branding/logo", "summary": "上传 Logo"},
    {"method": "POST", "path": "/api/admin/transcoding/clear", "summary": "清空转码缓存"},
    {"method": "POST", "path": "/api/auth/avatar", "summary": "上传头像"},
    {"method": "POST", "path": "/api/auth/bootstrap-admin", "summary": "引导创建管理员"},
    {"method": "POST", "path": "/api/auth/login", "summary": "登录"},
    {"method": "POST", "path": "/api/library/audiobooks/{id}/play", "summary": "播放有声书"},
    {"method": "POST", "path": "/api/library/audiobooks/{id}/progress", "summary": "保存有声书进度"},
    {"method": "POST", "path": "/api/player/next", "summary": "下一首"},
    {"method": "POST", "path": "/api/player/pause", "summary": "暂停"},
    {"method": "POST", "path": "/api/player/play", "summary": "播放"},
    {"method": "POST", "path": "/api/player/prev", "summary": "上一首"},
    {"method": "POST", "path": "/api/player/queue", "summary": "创建播放队列"},
    {"method": "PUT", "path": "/api/player/queue", "summary": "更新播放队列"},
    {"method": "POST", "path": "/api/player/queue/{id}/move", "summary": "移动队列项"},
    {"method": "POST", "path": "/api/player/queue/item", "summary": "添加到播放队列"},
    {"method": "POST", "path": "/api/player/seek", "summary": "跳转播放位置"},
    {"method": "POST", "path": "/api/player/shuffle", "summary": "切换随机播放"},
    {"method": "POST", "path": "/api/player/volume", "summary": "设置音量"},
    {"method": "POST", "path": "/api/playlists/{id}/cover", "summary": "上传歌单封面"},
    {"method": "POST", "path": "/api/playlists/{id}/tracks", "summary": "添加歌单曲目"},
]

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
}


@router.get("/status")
async def daoliyu_status() -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=8) as client:
        for base_url in daoliyu_base_urls():
            try:
                response = await client.get(f"{base_url}/api/auth/bootstrap")
            except httpx.HTTPError as error:
                checks.append(
                    {
                        "baseUrl": base_url,
                        "status": "error",
                        "message": f"不可达：{error}",
                    }
                )
                continue
            check = {
                "baseUrl": base_url,
                "status": "connected" if response.status_code < 500 else "error",
                "httpStatus": response.status_code,
                "message": "可用" if response.status_code < 500 else response.text[:300],
            }
            checks.append(check)
            if check["status"] == "connected":
                return {
                    "status": "connected",
                    "baseUrl": base_url,
                    "activeBaseUrl": base_url,
                    "checks": checks,
                    "message": "倒流服务已连接。",
                }
    return {
        "status": "error",
        "baseUrl": daoliyu_base_urls()[0],
        "activeBaseUrl": None,
        "checks": checks,
        "message": "所有倒流服务上游都不可达。",
    }


@router.get("/endpoints")
def list_daoliyu_endpoints() -> dict[str, Any]:
    return {
        "service": "daoliyu",
        "baseUrl": daoliyu_base_urls()[0],
        "baseUrls": daoliyu_base_urls(),
        "count": len(DAOLIYU_ENDPOINTS),
        "proxyPrefix": "/v1/music",
        "auth": "登录接口走 /v1/music/api/auth/login；其他接口把倒流 token 放在 Authorization: Bearer <token>。",
        "endpoints": DAOLIYU_ENDPOINTS,
    }


@router.post("/auth/login")
async def login_daoliyu_with_configured_credentials() -> JSONResponse:
    settings = get_settings()
    if not settings.daoliyu_username or not settings.daoliyu_password:
        return JSONResponse(
            status_code=400,
            content={
                "status": "not_configured",
                "message": "NAS 服务端未配置 DAOLIYU_USERNAME / DAOLIYU_PASSWORD。",
            },
        )

    result = await login_daoliyu()
    if result["status"] != "authenticated":
        return JSONResponse(status_code=200, content=result)
    return JSONResponse(content=safe_auth_status(result))


@router.get("/auth/status")
async def daoliyu_auth_status() -> dict[str, Any]:
    if not DAOLIYU_TOKEN_CACHE["token"]:
        return {
            "status": "not_authenticated",
            "configured": bool(
                get_settings().daoliyu_username and get_settings().daoliyu_password
            ),
            "secretFilesLoaded": len(get_settings().loaded_secret_files),
            "baseUrl": "",
            "user": None,
            "message": "尚未登录倒流音乐服务。",
        }

    profile = await fetch_daoliyu_profile()
    if profile["status"] == "authenticated":
        return safe_auth_status(profile)
    DAOLIYU_TOKEN_CACHE.update({"token": "", "baseUrl": "", "user": None})
    return profile


@router.post("/auth/logout")
def logout_daoliyu() -> dict[str, Any]:
    DAOLIYU_TOKEN_CACHE.update({"token": "", "baseUrl": "", "user": None})
    return {
        "status": "not_authenticated",
        "message": "已清除倒流音乐服务 token 缓存。",
    }


@router.get("/audio/{track_id}/status")
async def music_audio_status(track_id: str) -> dict[str, Any]:
    track = await fetch_daoliyu_track(track_id)
    if not isinstance(track, dict):
        return {
            "status": "error",
            "message": "没有找到这首歌的详情，无法播放。",
        }

    stream_url = await build_daoliyu_track_stream_url(track_id)
    if stream_url:
        return {
            "status": "ready",
            "source": "daoliyu_stream",
            "message": "Daoliyu 音频流已就绪。",
        }

    direct_url = first_string_value(
        track,
        "audioUrl",
        "streamUrl",
        "fileUrl",
        "mediaUrl",
        "downloadUrl",
        "url",
    )
    if direct_url.startswith("http://") or direct_url.startswith("https://"):
        return {
            "status": "ready",
            "source": "upstream_url",
            "message": "音频源已就绪。",
        }

    file_path = resolve_track_file_path(track)
    if not file_path:
        return {
            "status": "not_configured",
            "source": "local_file",
            "message": "NAS 服务端没有找到本地媒体文件。请把音乐目录挂载到容器，并配置 DAOLIYU_MEDIA_ROOT。",
            "mediaRoot": get_settings().daoliyu_media_root,
            "trackFilePath": track.get("filePath") or track.get("path") or "",
        }

    return {
        "status": "ready",
        "source": "local_file",
        "message": "音频源已就绪。",
        "contentType": guess_audio_media_type(file_path),
        "fileSize": file_path.stat().st_size,
    }


@router.get("/radio/status")
def radio_status() -> dict[str, Any]:
    settings = get_settings()
    output_dir = Path(settings.radio_output_dir)
    return {
        "status": "ready",
        "outputDir": str(output_dir),
        "minimaxConfigured": bool(resolved_minimax_key() and settings.minimax_group_id),
        "voiceId": settings.minimax_tts_voice_id,
        "model": settings.minimax_tts_model,
        "message": "音乐电台服务已就绪。",
    }


@router.get("/radio/daily/status")
def daily_radio_status() -> dict[str, Any]:
    settings = get_settings()
    return {
        "status": "ready",
        "enabled": settings.radio_daily_enabled,
        "time": settings.radio_daily_time,
        "timezone": settings.radio_daily_timezone,
        "nextRunAt": next_daily_radio_run_at().isoformat(),
        "weather": {
            "city": settings.radio_weather_city,
            "lat": settings.radio_weather_lat,
            "lon": settings.radio_weather_lon,
        },
        "recentLimit": settings.radio_recent_limit,
        "scheduler": RADIO_SCHEDULER_STATE,
        "message": "每日音乐电台定时任务已配置。",
    }


@router.post("/radio/daily/run")
async def run_daily_radio_now() -> JSONResponse:
    result = await create_daily_radio_episode(force=True)
    return JSONResponse(content=result)


@router.post("/radio/daily/build")
async def build_daily_radio_mix(payload: dict[str, Any] | None = None) -> JSONResponse:
    result = await create_daily_radio_mix_episode(payload or {})
    return JSONResponse(content=result)


@router.get("/radio/episodes")
def list_radio_episodes() -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM music_radio_episodes
            ORDER BY created_at DESC
            LIMIT 50
            """
        ).fetchall()
    return {
        "items": [radio_episode_row_to_dict(row) for row in rows],
    }


@router.get("/radio/jobs/{job_id}")
def get_radio_job(job_id: str) -> JSONResponse:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM music_radio_jobs WHERE id = ?",
            (job_id,),
        ).fetchone()
    if row is None:
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": "没有找到这个电台生成任务。"},
        )
    return JSONResponse(content=radio_job_row_to_dict(row))


@router.post("/radio/jobs")
async def create_radio_job(payload: dict[str, Any]) -> JSONResponse:
    raw_track_ids = payload.get("trackIds") or payload.get("track_ids") or []
    track_ids = [
        str(item).strip()
        for item in raw_track_ids
        if str(item).strip() and not str(item).startswith("radio_")
    ][:12]
    title = str(payload.get("title") or "").strip() or "今日 NAS 音乐电台"
    job_id = uuid.uuid4().hex

    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_radio_jobs (
                id, title, status, track_ids_json
            ) VALUES (?, ?, 'running', ?)
            """,
            (job_id, title, json.dumps(track_ids, ensure_ascii=False)),
        )

    try:
        tracks = await fetch_radio_seed_tracks(track_ids)
        intro_script = build_radio_intro_script(title, tracks, weather=None, daily=False)
        outro_script = build_radio_outro_script(title, tracks, weather=None)
        script = f"{intro_script}\n\n--- 收尾 ---\n{outro_script}"
        episode = await generate_radio_episode(
            job_id=job_id,
            title=title,
            track_ids=track_ids,
            script=script,
            intro_script=intro_script,
            outro_script=outro_script,
            tracks=tracks,
        )
        with db() as conn:
            conn.execute(
                """
                UPDATE music_radio_jobs
                SET status = 'completed',
                    mode = ?,
                    script = ?,
                    episode_id = ?,
                    updated_at = current_timestamp
                WHERE id = ?
                """,
                (episode["generator"], script, episode["id"], job_id),
            )
        return JSONResponse(
            content={
                "id": job_id,
                "title": title,
                "status": "completed",
                "episode": episode,
                "message": "音乐电台已生成。",
            }
        )
    except Exception as error:
        with db() as conn:
            conn.execute(
                """
                UPDATE music_radio_jobs
                SET status = 'failed', error = ?, updated_at = current_timestamp
                WHERE id = ?
                """,
                (str(error), job_id),
            )
        return JSONResponse(
            status_code=500,
            content={
                "id": job_id,
                "title": title,
                "status": "failed",
                "message": f"音乐电台生成失败：{error}",
            },
        )


@router.get("/radio/episodes/{episode_id}/stream")
def stream_radio_episode(episode_id: str, request: Request) -> Response:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM music_radio_episodes WHERE id = ?",
            (episode_id,),
        ).fetchone()
    if row is None:
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": "没有找到这个电台节目。"},
        )
    episode = radio_episode_row_to_dict(row)
    audio_path = Path(episode["audioPath"])
    output_root = Path(get_settings().radio_output_dir).resolve()
    try:
        audio_path.resolve().relative_to(output_root)
    except ValueError:
        return JSONResponse(
            status_code=403,
            content={"status": "error", "message": "电台音频路径不在允许目录。"},
        )
    if not audio_path.exists() or not audio_path.is_file():
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": "电台音频文件不存在。"},
        )
    return ranged_file_response(audio_path, request)


@router.get("/radio/episodes/{episode_id}/outro/stream")
def stream_radio_episode_outro(episode_id: str, request: Request) -> Response:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM music_radio_episodes WHERE id = ?",
            (episode_id,),
        ).fetchone()
    if row is None:
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": "没有找到这个电台节目。"},
        )
    episode = radio_episode_row_to_dict(row)
    audio_path = Path(episode.get("outroAudioPath") or "")
    output_root = Path(get_settings().radio_output_dir).resolve()
    try:
        audio_path.resolve().relative_to(output_root)
    except (ValueError, RuntimeError):
        return JSONResponse(
            status_code=403,
            content={"status": "error", "message": "电台收尾音频路径不在允许目录。"},
        )
    if not audio_path.exists() or not audio_path.is_file():
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": "电台收尾音频文件不存在。"},
        )
    return ranged_file_response(audio_path, request)


@router.get("/audio/{track_id}")
async def stream_music_audio(track_id: str, request: Request) -> Response:
    track = await fetch_daoliyu_track(track_id)
    if not isinstance(track, dict):
        return JSONResponse(
            status_code=404,
            content={
                "status": "error",
                "message": "没有找到这首歌的详情，无法播放。",
            },
        )

    stream_url = await build_daoliyu_track_stream_url(track_id)
    if stream_url:
        return await proxy_audio_url(stream_url, request)

    direct_url = first_string_value(
        track,
        "audioUrl",
        "streamUrl",
        "fileUrl",
        "mediaUrl",
        "downloadUrl",
        "url",
    )
    if direct_url.startswith("http://") or direct_url.startswith("https://"):
        return await proxy_audio_url(direct_url, request)

    file_path = resolve_track_file_path(track)
    if not file_path:
        return JSONResponse(
            status_code=404,
            content={
                "status": "not_configured",
                "message": "曲目没有可播放 URL，且 NAS 服务端没有找到本地媒体文件。请把音乐目录挂载到容器，并配置 DAOLIYU_MEDIA_ROOT。",
                "mediaRoot": get_settings().daoliyu_media_root,
                "trackFilePath": track.get("filePath") or track.get("path") or "",
            },
        )

    return ranged_file_response(file_path, request)


@router.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_daoliyu(full_path: str, request: Request) -> Response:
    target_path = normalize_proxy_path(full_path)
    body = await request.body()
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }
    if should_auto_attach_token(target_path, headers):
        token = await get_or_login_daoliyu_token()
        if token:
            headers["authorization"] = f"Bearer {token}"
    errors: list[dict[str, str]] = []
    upstream: httpx.Response | None = None
    target_url = ""
    async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
        for base_url in daoliyu_base_urls():
            target_url = f"{base_url}{target_path}"
            try:
                upstream = await client.request(
                    request.method,
                    target_url,
                    params=request.query_params,
                    content=body,
                    headers=headers,
                )
            except httpx.HTTPError as error:
                errors.append({"target": target_url, "message": str(error)})
                continue
            if upstream.status_code < 500:
                break
            errors.append({"target": target_url, "message": f"HTTP {upstream.status_code}"})

    if upstream is None:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "message": "倒流服务代理失败：所有上游都不可达。",
                "errors": errors,
            },
        )

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )


async def fetch_daoliyu_track(track_id: str) -> Any:
    token = await get_or_login_daoliyu_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        for base_url in daoliyu_base_urls():
            try:
                response = await client.get(
                    f"{base_url}/api/tracks/{track_id}",
                    headers=headers,
                )
            except httpx.HTTPError:
                continue
            if response.status_code == 404:
                return None
            if response.status_code < 400:
                return response.json()
    return None


async def fetch_radio_seed_tracks(track_ids: list[str]) -> list[dict[str, Any]]:
    local_tracks = fetch_local_radio_seed_tracks(track_ids)
    if local_tracks:
        return local_tracks[:8]

    tracks: list[dict[str, Any]] = []
    for track_id in track_ids:
        track = await fetch_daoliyu_track(track_id)
        if isinstance(track, dict):
            tracks.append(track)
    if tracks:
        return tracks[:8]

    token = await get_or_login_daoliyu_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        for base_url in daoliyu_base_urls():
            try:
                response = await client.get(
                    f"{base_url}/api/tracks",
                    params={"limit": 8, "offset": 0},
                    headers=headers,
                )
            except httpx.HTTPError:
                continue
            if response.status_code < 400:
                payload = response.json()
                items = payload.get("items") if isinstance(payload, dict) else payload
                if isinstance(items, list):
                    return [item for item in items if isinstance(item, dict)][:8]
    return []


def fetch_local_radio_seed_tracks(track_ids: list[str]) -> list[dict[str, Any]]:
    with db() as conn:
        if track_ids:
            tracks: list[dict[str, Any]] = []
            for track_id in track_ids:
                row = conn.execute(
                    "SELECT * FROM music_tracks WHERE id = ?",
                    (track_id,),
                ).fetchone()
                if row:
                    tracks.append(local_track_row_to_radio_dict(row))
            if tracks:
                return tracks
        rows = conn.execute(
            """
            SELECT *
            FROM music_tracks
            ORDER BY
                CASE WHEN last_played_at IS NULL THEN 1 ELSE 0 END,
                last_played_at DESC,
                play_count DESC,
                updated_at DESC
            LIMIT 8
            """
        ).fetchall()
    return [local_track_row_to_radio_dict(row) for row in rows]


def start_radio_scheduler() -> None:
    global RADIO_SCHEDULER_TASK
    if RADIO_SCHEDULER_TASK and not RADIO_SCHEDULER_TASK.done():
        return
    RADIO_SCHEDULER_STATE.update({"running": True, "lastError": ""})
    RADIO_SCHEDULER_TASK = asyncio.create_task(radio_scheduler_loop())


async def stop_radio_scheduler() -> None:
    global RADIO_SCHEDULER_TASK
    if RADIO_SCHEDULER_TASK is None:
        return
    RADIO_SCHEDULER_TASK.cancel()
    try:
        await RADIO_SCHEDULER_TASK
    except asyncio.CancelledError:
        pass
    RADIO_SCHEDULER_TASK = None
    RADIO_SCHEDULER_STATE["running"] = False


async def radio_scheduler_loop() -> None:
    while True:
        try:
            settings = get_settings()
            now = datetime.now(ZoneInfo(settings.radio_daily_timezone))
            RADIO_SCHEDULER_STATE["lastCheckAt"] = now.isoformat()
            if settings.radio_daily_enabled and should_run_daily_radio(now):
                result = await create_daily_radio_episode()
                RADIO_SCHEDULER_STATE["lastRunDate"] = now.date().isoformat()
                RADIO_SCHEDULER_STATE["lastRunJobId"] = result.get("id", "")
                RADIO_SCHEDULER_STATE["lastError"] = ""
        except Exception as error:
            RADIO_SCHEDULER_STATE["lastError"] = str(error)
        await asyncio.sleep(60)


def should_run_daily_radio(now: datetime) -> bool:
    scheduled_time = parse_daily_time(get_settings().radio_daily_time)
    if now.time().replace(second=0, microsecond=0) < scheduled_time:
        return False
    today = now.date()
    if RADIO_SCHEDULER_STATE.get("lastRunDate") == today.isoformat():
        return False
    return not daily_radio_episode_exists(today)


def parse_daily_time(value: str) -> time:
    try:
        hour_text, minute_text = value.split(":", 1)
        return time(hour=int(hour_text), minute=int(minute_text))
    except (ValueError, TypeError):
        return time(hour=7, minute=30)


def next_daily_radio_run_at() -> datetime:
    settings = get_settings()
    tz = ZoneInfo(settings.radio_daily_timezone)
    now = datetime.now(tz)
    scheduled = datetime.combine(now.date(), parse_daily_time(settings.radio_daily_time), tz)
    if scheduled <= now or daily_radio_episode_exists(now.date()):
        scheduled += timedelta(days=1)
    return scheduled


def daily_radio_episode_exists(day: date) -> bool:
    title_prefix = f"西安天气音乐电台 {day.isoformat()}"
    with db() as conn:
        row = conn.execute(
            """
            SELECT id FROM music_radio_episodes
            WHERE title LIKE ?
            LIMIT 1
            """,
            (f"{title_prefix}%",),
        ).fetchone()
    return row is not None


def latest_daily_radio_mix_episode(day: date) -> dict[str, Any] | None:
    day_text = day.isoformat()
    with db() as conn:
        row = conn.execute(
            """
            SELECT * FROM music_radio_episodes
            WHERE title LIKE ?
              AND generator LIKE '%ffmpeg%'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (f"%{day_text}%",),
        ).fetchone()
    return radio_episode_row_to_dict(row) if row else None


async def create_daily_radio_episode(force: bool = False) -> dict[str, Any]:
    settings = get_settings()
    now = datetime.now(ZoneInfo(settings.radio_daily_timezone))
    today = now.date()
    if not force and daily_radio_episode_exists(today):
        return {
            "status": "skipped",
            "message": "今天的每日音乐电台已经生成过。",
            "date": today.isoformat(),
        }

    title = f"西安天气音乐电台 {today.isoformat()}"
    weather = await fetch_radio_weather()
    tracks = await fetch_recent_playback_tracks(settings.radio_recent_limit)
    if not tracks:
        tracks = await fetch_radio_seed_tracks([])
    track_ids = [
        str(track.get("id") or "").strip()
        for track in tracks
        if str(track.get("id") or "").strip()
    ][:12]
    intro_script = build_radio_intro_script(title, tracks, weather=weather, daily=True)
    outro_script = build_radio_outro_script(title, tracks, weather=weather)
    script = f"{intro_script}\n\n--- 收尾 ---\n{outro_script}"
    job_id = uuid.uuid4().hex
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_radio_jobs (
                id, title, status, track_ids_json, script
            ) VALUES (?, ?, 'running', ?, ?)
            """,
            (job_id, title, json.dumps(track_ids, ensure_ascii=False), script),
        )
    try:
        episode = await generate_radio_episode(
            job_id=job_id,
            title=title,
            track_ids=track_ids,
            script=script,
            intro_script=intro_script,
            outro_script=outro_script,
            tracks=tracks,
        )
        with db() as conn:
            conn.execute(
                """
                UPDATE music_radio_jobs
                SET status = 'completed',
                    mode = ?,
                    episode_id = ?,
                    updated_at = current_timestamp
                WHERE id = ?
                """,
                (episode["generator"], episode["id"], job_id),
            )
        return {
            "id": job_id,
            "status": "completed",
            "episode": episode,
            "weather": weather,
            "message": "每日音乐电台已生成。",
        }
    except Exception as error:
        with db() as conn:
            conn.execute(
                """
                UPDATE music_radio_jobs
                SET status = 'failed', error = ?, updated_at = current_timestamp
                WHERE id = ?
                """,
                (str(error), job_id),
            )
        raise


async def create_daily_radio_mix_episode(payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    now = datetime.now(ZoneInfo(settings.radio_daily_timezone))
    today = now.date()
    requested_count = int(payload.get("trackCount") or 3)
    track_count = max(1, min(requested_count, 6))
    title = str(payload.get("title") or f"西安私人音乐电台 {today.isoformat()}").strip()
    force_regenerate = bool(payload.get("force") or payload.get("regenerate"))
    force_mock_script = bool(payload.get("mockScript"))
    force_mock_tts = bool(payload.get("mockTts") or payload.get("mockAudio"))
    if not force_regenerate:
        existing_episode = latest_daily_radio_mix_episode(today)
        if existing_episode:
            return {
                "status": "cached",
                "episode": existing_episode,
                "message": "今天的音乐电台已经生成过，已直接复用。",
                "date": today.isoformat(),
            }

    weather = await fetch_radio_weather()
    recent_tracks = await fetch_recent_playback_tracks(settings.radio_recent_limit)
    local_pool = fetch_local_recent_playback_tracks(max(settings.radio_recent_limit, 30))
    context_tracks = recent_tracks or local_pool
    if not context_tracks:
        context_tracks = await fetch_radio_seed_tracks([])
    context_tracks = context_tracks[:30]

    script_plan = await generate_daily_radio_script_plan(
        title=title,
        today=today,
        weather=weather,
        recent_tracks=context_tracks,
        track_count=track_count,
        force_mock=force_mock_script,
    )
    recommendations = script_plan.get("tracks") or []
    selected_tracks = await ensure_radio_mix_tracks_available(recommendations, track_count)
    if not selected_tracks:
        selected_tracks = [
            track for track in context_tracks if str(track.get("sourcePath") or "").strip()
        ][:track_count]
    if not selected_tracks:
        return {
            "status": "error",
            "message": "没有可用于合并的本地音乐文件。请先扫描曲库或下载歌曲。",
        }

    intro_script = str(script_plan.get("intro") or "").strip()
    outro_script = str(script_plan.get("outro") or "").strip()
    if not intro_script:
        intro_script = build_radio_intro_script(title, selected_tracks, weather=weather, daily=True)
    if not outro_script:
        outro_script = build_radio_outro_script(title, selected_tracks, weather=weather)
    script = json.dumps(
        {
            "title": title,
            "intro": intro_script,
            "tracks": [
                {
                    "title": first_string_value(track, "title", "name"),
                    "artist": radio_artist_name(track),
                    "album": radio_album_name(track),
                }
                for track in selected_tracks
            ],
            "outro": outro_script,
            "weather": weather,
        },
        ensure_ascii=False,
        indent=2,
    )

    job_id = uuid.uuid4().hex
    selected_track_ids = [str(track.get("id") or "") for track in selected_tracks if track.get("id")]
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_radio_jobs (
                id, title, status, mode, track_ids_json, script
            ) VALUES (?, ?, 'running', 'mix', ?, ?)
            """,
            (job_id, title, json.dumps(selected_track_ids, ensure_ascii=False), script),
        )

    try:
        episode = await generate_radio_mix_episode(
            job_id=job_id,
            title=title,
            track_ids=selected_track_ids,
            script=script,
            intro_script=intro_script,
            outro_script=outro_script,
            tracks=selected_tracks,
            force_mock_tts=force_mock_tts,
        )
        with db() as conn:
            conn.execute(
                """
                UPDATE music_radio_jobs
                SET status = 'completed',
                    mode = ?,
                    episode_id = ?,
                    updated_at = current_timestamp
                WHERE id = ?
                """,
                (episode["generator"], episode["id"], job_id),
            )
        return {
            "id": job_id,
            "status": "completed",
            "episode": episode,
            "weather": weather,
            "scriptPlan": script_plan,
            "message": "每日音乐电台合并音频已生成。",
        }
    except Exception as error:
        with db() as conn:
            conn.execute(
                """
                UPDATE music_radio_jobs
                SET status = 'failed', error = ?, updated_at = current_timestamp
                WHERE id = ?
                """,
                (str(error), job_id),
            )
        raise


async def fetch_radio_weather() -> dict[str, Any]:
    settings = get_settings()
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": settings.radio_weather_lat,
        "longitude": settings.radio_weather_lon,
        "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": settings.radio_daily_timezone,
        "forecast_days": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(url, params=params)
        if response.status_code >= 400:
            raise RuntimeError(f"HTTP {response.status_code}")
        payload = response.json()
    except Exception as error:
        return {
            "status": "error",
            "city": settings.radio_weather_city,
            "message": f"天气读取失败：{error}",
        }

    current = payload.get("current") if isinstance(payload, dict) else {}
    daily = payload.get("daily") if isinstance(payload, dict) else {}
    weather_code = int(current.get("weather_code") or 0) if isinstance(current, dict) else 0
    return {
        "status": "ready",
        "city": settings.radio_weather_city,
        "temperature": current.get("temperature_2m") if isinstance(current, dict) else None,
        "humidity": current.get("relative_humidity_2m") if isinstance(current, dict) else None,
        "windSpeed": current.get("wind_speed_10m") if isinstance(current, dict) else None,
        "weatherCode": weather_code,
        "weatherText": weather_code_to_text(weather_code),
        "temperatureMax": first_daily_value(daily, "temperature_2m_max"),
        "temperatureMin": first_daily_value(daily, "temperature_2m_min"),
        "precipitationProbability": first_daily_value(daily, "precipitation_probability_max"),
    }


async def fetch_recent_playback_tracks(limit: int) -> list[dict[str, Any]]:
    local_tracks = fetch_local_recent_playback_tracks(limit)
    if local_tracks:
        return local_tracks

    token = await get_or_login_daoliyu_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        for base_url in daoliyu_base_urls():
            try:
                response = await client.get(
                    f"{base_url}/api/library/playback-history/recent",
                    params={"limit": limit},
                    headers=headers,
                )
            except httpx.HTTPError:
                continue
            if response.status_code < 400:
                return extract_tracks_from_playback_payload(response.json())[:limit]
    return []


def fetch_local_recent_playback_tracks(limit: int) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT t.*
            FROM music_play_history h
            JOIN music_tracks t ON t.id = h.track_id
            GROUP BY t.id
            ORDER BY max(h.played_at) DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        if not rows:
            rows = conn.execute(
                """
                SELECT *
                FROM music_tracks
                ORDER BY play_count DESC, updated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [local_track_row_to_radio_dict(row) for row in rows]


def local_track_row_to_radio_dict(row: sqlite3.Row) -> dict[str, Any]:
    title = row["title"] or Path(row["source_path"]).stem
    artist = row["artist"] or "未知歌手"
    album = row["album"] or "未知专辑"
    cover_url = f"/v1/music/covers/{row['id']}" if row["cover_path"] else ""
    return {
        "id": row["id"],
        "title": title,
        "name": title,
        "albumArtist": artist,
        "durationSeconds": row["duration_seconds"],
        "sourcePath": row["source_path"],
        "coverArtUrl": cover_url,
        "lyrics": row["lyrics"],
        "album": {
            "id": album,
            "title": album,
            "name": album,
            "coverArtUrl": cover_url,
        },
        "artists": [{"id": artist, "name": artist}],
    }


def extract_tracks_from_playback_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        for key in ("items", "tracks", "history", "data"):
            if isinstance(payload.get(key), list):
                return extract_tracks_from_playback_payload(payload[key])
    if not isinstance(payload, list):
        return []
    tracks: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in payload:
        candidate = item
        if isinstance(item, dict):
            for key in ("track", "song", "media"):
                if isinstance(item.get(key), dict):
                    candidate = item[key]
                    break
        if not isinstance(candidate, dict):
            continue
        track_id = str(candidate.get("id") or "").strip()
        if track_id and track_id not in seen:
            seen.add(track_id)
            tracks.append(candidate)
    return tracks


def first_daily_value(daily: Any, key: str) -> Any:
    if not isinstance(daily, dict) or not isinstance(daily.get(key), list):
        return None
    values = daily[key]
    return values[0] if values else None


def weather_code_to_text(code: int) -> str:
    if code == 0:
        return "晴朗"
    if code in {1, 2, 3}:
        return "多云"
    if code in {45, 48}:
        return "有雾"
    if code in {51, 53, 55, 56, 57}:
        return "毛毛雨"
    if code in {61, 63, 65, 66, 67, 80, 81, 82}:
        return "下雨"
    if code in {71, 73, 75, 77, 85, 86}:
        return "下雪"
    if code in {95, 96, 99}:
        return "雷雨"
    return "天气变化中"


def build_radio_script(
    title: str,
    tracks: list[dict[str, Any]],
    *,
    weather: dict[str, Any] | None = None,
    daily: bool = False,
) -> str:
    weather_text = build_weather_intro(weather) if weather else ""
    if not tracks:
        prefix = f"{weather_text}\n" if weather_text else ""
        return (
            f"{prefix}欢迎来到《{title}》。今天暂时没有读取到曲目，"
            "这期先做一段轻一点的暖场。等 NAS 曲库连接稳定后，我会根据你的音乐列表生成更贴合心情的串词。"
        )

    lines = [
        f"欢迎来到《{title}》。",
        weather_text or "今天从你的 NAS 音乐里挑几首，做一期私人电台。",
        "我会参考你最近听过的歌，整理一段适合今天播放的私人电台。"
        if daily
        else "我会参考你当前的 NAS 音乐列表，整理一段适合今天播放的私人电台。",
    ]
    for index, track in enumerate(tracks[:6], start=1):
        name = first_string_value(track, "title", "name") or "未知歌曲"
        artist = radio_artist_name(track)
        album = ""
        if isinstance(track.get("album"), dict):
            album = str(track["album"].get("title") or track["album"].get("name") or "")
        if album:
            lines.append(f"第 {index} 首，{artist} 的《{name}》，来自《{album}》。")
        else:
            lines.append(f"第 {index} 首，{artist} 的《{name}》。")
        lines.append(radio_track_comment(index, name, artist))
    lines.append("这就是本期 NAS 音乐电台。愿这些歌把今天过得更有节奏，也更像你自己。")
    return "\n".join(lines)


def build_radio_intro_script(
    title: str,
    tracks: list[dict[str, Any]],
    *,
    weather: dict[str, Any] | None = None,
    daily: bool = False,
) -> str:
    weather_text = build_weather_intro(weather) if weather else ""
    selected_tracks = tracks[:6]
    if not selected_tracks:
        prefix = f"{weather_text}\n" if weather_text else ""
        return (
            f"{prefix}这里是今天的《{title}》。我暂时还没读到足够的最近播放记录，"
            "所以先把这期当成一段暖场。等你的曲库和听歌记录稳定下来，我会更像一个懂你口味的私人电台。"
        )

    lines = [
        f"这里是《{title}》。",
        weather_text or "今天我从你的 NAS 音乐里挑了几首歌，做一期私人电台。",
        "这期不做很硬的榜单介绍，就像一段边走边聊的歌单。先说说为什么选它们，然后我们直接进入播放。",
    ]
    for index, track in enumerate(selected_tracks, start=1):
        name = first_string_value(track, "title", "name") or "未知歌曲"
        artist = radio_artist_name(track)
        album = radio_album_name(track)
        reason = radio_recommend_reason(index, name, artist, weather)
        if album:
            lines.append(f"{index}. {artist} 的《{name}》，来自《{album}》。{reason}")
        else:
            lines.append(f"{index}. {artist} 的《{name}》。{reason}")
    lines.append("好了，先把话放轻一点，音乐自己会把剩下的情绪接住。")
    return "\n".join(lines)


def build_radio_outro_script(
    title: str,
    tracks: list[dict[str, Any]],
    *,
    weather: dict[str, Any] | None = None,
) -> str:
    weather_text = ""
    if weather and weather.get("status") == "ready":
        weather_text = f"西安今天{weather.get('weatherText', '天气变化中')}，"
    if tracks:
        names = "、".join(
            f"《{first_string_value(track, 'title', 'name') or '未知歌曲'}》"
            for track in tracks[:3]
        )
        return (
            f"今天的《{title}》就到这里。{weather_text}"
            f"刚才这几首歌里，{names}把今天的情绪串了起来。"
            "如果其中有一首刚好贴住了你现在的状态，就让它多留一会儿。我们下一期再见。"
        )
    return (
        f"今天的《{title}》就到这里。"
        "等最近播放记录稳定后，我会把天气、心情和你的歌单结合得更准。我们下一期再见。"
    )


def build_weather_intro(weather: dict[str, Any] | None) -> str:
    if not weather:
        return ""
    city = weather.get("city") or "所在城市"
    if weather.get("status") != "ready":
        return f"今天{city}的天气暂时读取失败，不过音乐照常开始。"
    temperature = weather.get("temperature")
    weather_text = weather.get("weatherText") or "天气变化中"
    humidity = weather.get("humidity")
    wind_speed = weather.get("windSpeed")
    temp_part = f"{temperature} 度" if temperature is not None else "温度未知"
    humidity_part = f"，湿度 {humidity}%" if humidity is not None else ""
    wind_part = f"，风速 {wind_speed} 公里每小时" if wind_speed is not None else ""
    return f"今天{city}{weather_text}，当前大约 {temp_part}{humidity_part}{wind_part}。"


def radio_album_name(track: dict[str, Any]) -> str:
    album = track.get("album")
    if isinstance(album, dict):
        return str(album.get("title") or album.get("name") or "")
    return str(track.get("albumTitle") or "")


def radio_recommend_reason(
    index: int,
    name: str,
    artist: str,
    weather: dict[str, Any] | None,
) -> str:
    weather_text = ""
    if weather and weather.get("status") == "ready":
        weather_text = str(weather.get("weatherText") or "")
    if weather_text in {"晴朗", "多云"}:
        reasons = [
            "天气比较明亮，适合用这首歌把今天的状态打开。",
            "这首歌的旋律更容易让人进入稳定节奏，适合工作或整理东西时听。",
            "它的情绪不急不躁，可以放在中段做一个舒服的转场。",
            "这首歌能把注意力往外拉一点，让今天不只是闷头做事。",
            "它适合在稍微放松的时候听，让情绪慢慢落下来。",
            "放在最后比较合适，能给这一轮推荐一个干净的收束。",
        ]
    elif weather_text in {"下雨", "毛毛雨", "有雾"}:
        reasons = [
            "今天的天气偏安静，这首歌适合做开场，让情绪慢慢进入。",
            "它有一点柔和的质感，适合雨天或低速工作的时候听。",
            "这首歌能把空间感铺开，让人不那么被天气压住。",
            "它的声音辨识度比较高，适合在中段提一下精神。",
            "这首歌适合放慢一点听，给今天留一点缓冲。",
            "放在最后能把情绪收回来，不会太突然。",
        ]
    else:
        reasons = [
            f"最近听歌记录里出现了 {artist}，所以把这首放进今天推荐。",
            "这首歌旋律比较稳，适合做今天的陪伴音乐。",
            "它和前后几首歌的情绪能接上，适合串成一组听。",
            "这首歌可以稍微提起精神，让歌单不只停在背景音。",
            "它适合在中后段出现，让节奏更松弛。",
            "它能给这期推荐留一个比较舒服的结尾。",
        ]
    return reasons[(index - 1) % len(reasons)]


def radio_artist_name(track: dict[str, Any]) -> str:
    artists = track.get("artists")
    if isinstance(artists, list) and artists:
        first = artists[0]
        if isinstance(first, dict) and isinstance(first.get("artist"), dict):
            return str(first["artist"].get("name") or "未知歌手")
        if isinstance(first, dict):
            return str(first.get("name") or "未知歌手")
    return str(track.get("albumArtist") or "未知歌手")


def radio_track_comment(index: int, name: str, artist: str) -> str:
    comments = [
        f"这首歌适合放在开头，像是给耳朵留出一小段醒来的时间。",
        f"接下来这一首的情绪会更靠近内心一点，适合边工作边慢慢听。",
        f"这首《{name}》可以作为中段的转场，让节奏稳住，不急着往前赶。",
        f"{artist} 的声音会把氛围往外推一点，适合让注意力重新聚焦。",
        f"现在进入更松弛的一段，适合把手头的事继续做下去。",
        f"最后这首留作收束，让这一期电台有一个干净的落点。",
    ]
    return comments[(index - 1) % len(comments)]


async def generate_daily_radio_script_plan(
    *,
    title: str,
    today: date,
    weather: dict[str, Any],
    recent_tracks: list[dict[str, Any]],
    track_count: int,
    force_mock: bool = False,
) -> dict[str, Any]:
    fallback = build_fallback_radio_script_plan(title, today, weather, recent_tracks, track_count)
    if force_mock or not resolved_minimax_key() or not get_settings().minimax_group_id:
        return fallback
    prompt = build_minimax_radio_prompt(title, today, weather, recent_tracks, track_count)
    try:
        result = await generate_minimax_chat_json(prompt)
    except Exception:
        return fallback
    title_value = str(result.get("title") or title).strip()
    intro = str(result.get("intro") or "").strip()
    outro = str(result.get("outro") or "").strip()
    tracks = result.get("tracks") if isinstance(result.get("tracks"), list) else []
    clean_tracks: list[dict[str, str]] = []
    for item in tracks[:track_count]:
        if not isinstance(item, dict):
            continue
        track_title = str(item.get("title") or "").strip()
        artist = str(item.get("artist") or "").strip()
        if not track_title:
            continue
        clean_tracks.append(
            {
                "title": track_title,
                "artist": artist,
                "album": str(item.get("album") or "").strip(),
                "reason": str(item.get("reason") or "").strip(),
            }
        )
    if len(clean_tracks) < track_count:
        fallback_tracks = fallback.get("tracks") if isinstance(fallback.get("tracks"), list) else []
        for item in fallback_tracks:
            if len(clean_tracks) >= track_count:
                break
            if not isinstance(item, dict):
                continue
            clean_tracks.append(item)
    return {
        "title": title_value or title,
        "intro": intro or fallback["intro"],
        "tracks": clean_tracks[:track_count],
        "outro": outro or fallback["outro"],
        "generator": "minimax-chat",
    }


def build_minimax_radio_prompt(
    title: str,
    today: date,
    weather: dict[str, Any],
    recent_tracks: list[dict[str, Any]],
    track_count: int,
) -> str:
    track_lines = []
    for index, track in enumerate(recent_tracks[:20], start=1):
        track_lines.append(
            f"{index}. {first_string_value(track, 'title', 'name') or '未知歌曲'} - "
            f"{radio_artist_name(track)} - {radio_album_name(track) or '未知专辑'}"
        )
    weather_line = build_weather_intro(weather) or "天气暂时未知。"
    return (
        "你是一个私人音乐电台主持人，风格像朋友在旁边轻声介绍音乐，不像新闻播报，也不像产品测试文案。\n"
        "请根据日期、天气和我的最近听歌记录，生成一期自然的中文电台脚本。\n"
        "关键要求：\n"
        f"- 日期：{today.isoformat()}\n"
        f"- 标题：{title}\n"
        f"- 天气：{weather_line}\n"
        f"- 选择 {track_count} 首歌，优先从最近听歌记录里选；如果推荐新歌，必须给出歌名和歌手。\n"
        "- intro 是开场口播，会在所有歌曲播放前一次性播完；不要写“接下来第一首/第二首马上播放”这种机械串词。\n"
        "- intro 要包含：今天的天气、这期歌单的整体情绪、每首歌 1 句具体推荐理由，最后自然进入播放。\n"
        "- outro 是所有歌曲播完后的收尾，像晚一点回头总结，不要像广告语。\n"
        "- 口吻要口语化、温和、私人化，可以有一点停顿感，但不要油腻，不要喊口号。\n"
        "- 禁止出现：测试音频、生成中、推荐理由：、第 1 首、今天的节目到这里、感谢收听。\n"
        "- intro 控制在 260 到 420 个中文字符；outro 控制在 80 到 160 个中文字符。\n"
        "- 只输出 JSON，不要 markdown，不要额外解释。\n"
        "JSON 格式："
        '{"title":"...","intro":"...","tracks":[{"title":"...","artist":"...","album":"可空","reason":"..."}],"outro":"..."}\n'
        "最近听歌记录：\n"
        + "\n".join(track_lines)
    )


async def generate_minimax_chat_json(prompt: str) -> dict[str, Any]:
    settings = get_settings()
    minimax_key = resolved_minimax_key()
    url = f"https://api.minimax.chat/v1/text/chatcompletion_v2?GroupId={settings.minimax_group_id}"
    payload = {
        "model": settings.minimax_chat_model,
        "messages": [
            {
                "role": "system",
                "content": "你是一个会输出严格 JSON 的中文私人音乐电台文案助手。",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 1200,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {minimax_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if response.status_code >= 400:
        raise RuntimeError(f"MiniMax Chat HTTP {response.status_code}: {response.text[:300]}")
    data = response.json()
    content = extract_minimax_chat_content(data)
    return parse_json_from_text(content)


def extract_minimax_chat_content(data: dict[str, Any]) -> str:
    if isinstance(data.get("choices"), list) and data["choices"]:
        choice = data["choices"][0]
        if isinstance(choice, dict):
            message = choice.get("message")
            if isinstance(message, dict):
                return str(message.get("content") or "")
            return str(choice.get("text") or "")
    if isinstance(data.get("reply"), str):
        return data["reply"]
    if isinstance(data.get("data"), dict):
        for key in ("reply", "content", "text"):
            if isinstance(data["data"].get(key), str):
                return data["data"][key]
    return json.dumps(data, ensure_ascii=False)


def parse_json_from_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re_sub_code_fence(cleaned)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end <= start:
            raise
        parsed = json.loads(cleaned[start : end + 1])
    return parsed if isinstance(parsed, dict) else {}


def re_sub_code_fence(value: str) -> str:
    lines = value.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def build_fallback_radio_script_plan(
    title: str,
    today: date,
    weather: dict[str, Any],
    recent_tracks: list[dict[str, Any]],
    track_count: int,
) -> dict[str, Any]:
    tracks = recent_tracks[:track_count]
    intro = build_radio_intro_script(title, tracks, weather=weather, daily=True)
    outro = build_radio_outro_script(title, tracks, weather=weather)
    return {
        "title": title,
        "intro": intro,
        "tracks": [
            {
                "title": first_string_value(track, "title", "name") or "未知歌曲",
                "artist": radio_artist_name(track),
                "album": radio_album_name(track),
                "reason": radio_recommend_reason(index, first_string_value(track, "title", "name") or "未知歌曲", radio_artist_name(track), weather),
            }
            for index, track in enumerate(tracks, start=1)
        ],
        "outro": outro,
        "generator": "fallback",
        "date": today.isoformat(),
    }


async def ensure_radio_mix_tracks_available(
    recommendations: list[Any],
    track_count: int,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    missing: list[dict[str, str]] = []
    for item in recommendations[:track_count]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        artist = str(item.get("artist") or "").strip()
        if not title:
            continue
        local = find_local_track_for_radio(title, artist)
        if local:
            selected.append(local)
        else:
            missing.append({"title": title, "artist": artist})

    if missing:
        for item in missing:
            download_recommended_track(item["title"], item["artist"])
        from .local_music import scan_local_music_library
        from .metadata_scrape import ScrapeJobCreateRequest, create_scrape_job

        scan_local_music_library(incremental=True)
        create_scrape_job(
            ScrapeJobCreateRequest(
                providers=["qqmusic"],
                missing=["lyrics", "cover"],
                limit=50,
                candidateLimit=3,
                autoApply=True,
                minConfidence=0.92,
            )
        )
        for item in missing:
            local = find_local_track_for_radio(item["title"], item["artist"])
            if local:
                selected.append(local)
    return dedupe_radio_tracks(selected)[:track_count]


def find_local_track_for_radio(title: str, artist: str) -> dict[str, Any] | None:
    normalized_title = normalize_radio_text(title)
    normalized_artist = normalize_radio_text(artist)
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM music_tracks
            WHERE title != '' OR file_name != ''
            ORDER BY play_count DESC, updated_at DESC
            LIMIT 500
            """
        ).fetchall()
    best_row = None
    best_score = 0.0
    for row in rows:
        row_title = normalize_radio_text(row["title"] or Path(row["source_path"]).stem)
        row_artist = normalize_radio_text(row["artist"])
        score = 0.0
        if normalized_title and normalized_title == row_title:
            score += 0.75
        elif normalized_title and (normalized_title in row_title or row_title in normalized_title):
            score += 0.45
        if normalized_artist and row_artist and normalized_artist in row_artist:
            score += 0.25
        if score > best_score:
            best_score = score
            best_row = row
    if best_row is not None and best_score >= 0.7:
        return local_track_row_to_radio_dict(best_row)
    return None


def download_recommended_track(title: str, artist: str) -> dict[str, Any]:
    from .sqmusic_download import choose_br_type, normalize_track_record, sqmusic_request

    keyword = f"{title} {artist}".strip()
    settings = get_settings()
    for plug_name in [item.strip() for item in settings.sqmusic_plug_names.split(",") if item.strip()]:
        try:
            payload = sqmusic_request(
                "GET",
                "/api/music/searchSong",
                params={
                    "plugName": plug_name,
                    "keyword": keyword,
                    "pageSize": "5",
                    "pageIndex": "1",
                },
            )
        except Exception:
            continue
        if payload.get("code") != 200:
            continue
        records = ((payload.get("data") or {}).get("records") or [])
        candidates = [normalize_track_record(record) for record in records if isinstance(record, dict)]
        candidates = sorted(
            candidates,
            key=lambda item: score_download_candidate(title, artist, item),
            reverse=True,
        )
        if not candidates:
            continue
        candidate = candidates[0]
        if score_download_candidate(title, artist, candidate) < 0.65:
            continue
        br_type = choose_br_type(candidate.get("brTypes") or [])
        if not br_type:
            continue
        body = {
            "id": candidate["id"],
            "plugName": candidate["plugName"],
            "name": candidate["name"],
            "artistName": candidate.get("artistNames") or [candidate.get("artistName", "")],
            "artistids": candidate.get("artistids") or [],
            "albumName": candidate.get("albumName") or "",
            "albumid": candidate.get("albumid") or "",
            "duration": candidate.get("duration") or "",
            "pic": candidate.get("pic") or "",
            "lyric": candidate.get("lyric"),
            "lyricId": candidate.get("lyricId"),
            "brTypes": candidate.get("brTypes") or [],
            "dataInfo": candidate.get("dataInfo") or {},
            "brType": br_type,
        }
        response = sqmusic_request("POST", "/api/download/downloadSong", body=body)
        return {
            "status": "queued" if response.get("code") == 200 else "error",
            "track": candidate,
            "brType": br_type,
            "sqmusic": response,
        }
    return {"status": "not_found", "title": title, "artist": artist}


def score_download_candidate(title: str, artist: str, item: dict[str, Any]) -> float:
    query_title = normalize_radio_text(title)
    query_artist = normalize_radio_text(artist)
    item_title = normalize_radio_text(item.get("name"))
    item_artist = normalize_radio_text(item.get("artistName"))
    score = 0.0
    if query_title and query_title == item_title:
        score += 0.75
    elif query_title and (query_title in item_title or item_title in query_title):
        score += 0.45
    if query_artist and query_artist in item_artist:
        score += 0.25
    if any(word in item_title for word in ("live", "演唱会", "dj", "remix", "伴奏", "cover")):
        score -= 0.1
    return score


def dedupe_radio_tracks(tracks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for track in tracks:
        key = str(track.get("id") or "") or normalize_radio_text(
            f"{first_string_value(track, 'title', 'name')} {radio_artist_name(track)}"
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(track)
    return result


def normalize_radio_text(value: Any) -> str:
    text = str(value or "").lower().strip()
    for item in (" ", "\t", "\n", "-", "_", "《", "》", "(", ")", "（", "）", "[", "]", "【", "】", "'", '"'):
        text = text.replace(item, "")
    return text


async def generate_radio_episode(
    *,
    job_id: str,
    title: str,
    track_ids: list[str],
    script: str,
    intro_script: str | None = None,
    outro_script: str | None = None,
    tracks: list[dict[str, Any]],
) -> dict[str, Any]:
    settings = get_settings()
    output_dir = Path(settings.radio_output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    episode_id = uuid.uuid4().hex

    audio_format = "wav"
    generator = "mock"
    audio_path = output_dir / f"{episode_id}.wav"
    outro_audio_path = output_dir / f"{episode_id}-outro.wav"
    intro_text = intro_script or script
    outro_text = outro_script or ""
    if resolved_minimax_key() and settings.minimax_group_id:
        audio_format = "mp3"
        generator = "minimax"
        audio_path = output_dir / f"{episode_id}.mp3"
        outro_audio_path = output_dir / f"{episode_id}-outro.mp3"
        audio_bytes = await generate_minimax_tts(intro_text)
        audio_path.write_bytes(audio_bytes)
        if outro_text:
            outro_audio_path.write_bytes(await generate_minimax_tts(outro_text))
    else:
        write_mock_radio_wav(audio_path, intro_text)
        if outro_text:
            write_mock_radio_wav(outro_audio_path, outro_text)

    summary = build_radio_summary(tracks)
    duration_seconds = estimate_audio_duration_seconds(audio_path, audio_format, intro_text)
    outro_duration_seconds = (
        estimate_audio_duration_seconds(outro_audio_path, audio_format, outro_text)
        if outro_text and outro_audio_path.exists()
        else 0
    )
    segments = build_radio_segments(
        episode_id=episode_id,
        tracks=tracks,
        intro_duration_seconds=duration_seconds,
        outro_duration_seconds=outro_duration_seconds,
        audio_format=audio_format,
        has_outro=bool(outro_text and outro_audio_path.exists()),
    )
    episode = {
        "id": episode_id,
        "title": title,
        "summary": summary,
        "script": script,
        "audioPath": str(audio_path),
        "outroAudioPath": str(outro_audio_path) if outro_text else "",
        "audioFormat": audio_format,
        "durationSeconds": duration_seconds,
        "outroDurationSeconds": outro_duration_seconds,
        "sourceTrackIds": track_ids,
        "segments": segments,
        "generator": generator,
        "streamUrl": f"/v1/music/radio/episodes/{episode_id}/stream",
        "outroStreamUrl": f"/v1/music/radio/episodes/{episode_id}/outro/stream"
        if outro_text
        else "",
    }
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_radio_episodes (
                id, title, summary, script, audio_path, outro_audio_path,
                audio_format, duration_seconds, outro_duration_seconds,
                source_track_ids_json, segments_json, generator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                episode_id,
                title,
                summary,
                script,
                str(audio_path),
                str(outro_audio_path) if outro_text else "",
                audio_format,
                duration_seconds,
                outro_duration_seconds,
                json.dumps(track_ids, ensure_ascii=False),
                json.dumps(segments, ensure_ascii=False),
                generator,
            ),
        )
    return episode


async def generate_radio_mix_episode(
    *,
    job_id: str,
    title: str,
    track_ids: list[str],
    script: str,
    intro_script: str,
    outro_script: str,
    tracks: list[dict[str, Any]],
    force_mock_tts: bool = False,
) -> dict[str, Any]:
    settings = get_settings()
    output_dir = Path(settings.radio_output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    episode_id = uuid.uuid4().hex
    intro_path = output_dir / f"{episode_id}-intro.mp3"
    outro_path = output_dir / f"{episode_id}-outro.mp3"
    final_path = output_dir / f"{episode_id}-mix.mp3"

    generator = "minimax-chat+minimax-tts+ffmpeg"
    if not force_mock_tts and resolved_minimax_key() and settings.minimax_group_id:
        intro_path.write_bytes(await generate_minimax_tts(intro_script))
        outro_path.write_bytes(await generate_minimax_tts(outro_script))
    else:
        generator = "fallback-script+mock-tts+ffmpeg"
        intro_path = output_dir / f"{episode_id}-intro.wav"
        outro_path = output_dir / f"{episode_id}-outro.wav"
        write_mock_radio_wav(intro_path, intro_script)
        write_mock_radio_wav(outro_path, outro_script)

    music_paths = []
    for track in tracks:
        source_path = Path(str(track.get("sourcePath") or ""))
        if source_path.exists() and source_path.is_file():
            music_paths.append(source_path)
    if not music_paths:
        raise RuntimeError("没有找到可合并的本地音乐文件。")

    concat_audio_files([intro_path, *music_paths, outro_path], final_path)
    summary = build_radio_summary(tracks)
    duration_seconds = probe_audio_duration_seconds(final_path)
    segments = build_radio_mix_segments(
        episode_id=episode_id,
        tracks=tracks,
        intro_path=intro_path,
        outro_path=outro_path,
        final_path=final_path,
        final_duration_seconds=duration_seconds,
    )
    episode = {
        "id": episode_id,
        "title": title,
        "summary": summary,
        "script": script,
        "audioPath": str(final_path),
        "outroAudioPath": str(outro_path),
        "audioFormat": "mp3",
        "durationSeconds": duration_seconds,
        "outroDurationSeconds": probe_audio_duration_seconds(outro_path),
        "sourceTrackIds": track_ids,
        "segments": segments,
        "generator": generator,
        "streamUrl": f"/v1/music/radio/episodes/{episode_id}/stream",
        "outroStreamUrl": f"/v1/music/radio/episodes/{episode_id}/outro/stream",
    }
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_radio_episodes (
                id, title, summary, script, audio_path, outro_audio_path,
                audio_format, duration_seconds, outro_duration_seconds,
                source_track_ids_json, segments_json, generator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                episode_id,
                title,
                summary,
                script,
                str(final_path),
                str(outro_path),
                "mp3",
                duration_seconds,
                episode["outroDurationSeconds"],
                json.dumps(track_ids, ensure_ascii=False),
                json.dumps(segments, ensure_ascii=False),
                generator,
            ),
        )
    return episode


def concat_audio_files(input_paths: list[Path], output_path: Path) -> None:
    if len(input_paths) < 2:
        raise RuntimeError("合并音频至少需要两段输入。")
    filter_inputs = "".join(f"[{index}:a]" for index in range(len(input_paths)))
    filter_complex = f"{filter_inputs}concat=n={len(input_paths)}:v=0:a=1[a]"
    command = ["ffmpeg", "-y"]
    for path in input_paths:
        command.extend(["-i", str(path)])
    command.extend(
        [
            "-filter_complex",
            filter_complex,
            "-map",
            "[a]",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-b:a",
            "192k",
            str(output_path),
        ]
    )
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=600)
    except FileNotFoundError as error:
        raise RuntimeError("未找到 ffmpeg，请在 NAS 镜像或系统中安装 ffmpeg。") from error
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 合并失败：{result.stderr[-1000:]}")


def probe_audio_duration_seconds(path: Path) -> int:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        return 0
    if result.returncode != 0:
        return 0
    try:
        return int(float(result.stdout.strip()))
    except ValueError:
        return 0


def build_radio_mix_segments(
    *,
    episode_id: str,
    tracks: list[dict[str, Any]],
    intro_path: Path,
    outro_path: Path,
    final_path: Path,
    final_duration_seconds: int,
) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = [
        {
            "type": "intro",
            "id": f"radio_{episode_id}_intro",
            "title": "开场口播",
            "artist": "MiniMax 电台主持",
            "audioPath": str(intro_path),
            "durationSeconds": probe_audio_duration_seconds(intro_path),
        }
    ]
    for track in tracks:
        segments.append(
            {
                "type": "track",
                "id": str(track.get("id") or ""),
                "title": first_string_value(track, "title", "name") or "未知歌曲",
                "artist": radio_artist_name(track),
                "album": radio_album_name(track),
                "sourcePath": str(track.get("sourcePath") or ""),
                "durationSeconds": int(track.get("durationSeconds") or 0),
            }
        )
    segments.append(
        {
            "type": "outro",
            "id": f"radio_{episode_id}_outro",
            "title": "结束口播",
            "artist": "MiniMax 电台主持",
            "audioPath": str(outro_path),
            "durationSeconds": probe_audio_duration_seconds(outro_path),
        }
    )
    segments.append(
        {
            "type": "full_mix",
            "id": f"radio_{episode_id}_mix",
            "title": "完整电台合并音频",
            "artist": "Personal OS Agent",
            "audioPath": str(final_path),
            "streamUrl": f"/v1/music/radio/episodes/{episode_id}/stream",
            "durationSeconds": final_duration_seconds,
        }
    )
    return segments


async def generate_minimax_tts(text: str) -> bytes:
    settings = get_settings()
    minimax_key = resolved_minimax_key()
    if not minimax_key:
        raise RuntimeError("MiniMax TTS 未配置订阅 Key 或 API Key。")
    url = f"https://api.minimax.chat/v1/t2a_v2?GroupId={settings.minimax_group_id}"
    payload = {
        "model": settings.minimax_tts_model,
        "text": text,
        "stream": False,
        "voice_setting": {
            "voice_id": settings.minimax_tts_voice_id,
            "speed": 1,
            "vol": 1,
            "pitch": 0,
        },
        "audio_setting": {
            "sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
            "channel": 1,
        },
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {minimax_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if response.status_code >= 400:
        raise RuntimeError(f"MiniMax TTS HTTP {response.status_code}: {response.text[:300]}")
    data = response.json()
    audio_value = ""
    if isinstance(data.get("data"), dict):
        audio_value = str(data["data"].get("audio") or "")
    audio_value = audio_value or str(data.get("audio") or "")
    if not audio_value:
        raise RuntimeError("MiniMax TTS 响应没有 audio 字段。")
    try:
        return bytes.fromhex(audio_value)
    except ValueError:
        return base64.b64decode(audio_value)


def resolved_minimax_key() -> str:
    settings = get_settings()
    return settings.minimax_subscription_key or settings.minimax_api_key


def write_mock_radio_wav(path: Path, script: str) -> None:
    sample_rate = 16000
    duration_seconds = min(18, max(6, len(script) // 45))
    total_samples = sample_rate * duration_seconds
    amplitude = 9000
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(sample_rate)
        frames = bytearray()
        for index in range(total_samples):
            tone = math.sin(2 * math.pi * 440 * index / sample_rate)
            envelope = 0.35 + 0.2 * math.sin(2 * math.pi * index / sample_rate)
            value = int(amplitude * tone * envelope)
            frames.extend(value.to_bytes(2, byteorder="little", signed=True))
        file.writeframes(bytes(frames))


def build_radio_summary(tracks: list[dict[str, Any]]) -> str:
    if not tracks:
        return "测试电台节目，等待 NAS 曲库连接后生成真实推荐。"
    names = [
        first_string_value(track, "title", "name") or "未知歌曲"
        for track in tracks[:4]
    ]
    return f"参考 {len(tracks)} 首 NAS 曲目生成，包含《{'》《'.join(names)}》等歌曲。"


def build_radio_segments(
    *,
    episode_id: str,
    tracks: list[dict[str, Any]],
    intro_duration_seconds: int,
    outro_duration_seconds: int,
    audio_format: str,
    has_outro: bool,
) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = [
        {
            "type": "intro",
            "id": f"radio_{episode_id}_intro",
            "title": "今日电台开场",
            "artist": "NAS 音乐电台",
            "durationSeconds": intro_duration_seconds,
            "audioFormat": audio_format,
            "streamUrl": f"/v1/music/radio/episodes/{episode_id}/stream",
        }
    ]
    for track in tracks[:6]:
        track_id = str(track.get("id") or "").strip()
        if not track_id:
            continue
        segments.append(
            {
                "type": "track",
                "id": track_id,
                "title": first_string_value(track, "title", "name") or "未知歌曲",
                "artist": radio_artist_name(track),
                "album": radio_album_name(track),
                "durationSeconds": int(track.get("durationSeconds") or 0),
            }
        )
    if has_outro:
        segments.append(
            {
                "type": "outro",
                "id": f"radio_{episode_id}_outro",
                "title": "今日电台收尾",
                "artist": "NAS 音乐电台",
                "durationSeconds": outro_duration_seconds,
                "audioFormat": audio_format,
                "streamUrl": f"/v1/music/radio/episodes/{episode_id}/outro/stream",
            }
        )
    return segments


def estimate_audio_duration_seconds(path: Path, audio_format: str, script: str) -> int:
    if audio_format == "wav":
        with wave.open(str(path), "rb") as file:
            frames = file.getnframes()
            rate = file.getframerate()
            return int(frames / rate) if rate else 0
    return max(1, len(script) // 4)


def radio_episode_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    episode_id = row["id"]
    return {
        "id": episode_id,
        "title": row["title"],
        "summary": row["summary"],
        "script": row["script"],
        "audioPath": row["audio_path"],
        "outroAudioPath": row["outro_audio_path"],
        "audioFormat": row["audio_format"],
        "durationSeconds": row["duration_seconds"],
        "outroDurationSeconds": row["outro_duration_seconds"],
        "sourceTrackIds": json.loads(row["source_track_ids_json"] or "[]"),
        "segments": json.loads(row["segments_json"] or "[]"),
        "generator": row["generator"],
        "streamUrl": f"/v1/music/radio/episodes/{episode_id}/stream",
        "outroStreamUrl": f"/v1/music/radio/episodes/{episode_id}/outro/stream"
        if row["outro_audio_path"]
        else "",
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def radio_job_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "mode": row["mode"],
        "trackIds": json.loads(row["track_ids_json"] or "[]"),
        "script": row["script"],
        "episodeId": row["episode_id"],
        "error": row["error"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


async def build_daoliyu_track_stream_url(track_id: str) -> str:
    token = await get_or_login_daoliyu_token()
    if not token:
        return ""
    base_url = str(DAOLIYU_TOKEN_CACHE.get("baseUrl") or daoliyu_base_urls()[0])
    return f"{base_url}/api/tracks/{track_id}/stream?token={token}"


async def proxy_audio_url(url: str, request: Request) -> Response:
    headers = {}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header
    async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
        upstream = await client.get(url, headers=headers)
    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() in {"content-length", "content-range", "accept-ranges", "content-type"}
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type", "audio/mpeg"),
    )


def resolve_track_file_path(track: dict[str, Any]) -> Path | None:
    raw_file_path = first_string_value(track, "filePath", "path")
    if not raw_file_path:
        return None
    candidate = Path(raw_file_path)
    media_root = Path(get_settings().daoliyu_media_root).resolve()
    if candidate.is_absolute():
        resolved = candidate.resolve()
    else:
        resolved = (media_root / candidate).resolve()
    try:
        resolved.relative_to(media_root)
    except ValueError:
        return None
    if not resolved.exists() or not resolved.is_file():
        return None
    return resolved


def ranged_file_response(path: Path, request: Request) -> Response:
    range_header = request.headers.get("range")
    media_type = guess_audio_media_type(path)
    if not range_header:
        return FileResponse(path, media_type=media_type)

    file_size = path.stat().st_size
    byte_range = parse_range_header(range_header, file_size)
    if byte_range is None:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

    start, end = byte_range
    length = end - start + 1

    def iter_file():
        with path.open("rb") as file:
            file.seek(start)
            remaining = length
            while remaining > 0:
                chunk = file.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(
        iter_file(),
        status_code=206,
        media_type=media_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Range": f"bytes {start}-{end}/{file_size}",
        },
    )


def parse_range_header(value: str, file_size: int) -> tuple[int, int] | None:
    if not value.startswith("bytes="):
        return None
    start_text, _, end_text = value.removeprefix("bytes=").partition("-")
    try:
        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else file_size - 1
        else:
            suffix = int(end_text)
            start = max(0, file_size - suffix)
            end = file_size - 1
    except ValueError:
        return None
    if start < 0 or end < start or start >= file_size:
        return None
    return start, min(end, file_size - 1)


def first_string_value(source: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = source.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def guess_audio_media_type(path: Path) -> str:
    suffix = path.suffix.lower()
    return {
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
    }.get(suffix, "application/octet-stream")


def daoliyu_base_urls() -> list[str]:
    urls = [
        value.strip().rstrip("/")
        for value in get_settings().daoliyu_base_urls.split(",")
        if value.strip()
    ]
    return urls or ["http://127.0.0.1:5173", "https://daoliyu.xuguopeng.com"]


async def get_or_login_daoliyu_token() -> str:
    token = str(DAOLIYU_TOKEN_CACHE.get("token") or "")
    if token:
        return token
    result = await login_daoliyu()
    if result["status"] != "authenticated":
        return ""
    return str(DAOLIYU_TOKEN_CACHE.get("token") or "")


async def login_daoliyu() -> dict[str, Any]:
    settings = get_settings()
    errors: list[dict[str, str]] = []
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        for base_url in daoliyu_base_urls():
            login_url = f"{base_url}/api/auth/login"
            try:
                response = await client.post(
                    login_url,
                    json={
                        "email": settings.daoliyu_username,
                        "username": settings.daoliyu_username,
                        "password": settings.daoliyu_password,
                    },
                )
            except httpx.HTTPError as error:
                errors.append({"target": login_url, "message": str(error)})
                continue
            if response.status_code >= 500:
                errors.append({"target": login_url, "message": f"HTTP {response.status_code}"})
                continue
            if response.status_code >= 400:
                return {
                    "status": "error",
                    "baseUrl": base_url,
                    "message": f"倒流登录失败：HTTP {response.status_code}",
                }
            payload = response.json()
            token = payload.get("access_token") or payload.get("token") or ""
            if not token:
                return {
                    "status": "error",
                    "baseUrl": base_url,
                    "message": "倒流登录响应没有 token。",
                }
            DAOLIYU_TOKEN_CACHE.update(
                {
                    "token": token,
                    "baseUrl": base_url,
                    "user": payload.get("user"),
                }
            )
            return {
                "status": "authenticated",
                "baseUrl": base_url,
                "user": payload.get("user"),
                "message": "倒流音乐服务已登录。",
            }
    return {
        "status": "error",
        "baseUrl": "",
        "errors": errors,
        "message": "倒流登录失败：所有上游都不可达。",
    }


async def fetch_daoliyu_profile() -> dict[str, Any]:
    token = str(DAOLIYU_TOKEN_CACHE.get("token") or "")
    base_url = str(DAOLIYU_TOKEN_CACHE.get("baseUrl") or daoliyu_base_urls()[0])
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
            response = await client.get(
                f"{base_url}/api/auth/profile",
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as error:
        return {
            "status": "error",
            "baseUrl": base_url,
            "message": f"倒流 profile 检测失败：{error}",
        }
    if response.status_code == 401:
        return {
            "status": "not_authenticated",
            "baseUrl": base_url,
            "message": "倒流 token 已失效。",
        }
    if response.status_code >= 400:
        return {
            "status": "error",
            "baseUrl": base_url,
            "message": f"倒流 profile 返回 HTTP {response.status_code}",
        }
    user = response.json()
    DAOLIYU_TOKEN_CACHE["user"] = user
    return {
        "status": "authenticated",
        "baseUrl": base_url,
        "user": user,
        "message": "倒流音乐服务已登录。",
    }


def safe_auth_status(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": result.get("status", "unknown"),
        "configured": bool(get_settings().daoliyu_username and get_settings().daoliyu_password),
        "secretFilesLoaded": len(get_settings().loaded_secret_files),
        "baseUrl": result.get("baseUrl") or DAOLIYU_TOKEN_CACHE.get("baseUrl") or "",
        "user": result.get("user") or DAOLIYU_TOKEN_CACHE.get("user"),
        "message": result.get("message", ""),
    }


def should_auto_attach_token(target_path: str, headers: dict[str, str]) -> bool:
    if any(key.lower() == "authorization" for key in headers):
        return False
    return target_path not in {
        "/api/auth/bootstrap",
        "/api/auth/bootstrap-admin",
        "/api/auth/login",
    }


def normalize_proxy_path(full_path: str) -> str:
    stripped = full_path.strip("/")
    if not stripped:
        return "/api/auth/bootstrap"
    if stripped.startswith("static/"):
        return f"/{stripped}"
    if stripped.startswith("api/"):
        return f"/{stripped}"
    return f"/api/{stripped}"
