from __future__ import annotations

import hashlib
import json
import mimetypes
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from .config import get_settings
from .db import db
from .listening import upsert_listening_event
from .repository import row_to_dict

try:
    from mutagen import File as MutagenFile
except Exception:  # pragma: no cover - optional import is validated by requirements.
    MutagenFile = None


router = APIRouter(prefix="/v1/music", tags=["local-music"])

AUDIO_EXTENSIONS = {".mp3", ".flac", ".m4a", ".mp4", ".aac", ".wav", ".ogg"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
LYRIC_EXTENSIONS = {".lrc", ".txt"}
COVER_FILE_NAMES = {"cover", "folder", "front", "album", "封面"}
SCAN_STATE_LOCK = threading.RLock()
SCAN_STATE: dict[str, Any] = {
    "status": "idle",
    "mode": "",
    "startedAt": "",
    "finishedAt": "",
    "currentPath": "",
    "scanned": 0,
    "imported": 0,
    "skipped": 0,
    "errorCount": 0,
    "cancelRequested": False,
    "result": None,
    "error": "",
}


class PlaylistCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""


class PlaylistTrackRequest(BaseModel):
    trackId: str = Field(min_length=1)


class PlaylistUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class PlaylistTracksBatchRequest(BaseModel):
    trackIds: list[str] = Field(default_factory=list)


class PlaylistOrderRequest(BaseModel):
    trackIds: list[str] = Field(default_factory=list)


class PlayerPlayRequest(BaseModel):
    trackId: str = Field(min_length=1)


class LyricsUpdateRequest(BaseModel):
    lyrics: str = ""


class TrackMetadataUpdateRequest(BaseModel):
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    albumArtist: str | None = None
    year: str | None = None
    genre: str | None = None
    trackNumber: int | None = None
    discNumber: int | None = None


@router.get("/status")
def local_music_status() -> dict[str, Any]:
    settings = get_settings()
    with db() as conn:
        total = conn.execute("SELECT count(*) FROM music_tracks").fetchone()[0]
        favorites = conn.execute(
            "SELECT count(*) FROM music_tracks WHERE favorite = 1"
        ).fetchone()[0]
        playlists = conn.execute("SELECT count(*) FROM music_playlists").fetchone()[0]
    return {
        "status": "ready",
        "service": "local_music",
        "libraryRoots": music_library_roots(),
        "coverDir": settings.music_cover_dir,
        "trackCount": total,
        "favoriteCount": favorites,
        "playlistCount": playlists,
        "scan": scan_state_snapshot(),
        "message": "NAS 自有音乐服务已就绪。",
    }


@router.post("/api/admin/scan")
def scan_library() -> dict[str, Any]:
    return scan_local_music_library(incremental=False)


@router.post("/api/admin/scan/full")
def scan_library_full() -> dict[str, Any]:
    return scan_local_music_library(incremental=False)


@router.post("/api/admin/scan/incremental")
def scan_library_incremental() -> dict[str, Any]:
    return scan_local_music_library(incremental=True)


@router.post("/api/admin/scan/background")
def scan_library_background() -> dict[str, Any]:
    return start_background_scan(incremental=False)


@router.post("/api/admin/scan/background/incremental")
def scan_library_background_incremental() -> dict[str, Any]:
    return start_background_scan(incremental=True)


@router.get("/api/admin/scan/status")
def scan_library_status() -> dict[str, Any]:
    return scan_state_snapshot()


@router.post("/api/admin/scan/cancel")
def cancel_scan_library() -> dict[str, Any]:
    with SCAN_STATE_LOCK:
        if SCAN_STATE["status"] != "running":
            return {
                "status": SCAN_STATE["status"],
                "cancelled": False,
                "message": "当前没有正在运行的音乐扫描。",
                "scan": dict(SCAN_STATE),
            }
        SCAN_STATE["cancelRequested"] = True
    return {
        "status": "cancelling",
        "cancelled": True,
        "message": "已请求取消音乐扫描，当前文件处理结束后会停止。",
        "scan": scan_state_snapshot(),
    }


@router.get("/api/tracks")
def list_tracks(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    keyword: str = "",
    query: str = "",
    q: str = "",
) -> dict[str, Any]:
    where = ""
    params: list[Any] = []
    trimmed = (keyword or query or q).strip()
    if trimmed:
        where = """
        WHERE title LIKE ?
           OR artist LIKE ?
           OR album LIKE ?
           OR file_name LIKE ?
           OR source_path LIKE ?
        """
        pattern = f"%{trimmed}%"
        params.extend([pattern, pattern, pattern, pattern, pattern])
    with db() as conn:
        total = conn.execute(
            f"SELECT count(*) FROM music_tracks {where}",
            params,
        ).fetchone()[0]
        rows = conn.execute(
            f"""
            SELECT *
            FROM music_tracks
            {where}
            ORDER BY
                CASE WHEN title = '' THEN file_name ELSE title END COLLATE NOCASE,
                artist COLLATE NOCASE
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()
    return {
        "items": [track_row_to_api(row_to_dict(row)) for row in rows],
        "tracks": [track_row_to_api(row_to_dict(row)) for row in rows],
        "count": len(rows),
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/api/artists")
def list_artists(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    keyword: str = "",
) -> dict[str, Any]:
    where, params = artist_album_filter("artist", keyword)
    with db() as conn:
        total = conn.execute(
            f"""
            SELECT count(*)
            FROM (
                SELECT coalesce(nullif(artist, ''), '未知歌手') AS name
                FROM music_tracks
                {where}
                GROUP BY name
            )
            """,
            params,
        ).fetchone()[0]
        rows = conn.execute(
            f"""
            SELECT
                coalesce(nullif(artist, ''), '未知歌手') AS name,
                count(*) AS track_count,
                count(DISTINCT coalesce(nullif(album, ''), '未知专辑')) AS album_count,
                sum(duration_seconds) AS duration_seconds,
                max(last_played_at) AS last_played_at,
                max(cover_path) AS cover_path,
                max(id) AS cover_track_id
            FROM music_tracks
            {where}
            GROUP BY name
            ORDER BY name COLLATE NOCASE
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()
    items = [artist_row_to_api(row_to_dict(row)) for row in rows]
    return {"items": items, "artists": items, "count": len(items), "total": total}


@router.get("/api/artists/{artist_id}/tracks")
def list_artist_tracks(
    artist_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    artist = denormalized_lookup_value("artist", artist_id)
    if not artist:
        return not_found("没有找到这个歌手。")
    with db() as conn:
        total = conn.execute(
            "SELECT count(*) FROM music_tracks WHERE coalesce(nullif(artist, ''), '未知歌手') = ?",
            (artist,),
        ).fetchone()[0]
        rows = conn.execute(
            """
            SELECT *
            FROM music_tracks
            WHERE coalesce(nullif(artist, ''), '未知歌手') = ?
            ORDER BY album COLLATE NOCASE, track_number ASC, title COLLATE NOCASE
            LIMIT ? OFFSET ?
            """,
            (artist, limit, offset),
        ).fetchall()
    items = [track_row_to_api(row_to_dict(row)) for row in rows]
    return {
        "artist": {"id": normalized_key(artist), "name": artist},
        "items": items,
        "tracks": items,
        "count": len(items),
        "total": total,
        "more": offset + len(items) < total,
    }


@router.get("/api/artists/{artist_id}")
def get_artist(artist_id: str):
    artist = denormalized_lookup_value("artist", artist_id)
    if not artist:
        return not_found("没有找到这个歌手。")
    with db() as conn:
        row = conn.execute(
            """
            SELECT
                coalesce(nullif(artist, ''), '未知歌手') AS name,
                count(*) AS track_count,
                count(DISTINCT coalesce(nullif(album, ''), '未知专辑')) AS album_count,
                sum(duration_seconds) AS duration_seconds,
                max(last_played_at) AS last_played_at,
                max(cover_path) AS cover_path,
                max(id) AS cover_track_id
            FROM music_tracks
            WHERE coalesce(nullif(artist, ''), '未知歌手') = ?
            GROUP BY name
            """,
            (artist,),
        ).fetchone()
    return artist_row_to_api(row_to_dict(row)) if row else not_found("没有找到这个歌手。")


@router.get("/api/albums")
def list_albums(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    keyword: str = "",
) -> dict[str, Any]:
    where, params = artist_album_filter("album", keyword)
    with db() as conn:
        total = conn.execute(
            f"""
            SELECT count(*)
            FROM (
                SELECT coalesce(nullif(album, ''), '未知专辑') AS name
                FROM music_tracks
                {where}
                GROUP BY name
            )
            """,
            params,
        ).fetchone()[0]
        rows = conn.execute(
            f"""
            SELECT
                coalesce(nullif(album, ''), '未知专辑') AS name,
                coalesce(nullif(album_artist, ''), coalesce(nullif(artist, ''), '未知歌手')) AS artist,
                count(*) AS track_count,
                sum(duration_seconds) AS duration_seconds,
                min(year) AS year,
                max(cover_path) AS cover_path,
                max(id) AS cover_track_id
            FROM music_tracks
            {where}
            GROUP BY name
            ORDER BY name COLLATE NOCASE
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()
    items = [album_row_to_api(row_to_dict(row)) for row in rows]
    return {"items": items, "albums": items, "count": len(items), "total": total}


@router.get("/api/albums/{album_id}/tracks")
def list_album_tracks(
    album_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    album = denormalized_lookup_value("album", album_id)
    if not album:
        return not_found("没有找到这张专辑。")
    with db() as conn:
        total = conn.execute(
            "SELECT count(*) FROM music_tracks WHERE coalesce(nullif(album, ''), '未知专辑') = ?",
            (album,),
        ).fetchone()[0]
        rows = conn.execute(
            """
            SELECT *
            FROM music_tracks
            WHERE coalesce(nullif(album, ''), '未知专辑') = ?
            ORDER BY disc_number ASC, track_number ASC, title COLLATE NOCASE
            LIMIT ? OFFSET ?
            """,
            (album, limit, offset),
        ).fetchall()
    items = [track_row_to_api(row_to_dict(row)) for row in rows]
    return {
        "album": {"id": normalized_key(album), "name": album, "title": album},
        "items": items,
        "tracks": items,
        "count": len(items),
        "total": total,
        "more": offset + len(items) < total,
    }


@router.get("/api/albums/{album_id}")
def get_album(album_id: str):
    album = denormalized_lookup_value("album", album_id)
    if not album:
        return not_found("没有找到这张专辑。")
    payload = list_album_tracks(album_id, limit=500, offset=0)
    if isinstance(payload, JSONResponse):
        return payload
    tracks = payload["tracks"]
    first = tracks[0] if tracks else {}
    album_payload = {
        "id": normalized_key(album),
        "title": album,
        "name": album,
        "artist": first.get("albumArtist", "未知歌手") if first else "未知歌手",
        "coverArtUrl": first.get("coverArtUrl", "") if first else "",
        "picUrl": first.get("coverArtUrl", "") if first else "",
        "trackCount": len(tracks),
        "tracks": tracks,
    }
    return album_payload


@router.get("/api/recently-played")
def list_recently_played(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    with db() as conn:
        total = conn.execute(
            "SELECT count(*) FROM music_tracks WHERE last_played_at IS NOT NULL"
        ).fetchone()[0]
        rows = conn.execute(
            """
            SELECT *
            FROM music_tracks
            WHERE last_played_at IS NOT NULL
            ORDER BY last_played_at DESC, updated_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
    items = [track_row_to_api(row_to_dict(row)) for row in rows]
    return {
        "items": items,
        "tracks": items,
        "count": len(items),
        "total": total,
        "more": offset + len(items) < total,
    }


@router.get("/api/recent-played")
def list_recent_played_alias(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    return list_recently_played(limit=limit, offset=offset)


@router.get("/api/play-history")
def list_play_history(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    with db() as conn:
        total = conn.execute("SELECT count(*) FROM music_play_history").fetchone()[0]
        rows = conn.execute(
            """
            SELECT h.id AS history_id,
                   h.played_at,
                   h.source,
                   h.device_id,
                   t.*
            FROM music_play_history h
            JOIN music_tracks t ON t.id = h.track_id
            ORDER BY h.played_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
    items = []
    for row in rows:
        data = row_to_dict(row)
        track = track_row_to_api(data)
        items.append(
            {
                "id": data["history_id"],
                "trackId": track["id"],
                "playedAt": data["played_at"],
                "source": data["source"],
                "deviceId": data["device_id"],
                "track": track,
            }
        )
    return {
        "items": items,
        "count": len(items),
        "total": total,
        "more": offset + len(items) < total,
    }


@router.delete("/api/play-history")
def clear_play_history() -> dict[str, Any]:
    with db() as conn:
        conn.execute("DELETE FROM music_play_history")
        conn.execute("UPDATE music_tracks SET last_played_at = NULL")
    return {"status": "cleared", "ok": True}


@router.get("/api/stats")
def music_stats() -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            SELECT
                count(*) AS track_count,
                count(DISTINCT coalesce(nullif(artist, ''), '未知歌手')) AS artist_count,
                count(DISTINCT coalesce(nullif(album, ''), '未知专辑')) AS album_count,
                sum(file_size) AS total_size,
                sum(duration_seconds) AS total_duration,
                sum(play_count) AS total_play_count,
                sum(CASE WHEN favorite = 1 THEN 1 ELSE 0 END) AS favorite_count
            FROM music_tracks
            """
        ).fetchone()
    data = row_to_dict(row)
    return {
        "trackCount": int(data.get("track_count") or 0),
        "artistCount": int(data.get("artist_count") or 0),
        "albumCount": int(data.get("album_count") or 0),
        "totalSize": int(data.get("total_size") or 0),
        "totalDurationSeconds": int(data.get("total_duration") or 0),
        "totalPlayCount": int(data.get("total_play_count") or 0),
        "favoriteCount": int(data.get("favorite_count") or 0),
        "scan": scan_state_snapshot(),
    }


@router.get("/api/tracks/{track_id}/lyrics")
def get_track_lyrics(track_id: str):
    row = find_track_row(track_id)
    if row is None:
        return not_found("没有找到这首歌。")
    raw = row.get("lyrics") or ""
    lines = parse_lrc_lines(raw)
    return {
        "trackId": track_id,
        "raw": raw,
        "format": "lrc" if lines else "text" if raw else "none",
        "lines": lines,
        "hasLyrics": bool(raw.strip()),
    }


@router.put("/api/tracks/{track_id}/lyrics")
def update_track_lyrics(track_id: str, input: LyricsUpdateRequest):
    row = find_track_row(track_id)
    if row is None:
        return not_found("没有找到这首歌。")
    lyrics = input.lyrics.strip()
    with db() as conn:
        conn.execute(
            """
            UPDATE music_tracks
            SET lyrics = ?, updated_at = current_timestamp
            WHERE id = ?
            """,
            (lyrics, track_id),
        )
    return get_track_lyrics(track_id)


@router.patch("/api/tracks/{track_id}/metadata")
def update_track_metadata(track_id: str, input: TrackMetadataUpdateRequest):
    row = find_track_row(track_id)
    if row is None:
        return not_found("没有找到这首歌。")
    updates: list[str] = []
    values: list[Any] = []
    mapping = {
        "title": input.title,
        "artist": input.artist,
        "album": input.album,
        "album_artist": input.albumArtist,
        "year": input.year,
        "genre": input.genre,
        "track_number": input.trackNumber,
        "disc_number": input.discNumber,
    }
    for column, value in mapping.items():
        if value is None:
            continue
        updates.append(f"{column} = ?")
        values.append(clean_text(value) if isinstance(value, str) else int(value))
    if not updates:
        return track_row_to_api(row)
    values.append(track_id)
    with db() as conn:
        conn.execute(
            f"""
            UPDATE music_tracks
            SET {", ".join(updates)}, updated_at = current_timestamp
            WHERE id = ?
            """,
            values,
        )
    updated = find_track_row(track_id)
    return track_row_to_api(updated) if updated else not_found("没有找到这首歌。")


@router.get("/api/admin/metadata/report")
def metadata_report(
    limit: int = Query(default=50, ge=1, le=500),
) -> dict[str, Any]:
    with db() as conn:
        totals = row_to_dict(
            conn.execute(
                """
                SELECT
                    count(*) AS track_count,
                    sum(CASE WHEN lyrics = '' THEN 1 ELSE 0 END) AS missing_lyrics,
                    sum(CASE WHEN cover_path = '' THEN 1 ELSE 0 END) AS missing_covers,
                    sum(CASE WHEN artist = '' OR artist = '未知歌手' THEN 1 ELSE 0 END) AS unknown_artists,
                    sum(CASE WHEN album = '' OR album = '未知专辑' THEN 1 ELSE 0 END) AS unknown_albums,
                    sum(CASE WHEN duration_seconds = 0 THEN 1 ELSE 0 END) AS missing_duration
                FROM music_tracks
                """
            ).fetchone()
        )
        rows = conn.execute(
            """
            SELECT *
            FROM music_tracks
            WHERE lyrics = ''
               OR cover_path = ''
               OR artist = ''
               OR artist = '未知歌手'
               OR album = ''
               OR album = '未知专辑'
               OR duration_seconds = 0
            ORDER BY updated_at DESC, title COLLATE NOCASE
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    items = []
    for row in rows:
        data = row_to_dict(row)
        missing = []
        if not data.get("lyrics"):
            missing.append("lyrics")
        if not data.get("cover_path"):
            missing.append("cover")
        if not data.get("artist") or data.get("artist") == "未知歌手":
            missing.append("artist")
        if not data.get("album") or data.get("album") == "未知专辑":
            missing.append("album")
        if not data.get("duration_seconds"):
            missing.append("duration")
        items.append(
            {
                "trackId": data["id"],
                "title": data["title"] or data["file_name"],
                "artist": data["artist"],
                "album": data["album"],
                "sourcePath": data["source_path"],
                "missing": missing,
            }
        )
    return {
        "trackCount": int(totals.get("track_count") or 0),
        "missingLyrics": int(totals.get("missing_lyrics") or 0),
        "missingCovers": int(totals.get("missing_covers") or 0),
        "unknownArtists": int(totals.get("unknown_artists") or 0),
        "unknownAlbums": int(totals.get("unknown_albums") or 0),
        "missingDuration": int(totals.get("missing_duration") or 0),
        "items": items,
    }


def start_background_scan(incremental: bool) -> dict[str, Any]:
    with SCAN_STATE_LOCK:
        if SCAN_STATE["status"] == "running":
            return {
                "status": "running",
                "accepted": False,
                "message": "音乐扫描正在进行中。",
                "scan": dict(SCAN_STATE),
            }
        update_scan_state(
            {
                "status": "running",
                "mode": "incremental" if incremental else "full",
                "startedAt": current_timestamp_text(),
                "finishedAt": "",
                "currentPath": "",
                "scanned": 0,
                "imported": 0,
                "skipped": 0,
                "errorCount": 0,
                "cancelRequested": False,
                "result": None,
                "error": "",
            }
        )
    thread = threading.Thread(
        target=run_background_scan,
        args=(incremental,),
        name="local-music-scan",
        daemon=True,
    )
    thread.start()
    return {
        "status": "accepted",
        "accepted": True,
        "message": "音乐扫描已在后台开始。",
        "scan": scan_state_snapshot(),
    }


def run_background_scan(incremental: bool) -> None:
    try:
        result = scan_local_music_library(incremental=incremental, already_marked=True)
        mark_scan_finished(result)
    except Exception as error:  # noqa: BLE001 - background status should capture failures
        mark_scan_failed(str(error))


@router.get("/api/tracks/{track_id}")
def get_track(track_id: str):
    row = find_track_row(track_id)
    if row is None:
        return not_found("没有找到这首歌。")
    return track_row_to_api(row)


@router.get("/audio/{track_id}/status")
def local_audio_status(track_id: str) -> dict[str, Any]:
    row = find_track_row(track_id)
    if row is None:
        return {"status": "error", "message": "没有找到这首歌。"}
    path = Path(row["source_path"])
    if not path.exists() or not path.is_file():
        return {
            "status": "missing_file",
            "source": "local_file",
            "message": "音乐文件不存在，可能需要重新扫描。",
            "trackFilePath": str(path),
        }
    return {
        "status": "ready",
        "source": "local_file",
        "message": "本地音乐文件已就绪。",
        "contentType": guess_media_type(path),
        "fileSize": path.stat().st_size,
    }


@router.get("/audio/{track_id}")
def stream_local_audio(track_id: str, request: Request) -> Response:
    row = find_track_row(track_id)
    if row is None:
        return not_found("没有找到这首歌。")
    path = Path(row["source_path"])
    if not path.exists() or not path.is_file():
        return not_found("音乐文件不存在，可能需要重新扫描。")
    return ranged_file_response(path, request)


@router.get("/radio/episodes/{episode_id}/stream")
def stream_radio_episode(episode_id: str, request: Request) -> Response:
    episode = find_radio_episode(episode_id)
    if episode is None:
        return not_found("没有找到这个电台节目。")
    return stream_radio_audio_path(episode["audio_path"], request, "电台音频文件不存在。")


@router.get("/radio/episodes/{episode_id}/outro/stream")
def stream_radio_episode_outro(episode_id: str, request: Request) -> Response:
    episode = find_radio_episode(episode_id)
    if episode is None:
        return not_found("没有找到这个电台节目。")
    return stream_radio_audio_path(episode["outro_audio_path"], request, "电台收尾音频文件不存在。")


@router.get("/radio/episodes/{episode_id}/segments/{segment_id}/stream")
def stream_radio_episode_segment(episode_id: str, segment_id: str, request: Request) -> Response:
    episode = find_radio_episode(episode_id)
    if episode is None:
        return not_found("没有找到这个电台节目。")
    segments = parse_json_list(episode["segments_json"])
    segment = next(
        (
            item for item in segments
            if isinstance(item, dict) and str(item.get("id") or "") == segment_id
        ),
        None,
    )
    if segment is None:
        return not_found("没有找到这个电台片段。")
    return stream_radio_audio_path(segment.get("audioPath"), request, "电台片段音频文件不存在。")


@router.get("/covers/{track_id}")
def stream_cover(track_id: str) -> Response:
    row = find_track_row(track_id)
    if row is None or not row.get("cover_path"):
        return not_found("没有找到封面。")
    path = Path(row["cover_path"])
    if not path.exists() or not path.is_file():
        return not_found("封面文件不存在。")
    return FileResponse(path, media_type=guess_media_type(path))


@router.get("/api/playlists")
def list_playlists() -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT p.*,
                   count(pt.track_id) AS track_count
            FROM music_playlists p
            LEFT JOIN music_playlist_tracks pt ON pt.playlist_id = p.id
            GROUP BY p.id
            ORDER BY p.updated_at DESC, p.name ASC
            """
        ).fetchall()
    return {"items": [playlist_row_to_api(row_to_dict(row)) for row in rows]}


@router.post("/api/playlists")
def create_playlist(input: PlaylistCreateRequest) -> dict[str, Any]:
    playlist_id = str(uuid.uuid4())
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_playlists (id, name, description)
            VALUES (?, ?, ?)
            """,
            (playlist_id, input.name.strip(), input.description.strip()),
        )
    return get_playlist_payload(playlist_id)


@router.patch("/api/playlists/{playlist_id}")
def update_playlist(playlist_id: str, input: PlaylistUpdateRequest):
    updates: list[str] = []
    values: list[Any] = []
    if input.name is not None:
        name = input.name.strip()
        if not name:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "歌单名称不能为空。"},
            )
        updates.append("name = ?")
        values.append(name)
    if input.description is not None:
        updates.append("description = ?")
        values.append(input.description.strip())
    if not updates:
        payload = get_playlist_payload(playlist_id)
        return payload if payload else not_found("没有找到歌单。")
    values.append(playlist_id)
    with db() as conn:
        row = conn.execute(
            "SELECT id FROM music_playlists WHERE id = ?",
            (playlist_id,),
        ).fetchone()
        if row is None:
            return not_found("没有找到歌单。")
        conn.execute(
            f"""
            UPDATE music_playlists
            SET {", ".join(updates)}, updated_at = current_timestamp
            WHERE id = ?
            """,
            values,
        )
    return get_playlist_payload(playlist_id)


@router.delete("/api/playlists/{playlist_id}")
def delete_playlist(playlist_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            "SELECT id FROM music_playlists WHERE id = ?",
            (playlist_id,),
        ).fetchone()
        if row is None:
            return {"status": "missing", "ok": False, "playlistId": playlist_id}
        conn.execute("DELETE FROM music_playlists WHERE id = ?", (playlist_id,))
    return {"status": "deleted", "ok": True, "playlistId": playlist_id}


@router.get("/api/playlists/{playlist_id}")
def get_playlist(playlist_id: str):
    playlist = get_playlist_payload(playlist_id)
    if not playlist:
        return not_found("没有找到歌单。")
    return playlist


@router.post("/api/playlists/{playlist_id}/tracks/batch")
def add_playlist_tracks_batch(playlist_id: str, input: PlaylistTracksBatchRequest):
    with db() as conn:
        playlist = conn.execute(
            "SELECT id FROM music_playlists WHERE id = ?",
            (playlist_id,),
        ).fetchone()
        if playlist is None:
            return not_found("没有找到歌单。")
        position = conn.execute(
            "SELECT coalesce(max(position), -1) + 1 FROM music_playlist_tracks WHERE playlist_id = ?",
            (playlist_id,),
        ).fetchone()[0]
        added = 0
        missing: list[str] = []
        for track_id in dedupe_strings(input.trackIds):
            track = conn.execute(
                "SELECT id FROM music_tracks WHERE id = ?",
                (track_id,),
            ).fetchone()
            if track is None:
                missing.append(track_id)
                continue
            conn.execute(
                """
                INSERT INTO music_playlist_tracks (playlist_id, track_id, position)
                VALUES (?, ?, ?)
                ON CONFLICT(playlist_id, track_id) DO UPDATE SET position = excluded.position
                """,
                (playlist_id, track_id, position),
            )
            added += 1
            position += 1
        conn.execute(
            "UPDATE music_playlists SET updated_at = current_timestamp WHERE id = ?",
            (playlist_id,),
        )
    payload = get_playlist_payload(playlist_id)
    payload["added"] = added
    payload["missingTrackIds"] = missing
    return payload


@router.put("/api/playlists/{playlist_id}/tracks/order")
def reorder_playlist_tracks(playlist_id: str, input: PlaylistOrderRequest):
    ordered_ids = dedupe_strings(input.trackIds)
    with db() as conn:
        playlist = conn.execute(
            "SELECT id FROM music_playlists WHERE id = ?",
            (playlist_id,),
        ).fetchone()
        if playlist is None:
            return not_found("没有找到歌单。")
        existing = {
            row["track_id"]
            for row in conn.execute(
                "SELECT track_id FROM music_playlist_tracks WHERE playlist_id = ?",
                (playlist_id,),
            ).fetchall()
        }
        position = 0
        for track_id in ordered_ids:
            if track_id not in existing:
                continue
            conn.execute(
                """
                UPDATE music_playlist_tracks
                SET position = ?
                WHERE playlist_id = ? AND track_id = ?
                """,
                (position, playlist_id, track_id),
            )
            position += 1
        for track_id in sorted(existing - set(ordered_ids)):
            conn.execute(
                """
                UPDATE music_playlist_tracks
                SET position = ?
                WHERE playlist_id = ? AND track_id = ?
                """,
                (position, playlist_id, track_id),
            )
            position += 1
        conn.execute(
            "UPDATE music_playlists SET updated_at = current_timestamp WHERE id = ?",
            (playlist_id,),
        )
    return get_playlist_payload(playlist_id)


@router.delete("/api/playlists/{playlist_id}/tracks")
def clear_playlist_tracks(playlist_id: str) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            "DELETE FROM music_playlist_tracks WHERE playlist_id = ?",
            (playlist_id,),
        )
        conn.execute(
            "UPDATE music_playlists SET updated_at = current_timestamp WHERE id = ?",
            (playlist_id,),
        )
    return {"status": "cleared", "ok": True, "playlistId": playlist_id}


@router.post("/api/playlists/{playlist_id}/tracks")
def add_playlist_track(playlist_id: str, input: PlaylistTrackRequest):
    with db() as conn:
        playlist = conn.execute(
            "SELECT id FROM music_playlists WHERE id = ?",
            (playlist_id,),
        ).fetchone()
        track = conn.execute(
            "SELECT id FROM music_tracks WHERE id = ?",
            (input.trackId,),
        ).fetchone()
        if playlist is None or track is None:
            return not_found("歌单或歌曲不存在。")
        position = conn.execute(
            "SELECT coalesce(max(position), -1) + 1 FROM music_playlist_tracks WHERE playlist_id = ?",
            (playlist_id,),
        ).fetchone()[0]
        conn.execute(
            """
            INSERT INTO music_playlist_tracks (playlist_id, track_id, position)
            VALUES (?, ?, ?)
            ON CONFLICT(playlist_id, track_id) DO UPDATE SET position = excluded.position
            """,
            (playlist_id, input.trackId, position),
        )
        conn.execute(
            "UPDATE music_playlists SET updated_at = current_timestamp WHERE id = ?",
            (playlist_id,),
        )
    return get_playlist_payload(playlist_id)


@router.delete("/api/playlists/{playlist_id}/tracks/{track_id}")
def remove_playlist_track(playlist_id: str, track_id: str) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            "DELETE FROM music_playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            (playlist_id, track_id),
        )
        conn.execute(
            "UPDATE music_playlists SET updated_at = current_timestamp WHERE id = ?",
            (playlist_id,),
        )
    return {"status": "removed"}


@router.get("/api/favorites/tracks")
def list_favorite_tracks() -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM music_tracks
            WHERE favorite = 1
            ORDER BY updated_at DESC
            """
        ).fetchall()
    items = [track_row_to_api(row_to_dict(row)) for row in rows]
    return {
        "items": items,
        "tracks": items,
        "trackIds": [item["id"] for item in items],
        "count": len(items),
        "total": len(items),
    }


@router.post("/api/favorites/tracks")
def add_favorite_track(input: PlaylistTrackRequest) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            "UPDATE music_tracks SET favorite = 1, updated_at = current_timestamp WHERE id = ?",
            (input.trackId,),
        )
    return {"status": "favorited", "ok": True, "trackId": input.trackId, "liked": True}


@router.put("/api/favorites/tracks/{track_id}")
def put_favorite_track(track_id: str) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            "UPDATE music_tracks SET favorite = 1, updated_at = current_timestamp WHERE id = ?",
            (track_id,),
        )
    return {"status": "favorited", "ok": True, "trackId": track_id, "liked": True}


@router.delete("/api/favorites/tracks/{track_id}")
def remove_favorite_track(track_id: str) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            "UPDATE music_tracks SET favorite = 0, updated_at = current_timestamp WHERE id = ?",
            (track_id,),
        )
    return {"status": "unfavorited", "ok": True, "trackId": track_id, "liked": False}


@router.post("/api/player/play")
def mark_track_played(input: PlayerPlayRequest) -> dict[str, Any]:
    row = find_track_row(input.trackId)
    if row is None:
        return {"status": "missing", "trackId": input.trackId}
    with db() as conn:
        conn.execute(
            """
            UPDATE music_tracks
            SET play_count = play_count + 1,
                last_played_at = current_timestamp,
                updated_at = current_timestamp
            WHERE id = ?
            """,
            (input.trackId,),
        )
        conn.execute(
            """
            INSERT INTO music_play_history (id, track_id, source)
            VALUES (?, ?, 'client')
            """,
            (str(uuid.uuid4()), input.trackId),
        )
        upsert_listening_event(
            conn,
            {
                "source": "local_music",
                "source_event_id": f"local_music:{input.trackId}",
                "source_type": "playback",
                "track_name": row["title"] or row["file_name"],
                "artist_name": row["artist"],
                "album_name": row["album"],
                "play_count": int(row["play_count"] or 0) + 1,
                "confidence": 1.0,
                "tags": ["沐音播放"],
                "raw": {"trackId": input.trackId, "sourcePath": row["source_path"]},
            },
        )
    return {"status": "playing", "trackId": input.trackId}


@router.post("/api/player/pause")
def mark_player_paused() -> dict[str, Any]:
    return {"status": "paused"}


def scan_local_music_library(incremental: bool, already_marked: bool = False) -> dict[str, Any]:
    if not already_marked:
        mark_scan_started("incremental" if incremental else "full")
    started = time.monotonic()
    roots = [Path(path) for path in music_library_roots()]
    cover_dir = Path(get_settings().music_cover_dir)
    cover_dir.mkdir(parents=True, exist_ok=True)
    scanned = 0
    imported = 0
    skipped = 0
    errors: list[dict[str, str]] = []
    seen_paths: set[str] = set()
    with db() as conn:
        for root in roots:
            if not root.exists():
                errors.append({"path": str(root), "message": "目录不存在"})
                continue
            for path in root.rglob("*"):
                if scan_cancel_requested():
                    result = {
                        "status": "cancelled",
                        "mode": "incremental" if incremental else "full",
                        "roots": [str(root) for root in roots],
                        "scanned": scanned,
                        "imported": imported,
                        "skipped": skipped,
                        "errors": errors[:50],
                        "errorCount": len(errors),
                        "durationSeconds": round(time.monotonic() - started, 3),
                    }
                    if not already_marked:
                        mark_scan_finished(result)
                    return result
                if should_skip_audio_path(path):
                    continue
                scanned += 1
                normalized_path = str(path.resolve())
                update_scan_state(
                    {
                        "currentPath": normalized_path,
                        "scanned": scanned,
                        "imported": imported,
                        "skipped": skipped,
                        "errorCount": len(errors),
                    }
                )
                seen_paths.add(normalized_path)
                stat = path.stat()
                existing = conn.execute(
                    "SELECT id, file_mtime, file_size FROM music_tracks WHERE source_path = ?",
                    (normalized_path,),
                ).fetchone()
                if (
                    incremental
                    and existing is not None
                    and float(existing["file_mtime"]) == float(stat.st_mtime)
                    and int(existing["file_size"]) == int(stat.st_size)
                ):
                    skipped += 1
                    update_scan_state({"skipped": skipped})
                    continue
                try:
                    track = read_track_metadata(path, cover_dir)
                    upsert_track(conn, track)
                    imported += 1
                except Exception as error:  # noqa: BLE001 - one bad file should not stop scan
                    message = str(error).strip() or type(error).__name__
                    errors.append({"path": normalized_path, "message": message})
                update_scan_state(
                    {
                        "imported": imported,
                        "skipped": skipped,
                        "errorCount": len(errors),
                    }
                )
        if not incremental:
            existing_paths = {
                row["source_path"]
                for row in conn.execute("SELECT source_path FROM music_tracks").fetchall()
            }
            for stale_path in existing_paths - seen_paths:
                conn.execute("DELETE FROM music_tracks WHERE source_path = ?", (stale_path,))
    result = {
        "status": "scanned",
        "mode": "incremental" if incremental else "full",
        "roots": [str(root) for root in roots],
        "scanned": scanned,
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:50],
        "errorCount": len(errors),
        "durationSeconds": round(time.monotonic() - started, 3),
    }
    if not already_marked:
        mark_scan_finished(result)
    return result


def mark_scan_started(mode: str) -> None:
    update_scan_state(
        {
            "status": "running",
            "mode": mode,
            "startedAt": current_timestamp_text(),
            "finishedAt": "",
            "currentPath": "",
            "scanned": 0,
            "imported": 0,
            "skipped": 0,
            "errorCount": 0,
            "cancelRequested": False,
            "result": None,
            "error": "",
        }
    )


def mark_scan_finished(result: dict[str, Any]) -> None:
    update_scan_state(
        {
            "status": result.get("status", "finished"),
            "mode": result.get("mode", ""),
            "finishedAt": current_timestamp_text(),
            "currentPath": "",
            "scanned": result.get("scanned", 0),
            "imported": result.get("imported", 0),
            "skipped": result.get("skipped", 0),
            "errorCount": result.get("errorCount", 0),
            "cancelRequested": False,
            "result": result,
            "error": "",
        }
    )


def mark_scan_failed(message: str) -> None:
    update_scan_state(
        {
            "status": "error",
            "finishedAt": current_timestamp_text(),
            "error": message,
        }
    )


def update_scan_state(values: dict[str, Any]) -> None:
    with SCAN_STATE_LOCK:
        SCAN_STATE.update(values)


def scan_state_snapshot() -> dict[str, Any]:
    with SCAN_STATE_LOCK:
        return dict(SCAN_STATE)


def scan_cancel_requested() -> bool:
    with SCAN_STATE_LOCK:
        return bool(SCAN_STATE.get("cancelRequested"))


def current_timestamp_text() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def artist_album_filter(column: str, keyword: str) -> tuple[str, list[Any]]:
    trimmed = keyword.strip()
    if not trimmed:
        return "", []
    return f"WHERE coalesce(nullif({column}, ''), '') LIKE ?", [f"%{trimmed}%"]


def artist_row_to_api(row: dict[str, Any]) -> dict[str, Any]:
    name = row.get("name") or "未知歌手"
    cover_url = cover_url_from_row(row)
    return {
        "id": normalized_key(name),
        "name": name,
        "picUrl": cover_url,
        "avatar": cover_url,
        "coverArtUrl": cover_url,
        "musicSize": int(row.get("track_count") or 0),
        "trackCount": int(row.get("track_count") or 0),
        "albumSize": int(row.get("album_count") or 0),
        "durationSeconds": int(row.get("duration_seconds") or 0),
        "lastPlayedAt": row.get("last_played_at"),
    }


def album_row_to_api(row: dict[str, Any]) -> dict[str, Any]:
    title = row.get("name") or "未知专辑"
    artist = row.get("artist") or "未知歌手"
    cover_url = cover_url_from_row(row)
    return {
        "id": normalized_key(title),
        "title": title,
        "name": title,
        "artist": artist,
        "albumArtist": artist,
        "coverArtUrl": cover_url,
        "picUrl": cover_url,
        "trackCount": int(row.get("track_count") or 0),
        "durationSeconds": int(row.get("duration_seconds") or 0),
        "year": row.get("year") or "",
    }


def cover_url_from_row(row: dict[str, Any]) -> str:
    track_id = row.get("cover_track_id") or ""
    return f"/v1/music/covers/{track_id}" if row.get("cover_path") and track_id else ""


def denormalized_lookup_value(column: str, normalized: str) -> str:
    fallback = normalized.strip()
    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT DISTINCT coalesce(nullif({column}, ''), ?) AS value
            FROM music_tracks
            """,
            ("未知歌手" if column == "artist" else "未知专辑",),
        ).fetchall()
    for row in rows:
        value = row["value"]
        if value == fallback or normalized_key(value) == fallback:
            return value
    return fallback if fallback else ""


def read_track_metadata(path: Path, cover_dir: Path) -> dict[str, Any]:
    stat = path.stat()
    audio = safe_mutagen_file(path)
    tags = getattr(audio, "tags", None)
    duration = int(getattr(getattr(audio, "info", None), "length", 0) or 0)
    fallback = fallback_metadata_from_path(path)
    title = first_tag(tags, "title", "TIT2", "\xa9nam") or fallback["title"]
    artist = first_tag(tags, "artist", "TPE1", "\xa9ART") or fallback["artist"]
    album = first_tag(tags, "album", "TALB", "\xa9alb") or fallback["album"]
    album_artist = first_tag(tags, "albumartist", "album_artist", "TPE2", "aART")
    lyrics = first_tag(tags, "lyrics", "USLT::XXX", "\xa9lyr") or read_sidecar_lyrics(path)
    cover_path = extract_cover(path, audio, cover_dir) or copy_sidecar_cover(path, cover_dir)
    return {
        "id": stable_track_id(path),
        "source_path": str(path.resolve()),
        "file_name": path.name,
        "title": clean_text(title),
        "artist": clean_text(artist),
        "album": clean_text(album),
        "album_artist": clean_text(album_artist),
        "duration_seconds": duration,
        "track_number": parse_number(first_tag(tags, "tracknumber", "TRCK", "trkn")),
        "disc_number": parse_number(first_tag(tags, "discnumber", "TPOS", "disk")),
        "year": clean_text(first_tag(tags, "date", "year", "TDRC", "\xa9day")),
        "genre": clean_text(first_tag(tags, "genre", "TCON", "\xa9gen")),
        "lyrics": str(lyrics or "").strip(),
        "cover_path": cover_path,
        "file_format": path.suffix.lower().lstrip("."),
        "file_size": stat.st_size,
        "file_mtime": stat.st_mtime,
    }


def should_skip_audio_path(path: Path) -> bool:
    if not path.is_file() or path.suffix.lower() not in AUDIO_EXTENSIONS:
        return True
    if path.name.startswith("._"):
        return True
    if any(part.startswith("._") for part in path.parts):
        return True
    return False


def safe_mutagen_file(path: Path) -> Any | None:
    if not MutagenFile:
        return None
    try:
        return MutagenFile(path)
    except Exception:  # noqa: BLE001 - bad tags should not block local playback
        return None


def fallback_metadata_from_path(path: Path) -> dict[str, str]:
    title = path.stem.strip() or "未知歌曲"
    album = path.parent.name.strip() if path.parent.name else "未知专辑"
    artist = "未知歌手"
    try:
        if path.parent.parent and path.parent.parent.name:
            artist = path.parent.parent.name.strip() or artist
    except IndexError:
        pass
    if " - " in title:
        left, right = [part.strip() for part in title.split(" - ", 1)]
        if left and right:
            title, artist = left, right
    elif "-" in title:
        left, right = [part.strip() for part in title.split("-", 1)]
        if left and right and artist == "未知歌手":
            artist, title = left, right
    return {
        "title": title or "未知歌曲",
        "artist": artist or "未知歌手",
        "album": album or "未知专辑",
    }


def upsert_track(conn: Any, track: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO music_tracks (
            id, source_path, file_name, title, artist, album, album_artist,
            duration_seconds, track_number, disc_number, year, genre, lyrics,
            cover_path, file_format, file_size, file_mtime, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp, current_timestamp)
        ON CONFLICT(source_path) DO UPDATE SET
            file_name = excluded.file_name,
            title = excluded.title,
            artist = excluded.artist,
            album = excluded.album,
            album_artist = excluded.album_artist,
            duration_seconds = excluded.duration_seconds,
            track_number = excluded.track_number,
            disc_number = excluded.disc_number,
            year = excluded.year,
            genre = excluded.genre,
            lyrics = CASE
                WHEN excluded.lyrics != '' THEN excluded.lyrics
                ELSE music_tracks.lyrics
            END,
            cover_path = CASE
                WHEN excluded.cover_path != '' THEN excluded.cover_path
                ELSE music_tracks.cover_path
            END,
            file_format = excluded.file_format,
            file_size = excluded.file_size,
            file_mtime = excluded.file_mtime,
            updated_at = current_timestamp
        """,
        (
            track["id"],
            track["source_path"],
            track["file_name"],
            track["title"],
            track["artist"],
            track["album"],
            track["album_artist"],
            track["duration_seconds"],
            track["track_number"],
            track["disc_number"],
            track["year"],
            track["genre"],
            track["lyrics"],
            track["cover_path"],
            track["file_format"],
            track["file_size"],
            track["file_mtime"],
        ),
    )


def track_row_to_api(row: dict[str, Any]) -> dict[str, Any]:
    title = row["title"] or Path(row["source_path"]).stem
    artist = row["artist"] or "未知歌手"
    album = row["album"] or "未知专辑"
    album_id = normalized_key(album)
    artist_id = normalized_key(artist)
    cover_url = f"/v1/music/covers/{row['id']}" if row.get("cover_path") else ""
    return {
        "id": row["id"],
        "title": title,
        "name": title,
        "albumArtist": artist,
        "albumTitle": album,
        "albumId": album_id,
        "durationSeconds": row["duration_seconds"],
        "dt": int(row["duration_seconds"] or 0) * 1000,
        "fileName": row["file_name"],
        "fileFormat": row["file_format"],
        "filePath": row["source_path"],
        "sourcePath": row["source_path"],
        "fileSize": row["file_size"],
        "year": row["year"],
        "genre": row["genre"],
        "trackNumber": row["track_number"],
        "discNumber": row["disc_number"],
        "coverArtUrl": cover_url,
        "lyrics": row["lyrics"],
        "playCount": row["play_count"],
        "favorite": bool(row["favorite"]),
        "lastPlayedAt": row["last_played_at"],
        "url": f"/v1/music/audio/{row['id']}",
        "album": {
            "id": album_id,
            "title": album,
            "name": album,
            "coverArtUrl": cover_url,
            "picUrl": cover_url,
        },
        "artists": [
            {
                "id": artist_id,
                "name": artist,
            }
        ],
        "ar": [{"id": artist_id, "name": artist}],
        "al": {
            "id": album_id,
            "name": album,
            "picUrl": cover_url,
        },
    }


def playlist_row_to_api(row: dict[str, Any]) -> dict[str, Any]:
    cover_url = row.get("coverArtUrl", "") or row.get("cover_art_url", "")
    return {
        "id": row["id"],
        "name": row["name"],
        "title": row["name"],
        "description": row.get("description", ""),
        "trackCount": row.get("track_count", 0),
        "coverArtUrl": cover_url,
        "coverImgUrl": cover_url,
        "picUrl": cover_url,
        "playCount": 0,
        "creator": {
            "nickname": "沐音 NAS",
            "avatarUrl": "",
        },
        "tracks": [],
    }


def get_playlist_payload(playlist_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM music_playlists WHERE id = ?",
            (playlist_id,),
        ).fetchone()
        if row is None:
            return {}
        tracks = conn.execute(
            """
            SELECT t.*
            FROM music_playlist_tracks pt
            JOIN music_tracks t ON t.id = pt.track_id
            WHERE pt.playlist_id = ?
            ORDER BY pt.position ASC, pt.created_at ASC
            """,
            (playlist_id,),
        ).fetchall()
    payload = playlist_row_to_api(row_to_dict(row))
    payload["tracks"] = [track_row_to_api(row_to_dict(track)) for track in tracks]
    payload["trackCount"] = len(payload["tracks"])
    first_cover = next(
        (track["coverArtUrl"] for track in payload["tracks"] if track.get("coverArtUrl")),
        "",
    )
    payload["coverArtUrl"] = first_cover
    payload["coverImgUrl"] = first_cover
    payload["picUrl"] = first_cover
    return payload


def find_track_row(track_id: str) -> dict[str, Any] | None:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM music_tracks WHERE id = ?",
            (track_id,),
        ).fetchone()
    return row_to_dict(row) if row else None


def music_library_roots() -> list[str]:
    return [
        value.strip()
        for value in get_settings().music_library_roots.split(",")
        if value.strip()
    ]


def stable_track_id(path: Path) -> str:
    return hashlib.sha1(str(path.resolve()).encode("utf-8")).hexdigest()[:24]


def first_tag(tags: Any, *keys: str) -> str:
    if not tags:
        return ""
    for key in keys:
        try:
            value = tags.get(key)
        except AttributeError:
            value = None
        text = tag_to_text(value)
        if text:
            return text
    return ""


def tag_to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        if not value:
            return ""
        return tag_to_text(value[0])
    if hasattr(value, "text"):
        return tag_to_text(value.text)
    return str(value).strip()


def clean_text(value: Any) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def dedupe_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
    return result


def parse_lrc_lines(raw: str) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for line in raw.splitlines():
        matches = list(re.finditer(r"\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]", line))
        if not matches:
            continue
        text = re.sub(r"\[[^\]]+\]", "", line).strip()
        for match in matches:
            minute = int(match.group(1))
            second = int(match.group(2))
            fraction = match.group(3) or "0"
            if len(fraction) == 1:
                millisecond = int(fraction) * 100
            elif len(fraction) == 2:
                millisecond = int(fraction) * 10
            else:
                millisecond = int(fraction[:3])
            lines.append(
                {
                    "timeMs": minute * 60_000 + second * 1000 + millisecond,
                    "text": text,
                }
            )
    return sorted(lines, key=lambda item: item["timeMs"])


def parse_number(value: Any) -> int:
    match = re.search(r"\d+", str(value or ""))
    return int(match.group(0)) if match else 0


def extract_cover(path: Path, audio: Any, cover_dir: Path) -> str:
    if not audio or not getattr(audio, "tags", None):
        return ""
    cover_bytes = embedded_cover_bytes(audio.tags)
    if not cover_bytes:
        return ""
    suffix = ".jpg" if cover_bytes[:3] == b"\xff\xd8\xff" else ".bin"
    cover_path = cover_dir / f"{stable_track_id(path)}{suffix}"
    if not cover_path.exists():
        cover_path.write_bytes(cover_bytes)
    return str(cover_path)


def read_sidecar_lyrics(path: Path) -> str:
    candidates = [path.with_suffix(extension) for extension in LYRIC_EXTENSIONS]
    for candidate in candidates:
        if not candidate.exists() or not candidate.is_file():
            continue
        try:
            return candidate.read_text(encoding="utf-8").strip()
        except UnicodeDecodeError:
            try:
                return candidate.read_text(encoding="gb18030").strip()
            except UnicodeDecodeError:
                continue
    return ""


def copy_sidecar_cover(path: Path, cover_dir: Path) -> str:
    candidates: list[Path] = []
    for extension in IMAGE_EXTENSIONS:
        candidates.append(path.with_suffix(extension))
    for file_name in COVER_FILE_NAMES:
        for extension in IMAGE_EXTENSIONS:
            candidates.append(path.parent / f"{file_name}{extension}")

    for candidate in candidates:
        if not candidate.exists() or not candidate.is_file():
            continue
        suffix = candidate.suffix.lower()
        cover_path = cover_dir / f"{stable_track_id(path)}{suffix}"
        if not cover_path.exists() or cover_path.stat().st_mtime < candidate.stat().st_mtime:
            cover_path.write_bytes(candidate.read_bytes())
        return str(cover_path)
    return ""


def embedded_cover_bytes(tags: Any) -> bytes:
    try:
        for key in tags.keys():
            value = tags[key]
            if key.startswith("APIC") and hasattr(value, "data"):
                return bytes(value.data)
            if key == "covr":
                data = value[0] if isinstance(value, list) and value else value
                return bytes(data)
            if key.startswith("metadata_block_picture") and hasattr(value, "data"):
                return bytes(value.data)
    except Exception:
        return b""
    return b""


def normalized_key(value: str) -> str:
    cleaned = re.sub(r"\s+", "-", value.strip().lower())
    return re.sub(r"[^a-z0-9\u4e00-\u9fff_-]", "", cleaned) or "unknown"


def guess_media_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def ranged_file_response(path: Path, request: Request) -> Response:
    range_header = request.headers.get("range")
    media_type = guess_media_type(path)
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


def find_radio_episode(episode_id: str):
    with db() as conn:
        return conn.execute(
            "SELECT * FROM music_radio_episodes WHERE id = ?",
            (episode_id,),
        ).fetchone()


def parse_json_list(value: str | None) -> list:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def stream_radio_audio_path(value: Any, request: Request, missing_message: str) -> Response:
    audio_path = Path(str(value or ""))
    output_root = Path(get_settings().radio_output_dir).resolve()
    try:
        audio_path.resolve().relative_to(output_root)
    except (ValueError, RuntimeError):
        return JSONResponse(
            status_code=403,
            content={"status": "error", "message": "电台音频路径不在允许目录。"},
        )
    if not audio_path.exists() or not audio_path.is_file():
        return not_found(missing_message)
    return ranged_file_response(audio_path, request)


def not_found(message: str) -> JSONResponse:
    return JSONResponse(status_code=404, content={"status": "error", "message": message})
