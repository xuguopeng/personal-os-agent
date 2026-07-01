from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from .config import get_settings

router = APIRouter(prefix="/v1/music", tags=["music"])

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
    base_url = normalized_daoliyu_base_url()
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(f"{base_url}/api/auth/bootstrap")
    except httpx.HTTPError as error:
        return {
            "status": "error",
            "baseUrl": base_url,
            "message": f"倒流服务不可达：{error}",
        }
    return {
        "status": "connected" if response.status_code < 500 else "error",
        "baseUrl": base_url,
        "httpStatus": response.status_code,
        "message": "倒流服务已连接。" if response.status_code < 500 else response.text[:300],
    }


@router.get("/endpoints")
def list_daoliyu_endpoints() -> dict[str, Any]:
    return {
        "service": "daoliyu",
        "baseUrl": normalized_daoliyu_base_url(),
        "count": len(DAOLIYU_ENDPOINTS),
        "proxyPrefix": "/v1/music",
        "auth": "登录接口走 /v1/music/api/auth/login；其他接口把倒流 token 放在 Authorization: Bearer <token>。",
        "endpoints": DAOLIYU_ENDPOINTS,
    }


@router.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_daoliyu(full_path: str, request: Request) -> Response:
    target_path = normalize_proxy_path(full_path)
    target_url = f"{normalized_daoliyu_base_url()}{target_path}"
    body = await request.body()
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
            upstream = await client.request(
                request.method,
                target_url,
                params=request.query_params,
                content=body,
                headers=headers,
            )
    except httpx.HTTPError as error:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "message": f"倒流服务代理失败：{error}",
                "target": target_url,
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


def normalized_daoliyu_base_url() -> str:
    return get_settings().daoliyu_base_url.rstrip("/")


def normalize_proxy_path(full_path: str) -> str:
    stripped = full_path.strip("/")
    if not stripped:
        return "/api/auth/bootstrap"
    if stripped.startswith("api/"):
        return f"/{stripped}"
    return f"/api/{stripped}"
