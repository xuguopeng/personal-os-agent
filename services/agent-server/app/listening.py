from __future__ import annotations

import importlib.util
import inspect
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from sqlite3 import Connection
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .config import get_settings
from .db import db
from .music import fetch_recent_playback_tracks
from .repository import row_to_dict

router = APIRouter(prefix="/v1/listening", tags=["listening"])


class ListeningEventInput(BaseModel):
    source: str = Field(min_length=1)
    source_event_id: str | None = None
    source_user_id: str = ""
    source_type: str = "history"
    track_name: str = Field(min_length=1)
    artist_name: str = ""
    album_name: str = ""
    play_count: int = 1
    last_played_at: str | None = None
    confidence: float = 0.8
    tags: list[str] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class ListeningSyncRequest(BaseModel):
    source: str | None = None
    limit: int = Field(default=200, ge=1, le=2000)


@router.get("/status")
def listening_status() -> dict[str, Any]:
    with db() as conn:
        sources = [
            row_to_dict(row)
            for row in conn.execute(
                """
                SELECT
                    s.*,
                    (
                        SELECT count(*)
                        FROM listening_events e
                        WHERE e.source = s.source_key
                    ) AS event_count
                FROM listening_sources s
                ORDER BY s.source_key
                """
            ).fetchall()
        ]
    return {
        "status": "ready",
        "pluginDirs": plugin_dirs(),
        "sources": sources,
        "message": "听歌记录中心已就绪；网易云支持接口片段/JSON 导入，QQ/酷狗/酷我先走客户端采集或手动导入。",
    }


@router.get("/sources")
def list_listening_sources() -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM listening_sources ORDER BY source_key"
        ).fetchall()
        return [row_to_dict(row) for row in rows]


@router.get("/events")
def list_listening_events(
    source: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
) -> dict[str, Any]:
    where = ""
    params: list[Any] = []
    if source:
        where = "WHERE source = ?"
        params.append(source)
    params.append(limit)
    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM listening_events
            {where}
            ORDER BY
                CASE WHEN last_played_at IS NULL THEN 1 ELSE 0 END,
                last_played_at DESC,
                updated_at DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return {
            "items": [row_to_event(row_to_dict(row)) for row in rows],
            "count": len(rows),
        }


@router.post("/events/import")
def import_listening_events(events: list[ListeningEventInput]) -> dict[str, Any]:
    with db() as conn:
        imported = 0
        for event in events:
            upsert_listening_event(conn, event.model_dump())
            imported += 1
    return {"status": "imported", "imported": imported}


@router.post("/sync")
async def sync_listening_sources(request: ListeningSyncRequest) -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM listening_sources
            WHERE enabled = 1
              AND (? IS NULL OR source_key = ?)
            ORDER BY source_key
            """,
            (request.source, request.source),
        ).fetchall()
        sources = [row_to_dict(row) for row in rows]

    results: list[dict[str, Any]] = []
    for source in sources:
        result = await sync_single_source(source, request.limit)
        results.append(result)
    return {
        "status": "completed",
        "requestedSource": request.source,
        "results": results,
    }


@router.get("/profile")
def listening_profile(days: int = Query(default=180, ge=1, le=3650)) -> dict[str, Any]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    with db() as conn:
        source_counts = aggregate_rows(
            conn,
            """
            SELECT source AS name, count(*) AS event_count, sum(play_count) AS play_count
            FROM listening_events
            WHERE last_played_at IS NULL OR last_played_at >= ?
            GROUP BY source
            ORDER BY play_count DESC, event_count DESC
            LIMIT 20
            """,
            (cutoff,),
        )
        top_artists = aggregate_rows(
            conn,
            """
            SELECT artist_name AS name, count(*) AS event_count, sum(play_count) AS play_count
            FROM listening_events
            WHERE artist_name != ''
              AND (last_played_at IS NULL OR last_played_at >= ?)
            GROUP BY artist_name
            ORDER BY play_count DESC, event_count DESC
            LIMIT 30
            """,
            (cutoff,),
        )
        top_tracks = aggregate_rows(
            conn,
            """
            SELECT track_name AS name, artist_name, album_name, source,
                   max(last_played_at) AS last_played_at,
                   sum(play_count) AS play_count,
                   count(*) AS event_count
            FROM listening_events
            WHERE track_name != ''
              AND (last_played_at IS NULL OR last_played_at >= ?)
            GROUP BY normalized_track_key(track_name, artist_name)
            ORDER BY play_count DESC, event_count DESC, last_played_at DESC
            LIMIT 50
            """,
            (cutoff,),
            register_functions=True,
        )
    return {
        "days": days,
        "sourceCounts": source_counts,
        "topArtists": top_artists,
        "topTracks": top_tracks,
    }


async def sync_single_source(source: dict[str, Any], limit: int) -> dict[str, Any]:
    source_key = source["source_key"]
    run_id = str(uuid.uuid4())
    with db() as conn:
        conn.execute(
            """
            INSERT INTO listening_sync_runs (id, source, status)
            VALUES (?, ?, 'running')
            """,
            (run_id, source_key),
        )
    try:
        if source_key == "daoliyu":
            events = await collect_daoliyu_events(limit)
        else:
            events = await collect_private_plugin_events(source, limit)

        imported = 0
        with db() as conn:
            for event in events:
                upsert_listening_event(conn, event)
                imported += 1
            conn.execute(
                """
                UPDATE listening_sources
                SET status = 'synced',
                    last_synced_at = current_timestamp,
                    last_error = '',
                    updated_at = current_timestamp
                WHERE source_key = ?
                """,
                (source_key,),
            )
            conn.execute(
                """
                UPDATE listening_sync_runs
                SET status = 'success',
                    imported_count = ?,
                    finished_at = current_timestamp
                WHERE id = ?
                """,
                (imported, run_id),
            )
        return {"source": source_key, "status": "success", "imported": imported}
    except Exception as error:  # noqa: BLE001 - plugin errors should not crash the server
        message = str(error)
        with db() as conn:
            conn.execute(
                """
                UPDATE listening_sources
                SET status = 'error',
                    last_error = ?,
                    updated_at = current_timestamp
                WHERE source_key = ?
                """,
                (message, source_key),
            )
            conn.execute(
                """
                UPDATE listening_sync_runs
                SET status = 'error',
                    error = ?,
                    finished_at = current_timestamp
                WHERE id = ?
                """,
                (message, run_id),
            )
        return {"source": source_key, "status": "error", "message": message}


async def collect_daoliyu_events(limit: int) -> list[dict[str, Any]]:
    tracks = await fetch_recent_playback_tracks(limit)
    deduped: dict[str, dict[str, Any]] = {}
    for track in tracks:
        event = daoliyu_track_to_event(track)
        key = event["source_event_id"]
        if key not in deduped:
            deduped[key] = event
    return list(deduped.values())[:limit]


def daoliyu_track_to_event(track: dict[str, Any]) -> dict[str, Any]:
    track_id = str(track.get("id") or "").strip()
    title = str(track.get("title") or track.get("name") or "").strip()
    artist = daoliyu_artist_name(track)
    album = daoliyu_album_name(track)
    return {
        "source": "daoliyu",
        "source_event_id": track_id or normalized_track_key(title, artist),
        "source_user_id": "",
        "source_type": "history",
        "track_name": title or "未知歌曲",
        "artist_name": artist,
        "album_name": album,
        "play_count": int_or_default(track.get("playCount"), 1),
        "last_played_at": normalize_datetime(track.get("lastPlayedAt")),
        "confidence": 0.95,
        "tags": compact_list(track.get("genres")),
        "raw": {
            "id": track_id,
            "fileFormat": track.get("fileFormat"),
            "durationSeconds": track.get("durationSeconds"),
        },
    }


async def collect_private_plugin_events(
    source: dict[str, Any],
    limit: int,
) -> list[dict[str, Any]]:
    plugin_name = source.get("plugin_name") or source["source_key"]
    plugin_path = find_plugin_path(plugin_name)
    if plugin_path is None:
        raise RuntimeError(
            f"未找到私有插件 {plugin_name}.py；请放到 LISTENING_PLUGIN_DIRS。"
        )
    plugin = load_plugin(plugin_path, plugin_name)
    sync_fn = getattr(plugin, "sync", None)
    if sync_fn is None:
        raise RuntimeError(f"私有插件 {plugin_name}.py 缺少 sync(config) 函数。")
    config = {
        "source": source["source_key"],
        "limit": limit,
        "env": {
            key: value
            for key, value in os.environ.items()
            if key.startswith(("NETEASE_", "QQ_", "KUGOU_", "KUWO_", "MUSIC_SOURCE_"))
        },
    }
    result = sync_fn(config)
    if inspect.isawaitable(result):
        result = await result
    if not isinstance(result, list):
        raise RuntimeError(f"私有插件 {plugin_name}.py 必须返回 list[dict]。")
    return [normalize_plugin_event(source["source_key"], item) for item in result]


def plugin_dirs() -> list[str]:
    return [
        str(Path(value.strip()).expanduser())
        for value in get_settings().listening_plugin_dirs.split(",")
        if value.strip()
    ]


def find_plugin_path(plugin_name: str) -> Path | None:
    expected_name = f"{plugin_name}.py"
    for directory in plugin_dirs():
        path = Path(directory) / expected_name
        if path.exists() and path.is_file():
            return path
    return None


def load_plugin(path: Path, plugin_name: str) -> Any:
    module_name = f"personal_music_private_{plugin_name}_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载私有插件：{path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def normalize_plugin_event(source: str, event: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(event, dict):
        raise RuntimeError("插件返回的每条记录必须是 dict。")
    track_name = str(event.get("trackName") or event.get("track_name") or "").strip()
    artist_name = str(event.get("artistName") or event.get("artist_name") or "").strip()
    if not track_name:
        raise RuntimeError("插件返回的记录缺少 trackName。")
    source_event_id = str(
        event.get("sourceEventId")
        or event.get("source_event_id")
        or normalized_track_key(track_name, artist_name)
    )
    return {
        "source": source,
        "source_event_id": source_event_id,
        "source_user_id": str(event.get("sourceUserId") or event.get("source_user_id") or ""),
        "source_type": str(event.get("sourceType") or event.get("source_type") or "history"),
        "track_name": track_name,
        "artist_name": artist_name,
        "album_name": str(event.get("albumName") or event.get("album_name") or ""),
        "play_count": int_or_default(event.get("playCount") or event.get("play_count"), 1),
        "last_played_at": normalize_datetime(event.get("lastPlayedAt") or event.get("last_played_at")),
        "confidence": float_or_default(event.get("confidence"), 0.85),
        "tags": compact_list(event.get("tags")),
        "raw": sanitize_raw_json(event.get("raw") or event),
    }


def upsert_listening_event(conn: Connection, raw_event: dict[str, Any]) -> None:
    event = normalize_plugin_event(raw_event.get("source", ""), raw_event)
    event_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO listening_events (
            id, source, source_event_id, source_user_id, source_type,
            track_name, artist_name, album_name, play_count, last_played_at,
            confidence, tags_json, raw_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp, current_timestamp)
        ON CONFLICT(source, source_event_id) DO UPDATE SET
            source_user_id = excluded.source_user_id,
            source_type = excluded.source_type,
            track_name = excluded.track_name,
            artist_name = excluded.artist_name,
            album_name = excluded.album_name,
            play_count = excluded.play_count,
            last_played_at = excluded.last_played_at,
            confidence = excluded.confidence,
            tags_json = excluded.tags_json,
            raw_json = excluded.raw_json,
            updated_at = current_timestamp
        """,
        (
            event_id,
            event["source"],
            event["source_event_id"],
            event["source_user_id"],
            event["source_type"],
            event["track_name"],
            event["artist_name"],
            event["album_name"],
            event["play_count"],
            event["last_played_at"],
            event["confidence"],
            json.dumps(event["tags"], ensure_ascii=False),
            json.dumps(event["raw"], ensure_ascii=False),
        ),
    )


def aggregate_rows(
    conn: Connection,
    query: str,
    params: tuple[Any, ...],
    register_functions: bool = False,
) -> list[dict[str, Any]]:
    if register_functions:
        conn.create_function("normalized_track_key", 2, normalized_track_key)
    rows = conn.execute(query, params).fetchall()
    return [row_to_dict(row) for row in rows]


def row_to_event(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **row,
        "tags": parse_json_list(row.get("tags_json")),
        "raw": parse_json_object(row.get("raw_json")),
    }


def daoliyu_artist_name(track: dict[str, Any]) -> str:
    artists = track.get("artists")
    if isinstance(artists, list) and artists:
        first = artists[0]
        if isinstance(first, dict):
            nested = first.get("artist")
            if isinstance(nested, dict):
                return str(nested.get("name") or "").strip()
            return str(first.get("name") or "").strip()
    ar = track.get("ar")
    if isinstance(ar, list) and ar and isinstance(ar[0], dict):
        return str(ar[0].get("name") or "").strip()
    return str(track.get("artist") or track.get("albumArtist") or "").strip()


def daoliyu_album_name(track: dict[str, Any]) -> str:
    album = track.get("album")
    if isinstance(album, dict):
        return str(album.get("title") or album.get("name") or "").strip()
    al = track.get("al")
    if isinstance(al, dict):
        return str(al.get("name") or "").strip()
    return str(track.get("albumName") or "").strip()


def normalize_datetime(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        return datetime.fromisoformat(text).isoformat()
    except ValueError:
        return str(value)


def normalized_track_key(track_name: str, artist_name: str = "") -> str:
    value = f"{track_name}::{artist_name}".lower()
    value = re.sub(r"\s+", "", value)
    value = re.sub(r"[《》<>【】\\[\\]()（）「」\"'“”]", "", value)
    return value


def int_or_default(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(parsed, 0)


def float_or_default(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def compact_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = str(item).strip()
        if text and text not in result:
            result.append(text)
    return result


def parse_json_list(value: Any) -> list[Any]:
    try:
        parsed = json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def parse_json_object(value: Any) -> dict[str, Any]:
    try:
        parsed = json.loads(value or "{}")
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def sanitize_raw_json(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    blocked = ("cookie", "token", "password", "secret", "authorization")
    clean: dict[str, Any] = {}
    for key, item in value.items():
        lower_key = str(key).lower()
        if any(word in lower_key for word in blocked):
            continue
        clean[str(key)] = item
    return clean
