from __future__ import annotations

import asyncio
import importlib.util
import inspect
import json
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .config import get_settings, load_env_files
from .db import db
from .repository import row_to_dict

router = APIRouter(prefix="/v1/music/api/admin/metadata", tags=["metadata-scrape"])


class ScrapePreviewRequest(BaseModel):
    trackId: str | None = None
    title: str = ""
    artist: str = ""
    album: str = ""
    providers: list[str] = Field(default_factory=list)
    limit: int = Field(default=5, ge=1, le=20)


class ScrapeMissingRequest(BaseModel):
    providers: list[str] = Field(default_factory=list)
    limit: int = Field(default=20, ge=1, le=200)
    candidateLimit: int = Field(default=3, ge=1, le=10)
    missing: list[str] = Field(default_factory=list)


class ScrapeApplyRequest(BaseModel):
    trackId: str = Field(min_length=1)
    candidate: dict[str, Any]
    fields: list[str] = Field(default_factory=list)


class ScrapeJobCreateRequest(BaseModel):
    providers: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    trackIds: list[str] = Field(default_factory=list)
    limit: int = Field(default=50, ge=1, le=1000)
    candidateLimit: int = Field(default=3, ge=1, le=10)
    autoApply: bool = False
    minConfidence: float = Field(default=0.92, ge=0, le=1)
    applyFields: list[str] = Field(default_factory=list)
    scanAfterComplete: bool = False


class ScrapeJobApplyRequest(BaseModel):
    candidateIds: list[str] = Field(default_factory=list)
    minConfidence: float = Field(default=0.92, ge=0, le=1)
    fields: list[str] = Field(default_factory=list)


@router.get("/scrape/status")
def scrape_status() -> dict[str, Any]:
    providers = []
    for path in available_provider_paths():
        provider = path.stem.removesuffix("_metadata")
        providers.append(
            {
                "provider": provider,
                "module": path.stem,
                "configured": True,
                "path": str(path),
            }
        )
    return {
        "status": "ready",
        "pluginDirs": metadata_plugin_dirs(),
        "providers": providers,
        "message": "自用元数据刮削接口已就绪；真实 provider 位于 git ignored private_plugins。",
    }


@router.post("/scrape/preview")
async def scrape_preview(request: ScrapePreviewRequest) -> dict[str, Any]:
    track = load_track_context(request.trackId) if request.trackId else {}
    query = {
        "trackId": request.trackId or "",
        "title": request.title.strip() or track.get("title", "") or track.get("file_name", ""),
        "artist": request.artist.strip() or track.get("artist", ""),
        "album": request.album.strip() or track.get("album", ""),
        "sourcePath": track.get("source_path", ""),
        "limit": request.limit,
    }
    candidates = await collect_candidates(query, request.providers, request.limit)
    return {
        "status": "completed",
        "query": query,
        "count": len(candidates),
        "candidates": candidates,
    }


@router.post("/scrape/missing")
async def scrape_missing(request: ScrapeMissingRequest) -> dict[str, Any]:
    filters = request.missing or ["lyrics", "cover", "artist", "album"]
    rows = rows_missing_metadata(filters, request.limit)
    items = []
    for row in rows:
        track = row_to_dict(row)
        query = {
            "trackId": track["id"],
            "title": track["title"] or track["file_name"],
            "artist": track["artist"],
            "album": track["album"],
            "sourcePath": track["source_path"],
            "limit": request.candidateLimit,
        }
        candidates = await collect_candidates(query, request.providers, request.candidateLimit)
        items.append(
            {
                "trackId": track["id"],
                "title": query["title"],
                "artist": query["artist"],
                "album": query["album"],
                "missing": missing_fields(track),
                "candidates": candidates,
            }
        )
    return {"status": "completed", "count": len(items), "items": items}


@router.post("/scrape/apply")
async def scrape_apply(request: ScrapeApplyRequest) -> dict[str, Any]:
    result = await apply_candidate_to_track(
        request.trackId,
        request.candidate,
        request.fields,
    )
    if not result["ok"]:
        return result
    return result


@router.post("/scrape/jobs")
def create_scrape_job(request: ScrapeJobCreateRequest) -> dict[str, Any]:
    job_id = uuid.uuid4().hex
    filters = request.missing or ["lyrics", "cover", "artist", "album"]
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_metadata_scrape_jobs (
                id, status, mode, providers_json, missing_json, apply_fields_json,
                limit_count, candidate_limit, auto_apply, min_confidence
            ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                f"track_ids:{','.join(request.trackIds)}" if request.trackIds else "missing",
                json.dumps(request.providers, ensure_ascii=False),
                json.dumps(filters, ensure_ascii=False),
                json.dumps(request.applyFields, ensure_ascii=False),
                request.limit,
                request.candidateLimit,
                1 if request.autoApply else 0,
                request.minConfidence,
            ),
        )
    thread = threading.Thread(
        target=run_scrape_job_thread,
        args=(job_id, request.scanAfterComplete),
        daemon=True,
    )
    thread.start()
    return {
        "status": "queued",
        "jobId": job_id,
        "message": "元数据刮削任务已加入后台队列。",
    }


@router.get("/scrape/jobs")
def list_scrape_jobs(limit: int = Query(default=20, ge=1, le=100)) -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM music_metadata_scrape_jobs
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return {
        "status": "ok",
        "count": len(rows),
        "jobs": [job_row_to_public(row_to_dict(row)) for row in rows],
    }


@router.get("/scrape/jobs/{job_id}")
def get_scrape_job(job_id: str) -> dict[str, Any]:
    with db() as conn:
        job = conn.execute(
            "SELECT * FROM music_metadata_scrape_jobs WHERE id = ?",
            (job_id,),
        ).fetchone()
        candidate_rows = conn.execute(
            """
            SELECT c.*, t.title AS track_title, t.artist AS track_artist, t.album AS track_album
            FROM music_metadata_scrape_candidates c
            LEFT JOIN music_tracks t ON t.id = c.track_id
            WHERE c.job_id = ?
            ORDER BY c.created_at ASC, c.confidence DESC
            """,
            (job_id,),
        ).fetchall()
    if job is None:
        return {"status": "missing", "ok": False, "message": "没有找到这个刮削任务。"}
    return {
        "status": "ok",
        "job": job_row_to_public(row_to_dict(job)),
        "candidates": [candidate_row_to_public(row_to_dict(row)) for row in candidate_rows],
    }


@router.post("/scrape/jobs/{job_id}/apply")
async def apply_scrape_job_candidates(job_id: str, request: ScrapeJobApplyRequest) -> dict[str, Any]:
    clauses = ["job_id = ?", "status = 'candidate'", "confidence >= ?"]
    values: list[Any] = [job_id, request.minConfidence]
    if request.candidateIds:
        placeholders = ",".join("?" for _ in request.candidateIds)
        clauses.append(f"id IN ({placeholders})")
        values.extend(request.candidateIds)
    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM music_metadata_scrape_candidates
            WHERE {" AND ".join(clauses)}
            ORDER BY confidence DESC, created_at ASC
            """,
            values,
        ).fetchall()

    applied = 0
    errors = 0
    items = []
    for row in rows:
        candidate_row = row_to_dict(row)
        candidate = json_loads_dict(candidate_row.get("candidate_json"))
        result = await apply_candidate_to_track(
            candidate_row["track_id"],
            candidate,
            request.fields,
        )
        status = "applied" if result.get("ok") else "error"
        if result.get("ok"):
            applied += 1
        else:
            errors += 1
        with db() as conn:
            conn.execute(
                """
                UPDATE music_metadata_scrape_candidates
                SET status = ?, applied_fields_json = ?, error = ?, updated_at = current_timestamp
                WHERE id = ?
                """,
                (
                    status,
                    json.dumps(result.get("appliedFields", []), ensure_ascii=False),
                    result.get("message", ""),
                    candidate_row["id"],
                ),
            )
        items.append({"candidateId": candidate_row["id"], "status": status, "result": result})

    with db() as conn:
        conn.execute(
            """
            UPDATE music_metadata_scrape_jobs
            SET applied_count = applied_count + ?,
                error_count = error_count + ?,
                updated_at = current_timestamp
            WHERE id = ?
            """,
            (applied, errors, job_id),
        )
    return {"status": "completed", "applied": applied, "errors": errors, "items": items}


async def apply_candidate_to_track(
    track_id: str,
    candidate_payload: dict[str, Any],
    fields_payload: list[str],
) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM music_tracks WHERE id = ?",
            (track_id,),
        ).fetchone()
    if row is None:
        return {"status": "missing", "ok": False, "message": "没有找到这首歌。"}

    candidate = normalize_candidate(candidate_payload, provider=str(candidate_payload.get("provider") or "manual"))
    fields = fields_payload or suggested_apply_fields(candidate)
    updates: list[str] = []
    values: list[Any] = []
    field_map = {
        "title": "title",
        "artist": "artist",
        "album": "album",
        "albumArtist": "album_artist",
        "year": "year",
        "genre": "genre",
        "lyrics": "lyrics",
    }
    for field in fields:
        column = field_map.get(field)
        if not column:
            continue
        value = candidate.get(field)
        if value is None:
            continue
        updates.append(f"{column} = ?")
        values.append(str(value).strip())

    cover_url = str(candidate.get("coverUrl") or "").strip()
    cover_path = ""
    if "cover" in fields and cover_url:
        cover_path = await download_cover_for_track(track_id, cover_url)
        if cover_path:
            updates.append("cover_path = ?")
            values.append(cover_path)

    if updates:
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

    with db() as conn:
        updated = conn.execute(
            "SELECT * FROM music_tracks WHERE id = ?",
            (track_id,),
        ).fetchone()
    return {
        "status": "applied",
        "ok": True,
        "track": track_row_to_public(row_to_dict(updated)),
        "appliedFields": fields,
        "coverPath": cover_path,
    }


def run_scrape_job_thread(job_id: str, scan_after_complete: bool = False) -> None:
    try:
        asyncio.run(run_scrape_job(job_id))
    except Exception as error:  # noqa: BLE001 - background task should persist error state
        with db() as conn:
            conn.execute(
                """
                UPDATE music_metadata_scrape_jobs
                SET status = 'error',
                    last_error = ?,
                    error_count = error_count + 1,
                    updated_at = current_timestamp,
                    finished_at = current_timestamp
                WHERE id = ?
                """,
                (str(error), job_id),
            )
    finally:
        if scan_after_complete:
            run_incremental_scan_after_scrape(job_id)


def run_incremental_scan_after_scrape(job_id: str) -> None:
    try:
        from .local_music import scan_local_music_library

        scan_result = scan_local_music_library(incremental=True)
        if scan_result.get("status") not in {"scanned", "completed"}:
            with db() as conn:
                conn.execute(
                    """
                    UPDATE music_metadata_scrape_jobs
                    SET last_error = ?,
                        updated_at = current_timestamp
                    WHERE id = ?
                    """,
                    (
                        f"刮削后增量扫描未完成：{scan_result.get('status')}",
                        job_id,
                    ),
                )
    except Exception as error:  # noqa: BLE001 - keep scrape result, record scan failure
        with db() as conn:
            conn.execute(
                """
                UPDATE music_metadata_scrape_jobs
                SET last_error = ?,
                    error_count = error_count + 1,
                    updated_at = current_timestamp
                WHERE id = ?
                """,
                (f"刮削后增量扫描失败：{error}", job_id),
            )


async def run_scrape_job(job_id: str) -> None:
    with db() as conn:
        job = conn.execute(
            "SELECT * FROM music_metadata_scrape_jobs WHERE id = ?",
            (job_id,),
        ).fetchone()
    if job is None:
        return

    job_data = row_to_dict(job)
    providers = json_loads_list(job_data.get("providers_json"))
    filters = json_loads_list(job_data.get("missing_json")) or ["lyrics", "cover", "artist", "album"]
    apply_fields = json_loads_list(job_data.get("apply_fields_json"))
    candidate_limit = int(job_data.get("candidate_limit") or 3)
    auto_apply = bool(job_data.get("auto_apply"))
    min_confidence = float(job_data.get("min_confidence") or 0.92)
    mode = str(job_data.get("mode") or "")
    rows = rows_for_scrape_job(mode, filters, int(job_data.get("limit_count") or 50))

    with db() as conn:
        conn.execute(
            """
            UPDATE music_metadata_scrape_jobs
            SET status = 'running', updated_at = current_timestamp
            WHERE id = ?
            """,
            (job_id,),
        )

    for row in rows:
        track = row_to_dict(row)
        query = {
            "trackId": track["id"],
            "title": track["title"] or track["file_name"],
            "artist": track["artist"],
            "album": track["album"],
            "sourcePath": track["source_path"],
            "limit": candidate_limit,
        }
        try:
            candidates = await collect_candidates(query, providers, candidate_limit)
            valid_candidates = [item for item in candidates if item.get("status") != "error"]
            error_candidates = [item for item in candidates if item.get("status") == "error"]
            candidate_ids = save_job_candidates(job_id, track["id"], candidates)
            applied = 0
            if auto_apply and valid_candidates:
                best = valid_candidates[0]
                if float(best.get("confidence") or 0) >= min_confidence:
                    result = await apply_candidate_to_track(track["id"], best, apply_fields)
                    candidate_status = "applied" if result.get("ok") else "error"
                    if result.get("ok"):
                        applied = 1
                    update_candidate_apply_state(
                        candidate_ids[0],
                        candidate_status,
                        result.get("appliedFields", []),
                        result.get("message", ""),
                    )
            with db() as conn:
                conn.execute(
                    """
                    UPDATE music_metadata_scrape_jobs
                    SET processed_count = processed_count + 1,
                        matched_count = matched_count + ?,
                        applied_count = applied_count + ?,
                        error_count = error_count + ?,
                        updated_at = current_timestamp
                    WHERE id = ?
                    """,
                    (1 if valid_candidates else 0, applied, len(error_candidates), job_id),
                )
        except Exception as error:  # noqa: BLE001 - one bad track must not fail the whole batch
            with db() as conn:
                conn.execute(
                    """
                    UPDATE music_metadata_scrape_jobs
                    SET processed_count = processed_count + 1,
                        error_count = error_count + 1,
                        last_error = ?,
                        updated_at = current_timestamp
                    WHERE id = ?
                    """,
                    (str(error), job_id),
                )

    with db() as conn:
        final_status = "completed"
        conn.execute(
            """
            UPDATE music_metadata_scrape_jobs
            SET status = ?,
                updated_at = current_timestamp,
                finished_at = current_timestamp
            WHERE id = ?
            """,
            (final_status, job_id),
        )


def metadata_plugin_dirs() -> list[str]:
    return [
        str(Path(value.strip()).expanduser())
        for value in get_settings().metadata_plugin_dirs.split(",")
        if value.strip()
    ]


def available_provider_paths() -> list[Path]:
    paths: list[Path] = []
    for directory in metadata_plugin_dirs():
        root = Path(directory)
        if not root.exists():
            continue
        paths.extend(sorted(root.glob("*_metadata.py")))
    return paths


def find_provider_path(provider: str) -> Path | None:
    expected = f"{provider}_metadata.py"
    for directory in metadata_plugin_dirs():
        path = Path(directory) / expected
        if path.exists() and path.is_file():
            return path
    return None


def load_plugin(path: Path, provider: str) -> Any:
    module_name = f"personal_music_metadata_{provider}_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载私有元数据插件：{path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def collect_candidates(
    query: dict[str, Any],
    providers: list[str],
    limit: int,
) -> list[dict[str, Any]]:
    provider_names = providers or [path.stem.removesuffix("_metadata") for path in available_provider_paths()]
    candidates: list[dict[str, Any]] = []
    for provider in provider_names:
        path = find_provider_path(provider)
        if path is None:
            candidates.append(
                {
                    "provider": provider,
                    "status": "error",
                    "error": f"未找到私有插件 {provider}_metadata.py。",
                }
            )
            continue
        try:
            plugin = load_plugin(path, provider)
            search_fn = getattr(plugin, "search", None)
            if search_fn is None:
                raise RuntimeError(f"{provider}_metadata.py 缺少 search(config) 函数。")
            config = {
                "query": query,
                "limit": limit,
                "env": metadata_env(),
            }
            result = search_fn(config)
            if inspect.isawaitable(result):
                result = await result
            if not isinstance(result, list):
                raise RuntimeError("search(config) 必须返回 list[dict]。")
            candidates.extend(normalize_candidate(item, provider) for item in result[:limit])
        except Exception as error:  # noqa: BLE001 - provider failures should stay isolated
            candidates.append(
                {
                    "provider": provider,
                    "status": "error",
                    "error": str(error),
                }
            )
    scored = [item for item in candidates if item.get("status") != "error"]
    errors = [item for item in candidates if item.get("status") == "error"]
    return sorted(scored, key=lambda item: item.get("confidence", 0), reverse=True)[:limit] + errors


def metadata_env() -> dict[str, str]:
    prefixes = (
        "NETEASE_",
        "QQ_",
        "QQMUSIC_",
        "KUGOU_",
        "KUWO_",
        "SQMUSIC_",
        "MUSIC_METADATA_",
    )
    file_values, _ = load_env_files()
    merged = {
        key: value
        for key, value in file_values.items()
        if key.startswith(prefixes)
    }
    merged.update(
        {
            key: value
            for key, value in os.environ.items()
            if key.startswith(prefixes)
        }
    )
    return merged


def normalize_candidate(raw: dict[str, Any], provider: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raw = {}
    title = first_text(raw, "title", "name", "trackName", "track_name")
    artist = first_text(raw, "artist", "artistName", "artist_name")
    album = first_text(raw, "album", "albumName", "album_name")
    candidate = {
        "provider": str(raw.get("provider") or provider),
        "sourceId": first_text(raw, "sourceId", "source_id", "id"),
        "title": title,
        "artist": artist,
        "album": album,
        "albumArtist": first_text(raw, "albumArtist", "album_artist") or artist,
        "year": first_text(raw, "year", "date"),
        "genre": first_text(raw, "genre"),
        "lyrics": first_text(raw, "lyrics", "lyric"),
        "coverUrl": first_text(raw, "coverUrl", "cover_url", "picUrl", "albumPicUrl"),
        "confidence": float_or_default(raw.get("confidence"), 0.75),
        "raw": sanitize_raw(raw.get("raw") if isinstance(raw.get("raw"), dict) else raw),
    }
    candidate["matchKey"] = normalized_track_key(title, artist)
    return candidate


def suggested_apply_fields(candidate: dict[str, Any]) -> list[str]:
    fields = []
    for field in ("title", "artist", "album", "albumArtist", "year", "genre", "lyrics"):
        if str(candidate.get(field) or "").strip():
            fields.append(field)
    if str(candidate.get("coverUrl") or "").strip():
        fields.append("cover")
    return fields


async def download_cover_for_track(track_id: str, url: str) -> str:
    if not url.startswith(("http://", "https://")):
        return ""
    cover_dir = Path(get_settings().music_cover_dir)
    cover_dir.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        response = await client.get(url)
    if response.status_code >= 400 or not response.content:
        return ""
    content_type = response.headers.get("content-type", "")
    suffix = ".jpg"
    if "png" in content_type:
        suffix = ".png"
    elif "webp" in content_type:
        suffix = ".webp"
    path = cover_dir / f"{track_id}-scraped{suffix}"
    path.write_bytes(response.content)
    return str(path)


def load_track_context(track_id: str | None) -> dict[str, Any]:
    if not track_id:
        return {}
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM music_tracks WHERE id = ?",
            (track_id,),
        ).fetchone()
    return row_to_dict(row) if row else {}


def rows_missing_metadata(fields: list[str], limit: int) -> list[Any]:
    clauses = []
    if "lyrics" in fields:
        clauses.append("lyrics = ''")
    if "cover" in fields:
        clauses.append("cover_path = ''")
    if "artist" in fields:
        clauses.append("(artist = '' OR artist = '未知歌手')")
    if "album" in fields:
        clauses.append("(album = '' OR album = '未知专辑')")
    where = " OR ".join(clauses) or "1 = 1"
    with db() as conn:
        return conn.execute(
            f"""
            SELECT *
            FROM music_tracks
            WHERE {where}
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()


def rows_for_scrape_job(mode: str, fields: list[str], limit: int) -> list[Any]:
    if mode.startswith("track_ids:"):
        ids = [item.strip() for item in mode.removeprefix("track_ids:").split(",") if item.strip()]
        if ids:
            placeholders = ",".join("?" for _ in ids)
            with db() as conn:
                return conn.execute(
                    f"""
                    SELECT *
                    FROM music_tracks
                    WHERE id IN ({placeholders})
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (*ids, limit),
                ).fetchall()
    return rows_missing_metadata(fields, limit)


def missing_fields(track: dict[str, Any]) -> list[str]:
    missing = []
    if not track.get("lyrics"):
        missing.append("lyrics")
    if not track.get("cover_path"):
        missing.append("cover")
    if not track.get("artist") or track.get("artist") == "未知歌手":
        missing.append("artist")
    if not track.get("album") or track.get("album") == "未知专辑":
        missing.append("album")
    return missing


def track_row_to_public(row: dict[str, Any]) -> dict[str, Any]:
    cover_url = f"/v1/music/covers/{row['id']}" if row.get("cover_path") else ""
    return {
        "id": row["id"],
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "albumArtist": row["album_artist"],
        "year": row["year"],
        "genre": row["genre"],
        "lyrics": row["lyrics"],
        "coverArtUrl": cover_url,
    }


def save_job_candidates(job_id: str, track_id: str, candidates: list[dict[str, Any]]) -> list[str]:
    candidate_ids: list[str] = []
    with db() as conn:
        for candidate in candidates:
            candidate_id = uuid.uuid4().hex
            candidate_ids.append(candidate_id)
            status = "error" if candidate.get("status") == "error" else "candidate"
            conn.execute(
                """
                INSERT INTO music_metadata_scrape_candidates (
                    id, job_id, track_id, provider, source_id, confidence,
                    candidate_json, status, error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    candidate_id,
                    job_id,
                    track_id,
                    str(candidate.get("provider") or ""),
                    str(candidate.get("sourceId") or ""),
                    float_or_default(candidate.get("confidence"), 0),
                    json.dumps(candidate, ensure_ascii=False),
                    status,
                    str(candidate.get("error") or ""),
                ),
            )
    return candidate_ids


def update_candidate_apply_state(
    candidate_id: str,
    status: str,
    applied_fields: list[str],
    error: str,
) -> None:
    with db() as conn:
        conn.execute(
            """
            UPDATE music_metadata_scrape_candidates
            SET status = ?,
                applied_fields_json = ?,
                error = ?,
                updated_at = current_timestamp
            WHERE id = ?
            """,
            (
                status,
                json.dumps(applied_fields, ensure_ascii=False),
                error,
                candidate_id,
            ),
        )


def job_row_to_public(row: dict[str, Any]) -> dict[str, Any]:
    limit_count = int(row.get("limit_count") or 0)
    processed = int(row.get("processed_count") or 0)
    status = row["status"]
    progress = round(processed / limit_count, 4) if limit_count else 0
    if status in {"completed", "error", "cancelled"}:
        progress = 1 if processed or status == "completed" else progress
    return {
        "id": row["id"],
        "status": status,
        "mode": row["mode"],
        "providers": json_loads_list(row.get("providers_json")),
        "missing": json_loads_list(row.get("missing_json")),
        "applyFields": json_loads_list(row.get("apply_fields_json")),
        "limit": limit_count,
        "candidateLimit": int(row.get("candidate_limit") or 0),
        "autoApply": bool(row.get("auto_apply")),
        "minConfidence": float(row.get("min_confidence") or 0),
        "processedCount": processed,
        "matchedCount": int(row.get("matched_count") or 0),
        "appliedCount": int(row.get("applied_count") or 0),
        "errorCount": int(row.get("error_count") or 0),
        "progress": progress,
        "lastError": row.get("last_error") or "",
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "finishedAt": row.get("finished_at"),
    }


def candidate_row_to_public(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "jobId": row["job_id"],
        "trackId": row["track_id"],
        "trackTitle": row.get("track_title") or "",
        "trackArtist": row.get("track_artist") or "",
        "trackAlbum": row.get("track_album") or "",
        "provider": row.get("provider") or "",
        "sourceId": row.get("source_id") or "",
        "confidence": float(row.get("confidence") or 0),
        "candidate": json_loads_dict(row.get("candidate_json")),
        "status": row.get("status") or "",
        "appliedFields": json_loads_list(row.get("applied_fields_json")),
        "error": row.get("error") or "",
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def json_loads_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(str(value or "[]"))
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def json_loads_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(str(value or "{}"))
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def first_text(raw: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = raw.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def sanitize_raw(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    blocked = ("cookie", "token", "password", "secret", "authorization")
    clean = {}
    for key, item in value.items():
        if any(word in str(key).lower() for word in blocked):
            continue
        clean[str(key)] = item
    return clean


def normalized_track_key(track_name: str, artist_name: str = "") -> str:
    value = f"{track_name}::{artist_name}".lower()
    value = re.sub(r"\s+", "", value)
    value = re.sub(r"[《》<>【】\\[\\]()（）「」\"'“”]", "", value)
    return value


def float_or_default(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
