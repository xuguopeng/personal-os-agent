from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .config import get_settings
from .local_music import scan_local_music_library
from .metadata_scrape import ScrapeJobCreateRequest, create_scrape_job

router = APIRouter(prefix="/v1/music/api/download/sqmusic", tags=["sqmusic-download"])


class SqmusicDownloadSongRequest(BaseModel):
    track: dict[str, Any] = Field(default_factory=dict)
    brType: str = ""
    autoSelectBrType: bool = True


class SqmusicRescanRequest(BaseModel):
    incremental: bool = True
    scrapeMissingWithQqMusic: bool = True
    scrapeLimit: int = Field(default=50, ge=1, le=1000)
    minConfidence: float = Field(default=0.92, ge=0, le=1)


@router.get("/status")
def sqmusic_download_status() -> dict[str, Any]:
    settings = get_settings()
    status = "unknown"
    version_payload: dict[str, Any] = {}
    try:
        version_payload = sqmusic_request("GET", "/api/config/version")
        status = "connected" if version_payload.get("code") == 200 else "error"
    except Exception as error:  # noqa: BLE001 - return status payload instead of raising
        status = "error"
        version_payload = {"message": str(error)}
    return {
        "status": status,
        "baseUrl": normalize_base_url(settings.sqmusic_base_url),
        "loginConfigured": bool(settings.sqmusic_username and settings.sqmusic_password),
        "plugNames": split_csv(settings.sqmusic_plug_names),
        "preferredBrTypes": split_csv(settings.sqmusic_preferred_br_types),
        "version": version_payload,
        "message": "sqmusic 下载桥接只负责搜索和发起下载；歌词/封面缺失走 QQ 音乐刮削。",
    }


@router.get("/search")
def search_sqmusic_tracks(
    keyword: str = Query(min_length=1),
    plugName: str = "",
    pageSize: int = Query(default=20, ge=1, le=100),
    pageIndex: int = Query(default=1, ge=1),
) -> dict[str, Any]:
    settings = get_settings()
    plug_names = [plugName] if plugName else split_csv(settings.sqmusic_plug_names)
    items: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for plug_name in plug_names:
        try:
            payload = sqmusic_request(
                "GET",
                "/api/music/searchSong",
                params={
                    "plugName": plug_name,
                    "keyword": keyword,
                    "pageSize": str(pageSize),
                    "pageIndex": str(pageIndex),
                },
            )
            if payload.get("code") != 200:
                errors.append({"plugName": plug_name, "message": str(payload.get("msg") or "")})
                continue
            data = payload.get("data") or {}
            records = data.get("records") or []
            for record in records:
                if isinstance(record, dict):
                    items.append(normalize_track_record(record))
        except Exception as error:  # noqa: BLE001 - one platform should not fail all search
            errors.append({"plugName": plug_name, "message": str(error)})
    return {
        "status": "completed",
        "keyword": keyword,
        "count": len(items),
        "items": items,
        "errors": errors,
    }


@router.post("/song")
def download_sqmusic_song(request: SqmusicDownloadSongRequest) -> dict[str, Any]:
    track = dict(request.track or {})
    if not track:
        return {"status": "error", "ok": False, "message": "缺少要下载的歌曲记录。"}
    br_type = request.brType.strip()
    if request.autoSelectBrType and not br_type:
        br_type = choose_br_type(track.get("brTypes") or [])
    if not br_type:
        return {
            "status": "error",
            "ok": False,
            "message": "这首歌没有可用音质，请换一个候选。",
        }
    payload = denormalize_download_track(track)
    payload["brType"] = br_type
    response = sqmusic_request("POST", "/api/download/downloadSong", body=payload)
    ok = response.get("code") == 200
    return {
        "status": "queued" if ok else "error",
        "ok": ok,
        "brType": br_type,
        "track": normalize_track_record(track),
        "sqmusic": response,
        "message": "已提交 sqmusic 下载任务。" if ok else str(response.get("msg") or "sqmusic 下载任务提交失败。"),
    }


@router.get("/tasks")
def list_sqmusic_tasks(
    pageSize: int = Query(default=20, ge=1, le=100),
    pageIndex: int = Query(default=1, ge=1),
    downloadStatus: str = "",
    downloadMusicname: str = "",
    downloadArtistname: str = "",
    downloadAlbumname: str = "",
    downloadPlugName: str = "",
) -> dict[str, Any]:
    body = {
        "pageSize": pageSize,
        "pageIndex": pageIndex,
        "downloadStatus": downloadStatus,
        "downloadMusicname": downloadMusicname,
        "downloadArtistname": downloadArtistname,
        "downloadAlbumname": downloadAlbumname,
        "downloadPlugName": downloadPlugName,
    }
    body = {key: value for key, value in body.items() if value not in {"", None}}
    payload = sqmusic_request("POST", "/api/task/list", body=body)
    return {
        "status": "completed" if payload.get("code") == 200 else "error",
        "sqmusic": payload,
    }


@router.post("/tasks/{task_id}/refresh")
def refresh_sqmusic_task(task_id: int) -> dict[str, Any]:
    payload = sqmusic_request("POST", "/api/task/refreshTask", body={"id": task_id})
    return {
        "status": "completed" if payload.get("code") == 200 else "error",
        "sqmusic": payload,
    }


@router.delete("/tasks/{task_id}")
def delete_sqmusic_task(task_id: int) -> dict[str, Any]:
    payload = sqmusic_request("POST", "/api/task/del", body={"id": task_id})
    return {
        "status": "completed" if payload.get("code") == 200 else "error",
        "sqmusic": payload,
    }


@router.post("/rescan")
def rescan_after_sqmusic_download(request: SqmusicRescanRequest) -> dict[str, Any]:
    scan_result = scan_local_music_library(incremental=request.incremental)
    scrape_job: dict[str, Any] | None = None
    if request.scrapeMissingWithQqMusic:
        scrape_job = create_scrape_job(
            ScrapeJobCreateRequest(
                providers=["qqmusic"],
                missing=["lyrics", "cover"],
                limit=request.scrapeLimit,
                candidateLimit=3,
                autoApply=True,
                minConfidence=request.minConfidence,
            )
        )
    return {
        "status": "completed",
        "scan": scan_result,
        "metadataScrape": scrape_job,
        "message": "扫描完成；如启用 QQ 音乐刮削，缺失歌词/封面会在后台补全。",
    }


def sqmusic_request(
    method: str,
    path: str,
    params: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    base_url = normalize_base_url(get_settings().sqmusic_base_url)
    url = f"{base_url}{path}"
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        if settings.sqmusic_username and settings.sqmusic_password:
            login_sqmusic_client(client, base_url, settings.sqmusic_username, settings.sqmusic_password)
        if method == "GET":
            response = client.get(url, params=params)
        else:
            response = client.post(url, json=body or {})
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, dict) else {"code": 500, "msg": "sqmusic 返回格式不是 JSON object。"}


def login_sqmusic_client(
    client: httpx.Client,
    base_url: str,
    username: str,
    password: str,
) -> None:
    response = client.post(
        f"{base_url}/api/config/login",
        json={
            "username": username,
            "password": password,
            "device": "personal-os-agent",
        },
    )
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict) and payload.get("code") not in {200, None}:
        raise RuntimeError(str(payload.get("msg") or "sqmusic 登录失败。"))


def normalize_track_record(record: dict[str, Any]) -> dict[str, Any]:
    artist_names = record.get("artistName")
    if isinstance(artist_names, list):
        artist = " / ".join(str(item).strip() for item in artist_names if str(item).strip())
    else:
        artist = str(artist_names or record.get("artist") or "").strip()
    br_types = record.get("brTypes") if isinstance(record.get("brTypes"), list) else []
    normalized = {
        "id": str(record.get("id") or "").strip(),
        "plugName": str(record.get("plugName") or "").strip(),
        "name": str(record.get("name") or record.get("songname") or "").strip(),
        "artistName": artist,
        "artistNames": artist_names if isinstance(artist_names, list) else ([artist] if artist else []),
        "artistids": record.get("artistids") if isinstance(record.get("artistids"), list) else [],
        "albumName": str(record.get("albumName") or "").strip(),
        "albumid": str(record.get("albumid") or "").strip(),
        "duration": record.get("duration") or "",
        "pic": str(record.get("pic") or "").strip(),
        "lyric": record.get("lyric"),
        "lyricId": record.get("lyricId"),
        "brTypes": br_types,
        "preferredBrType": choose_br_type(br_types),
        "dataInfo": record.get("dataInfo") if isinstance(record.get("dataInfo"), dict) else {},
    }
    return normalized


def denormalize_download_track(track: dict[str, Any]) -> dict[str, Any]:
    artist_names = track.get("artistNames")
    if not isinstance(artist_names, list):
        artist_text = str(track.get("artistName") or "").strip()
        artist_names = [artist_text] if artist_text else []
    return {
        "id": str(track.get("id") or "").strip(),
        "plugName": str(track.get("plugName") or "").strip(),
        "name": str(track.get("name") or "").strip(),
        "artistName": artist_names,
        "artistids": track.get("artistids") if isinstance(track.get("artistids"), list) else [],
        "albumName": str(track.get("albumName") or "").strip(),
        "albumid": str(track.get("albumid") or "").strip(),
        "duration": track.get("duration") or "",
        "pic": str(track.get("pic") or "").strip(),
        "lyric": track.get("lyric"),
        "lyricId": track.get("lyricId"),
        "brTypes": track.get("brTypes") if isinstance(track.get("brTypes"), list) else [],
        "dataInfo": track.get("dataInfo") if isinstance(track.get("dataInfo"), dict) else {},
    }


def choose_br_type(br_types: list[Any]) -> str:
    available = [str(item) for item in br_types if str(item).strip()]
    preferred = split_csv(get_settings().sqmusic_preferred_br_types)
    for item in preferred:
        if item in available:
            return item
    return available[0] if available else ""


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def normalize_base_url(value: str) -> str:
    base_url = value.rstrip("/")
    if base_url.endswith("/api"):
        base_url = base_url[:-4]
    return base_url
