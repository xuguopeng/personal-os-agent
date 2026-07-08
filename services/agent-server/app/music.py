from __future__ import annotations

import asyncio
import base64
import json
import math
import re
import sqlite3
import subprocess
import uuid
import wave
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from .config import get_settings
from .db import db


RADIO_PERSONA_SKILL_PATH = Path(__file__).resolve().parent / "radio_skills" / "migi-inspired-dj.md"

RADIO_SCHEDULER_TASK: asyncio.Task | None = None
RADIO_SCHEDULER_STATE: dict[str, Any] = {
    "running": False,
    "lastCheckAt": "",
    "lastRunDate": "",
    "lastRunJobId": "",
    "lastMissingDownloadSlot": "",
    "lastMissingDownloadResult": None,
    "lastError": "",
}

DAOLIYU_TOKEN_CACHE: dict[str, Any] = {
    "token": "",
    "baseUrl": "",
    "user": None,
}

DAYPART_FALLBACK_RECOMMENDATIONS: dict[str, list[dict[str, str]]] = {
    "morning": [
        {"title": "晴天", "artist": "周杰伦", "reason": "上午适合中文歌，用熟悉旋律启动一天。"},
        {"title": "稻香", "artist": "周杰伦", "reason": "节奏轻一点，适合把状态慢慢拉起来。"},
        {"title": "喜欢你", "artist": "Beyond", "reason": "这是你明确提到的回听偏好，适合放在上午。"},
    ],
    "afternoon": [
        {"title": "海阔天空", "artist": "Beyond", "reason": "下午需要提神，但不走太吵的方向。"},
        {"title": "光辉岁月", "artist": "Beyond", "reason": "节奏和精神感更明显，适合下午。"},
        {"title": "双截棍", "artist": "周杰伦", "reason": "提高能量，但仍然贴近你的歌手偏好。"},
    ],
    "night": [
        {"title": "后来", "artist": "刘若英", "reason": "这是你明确提到的常回听歌曲，适合晚上安静一点。"},
        {"title": "安静", "artist": "周杰伦", "reason": "晚上更适合低刺激、留白多一点的歌。"},
        {"title": "黑色幽默", "artist": "周杰伦", "reason": "情绪更收，适合夜间独处。"},
    ],
}


def load_radio_persona_skill() -> str:
    try:
        return RADIO_PERSONA_SKILL_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def first_string_value(data: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


# External /v1/music control routes moved to local_music.py and /v1/dj.
# This module now keeps scheduler, radio planning, TTS, and legacy helper internals.

async def fetch_radio_seed_tracks(track_ids: list[str]) -> list[dict[str, Any]]:
    local_tracks = fetch_local_radio_seed_tracks(track_ids)
    if local_tracks:
        return local_tracks[:8]

    return fetch_local_recent_playback_tracks(8)


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
                result = await create_daily_radio_daypart_episode(
                    {
                        "title": f"沐音今日歌单 {now.date().isoformat()}",
                    }
                )
                RADIO_SCHEDULER_STATE["lastRunDate"] = now.date().isoformat()
                RADIO_SCHEDULER_STATE["lastRunJobId"] = result.get("id", "")
                RADIO_SCHEDULER_STATE["lastError"] = ""
            if should_run_missing_download(now):
                result = process_missing_track_queue(settings.missing_download_batch_size)
                RADIO_SCHEDULER_STATE["lastMissingDownloadSlot"] = missing_download_slot(now)
                RADIO_SCHEDULER_STATE["lastMissingDownloadResult"] = result
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


def should_run_missing_download(now: datetime) -> bool:
    settings = get_settings()
    if not settings.missing_download_enabled:
        return False
    if now.hour < settings.missing_download_start_hour or now.hour >= settings.missing_download_end_hour:
        return False
    interval = max(1, settings.missing_download_interval_hours)
    if (now.hour - settings.missing_download_start_hour) % interval != 0:
        return False
    if now.minute > 5:
        return False
    slot = missing_download_slot(now)
    return RADIO_SCHEDULER_STATE.get("lastMissingDownloadSlot") != slot


def missing_download_slot(now: datetime) -> str:
    return f"{now.date().isoformat()}T{now.hour:02d}:00"


def parse_daily_time(value: str) -> time:
    try:
        hour_text, minute_text = value.split(":", 1)
        return time(hour=int(hour_text), minute=int(minute_text))
    except (ValueError, TypeError):
        return time(hour=7, minute=0)


def next_daily_radio_run_at() -> datetime:
    settings = get_settings()
    tz = ZoneInfo(settings.radio_daily_timezone)
    now = datetime.now(tz)
    scheduled = datetime.combine(now.date(), parse_daily_time(settings.radio_daily_time), tz)
    if scheduled <= now or daily_radio_episode_exists(now.date()):
        scheduled += timedelta(days=1)
    return scheduled


def daily_radio_episode_exists(day: date) -> bool:
    day_text = day.isoformat()
    with db() as conn:
        row = conn.execute(
            """
            SELECT id FROM music_radio_episodes
            WHERE title LIKE ?
               OR title LIKE ?
               OR title LIKE ?
            LIMIT 1
            """,
            (
                f"西安天气音乐电台 {day_text}%",
                f"沐音今日歌单 {day_text}%",
                f"%{day_text}%",
            ),
        ).fetchone()
    return row is not None


def latest_daily_radio_mix_episode(day: date) -> dict[str, Any] | None:
    day_text = day.isoformat()
    with db() as conn:
        row = conn.execute(
            """
            SELECT * FROM music_radio_episodes
            WHERE (episode_date = ? OR title LIKE ?)
              AND generator LIKE '%playlist-segments%'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (day_text, f"%{day_text}%"),
        ).fetchone()
    return radio_episode_row_to_dict(row) if row else None


def build_radio_playback_flow(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flow: list[dict[str, Any]] = []
    for index, segment in enumerate(segments):
        if not isinstance(segment, dict):
            continue
        item = dict(segment)
        item["flowIndex"] = index
        item["kind"] = "music" if str(item.get("type") or "") == "track" else "spoken"
        flow.append(item)
    return flow


async def create_daily_radio_daypart_episode(payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    now = datetime.now(ZoneInfo(settings.radio_daily_timezone))
    today = now.date()
    title = str(payload.get("title") or f"沐音今日歌单 {today.isoformat()}").strip()
    force_regenerate = bool(payload.get("force") or payload.get("regenerate"))
    force_mock_script = bool(payload.get("mockScript"))
    force_mock_tts = bool(payload.get("mockTts") or payload.get("mockAudio"))
    if not force_regenerate:
        existing_episode = latest_daily_radio_mix_episode(today)
        if existing_episode:
            return {
                "status": "cached",
                "episode": existing_episode,
                "message": "今天的全天歌单已经生成过，已直接复用。",
                "date": today.isoformat(),
            }

    weather = await fetch_radio_weather()
    recent_tracks = await fetch_recent_playback_tracks(settings.radio_recent_limit)
    local_pool = fetch_local_recent_playback_tracks(max(settings.radio_recent_limit, 60))
    context_tracks = dedupe_radio_tracks([*recent_tracks, *local_pool])
    if not context_tracks:
        context_tracks = await fetch_radio_seed_tracks([])
    context_tracks = context_tracks[:60]

    script_plan = await generate_daypart_radio_script_plan(
        title=title,
        today=today,
        weather=weather,
        recent_tracks=context_tracks,
        force_mock=force_mock_script,
    )
    recommendations: list[dict[str, Any]] = []
    for stage in script_plan["stages"]:
        recommendations.extend(stage.get("tracks") or [])
    selected_tracks = await ensure_radio_mix_tracks_available(recommendations, 9, allow_download=False)
    if len(selected_tracks) < 9:
        selected_tracks = dedupe_radio_tracks(
            [
                *selected_tracks,
                *[track for track in context_tracks if str(track.get("sourcePath") or "").strip()],
            ]
        )[:9]
    if not selected_tracks:
        return {
            "status": "error",
            "message": "没有可用于合并的本地音乐文件。请先扫描曲库或下载歌曲。",
        }

    stages = attach_tracks_to_daypart_stages(script_plan["stages"], selected_tracks)
    script = json.dumps(
        {
            "title": title,
            "mode": "dayparts",
            "date": today.isoformat(),
            "weather": weather,
            "stages": stages,
            "outro": script_plan.get("outro", ""),
        },
        ensure_ascii=False,
        indent=2,
    )
    selected_track_ids = [str(track.get("id") or "") for track in selected_tracks if track.get("id")]
    job_id = uuid.uuid4().hex
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_radio_jobs (
                id, title, status, mode, track_ids_json, script
            ) VALUES (?, ?, 'running', 'dayparts', ?, ?)
            """,
            (job_id, title, json.dumps(selected_track_ids, ensure_ascii=False), script),
        )

    try:
        episode = await generate_radio_daypart_sequence_episode(
            job_id=job_id,
            title=title,
            track_ids=selected_track_ids,
            script=script,
            stages=stages,
            outro_script=str(script_plan.get("outro") or ""),
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
            "message": "全天三阶段私人电台已生成。",
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
    return fetch_local_recent_playback_tracks(limit)


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
    if force_mock or not resolved_llm_key():
        return fallback
    prompt = build_minimax_radio_prompt(title, today, weather, recent_tracks, track_count)
    try:
        result = await generate_llm_json(prompt)
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
        "generator": f"{get_settings().llm_provider}-chat",
    }


def build_minimax_radio_prompt(
    title: str,
    today: date,
    weather: dict[str, Any],
    recent_tracks: list[dict[str, Any]],
    track_count: int,
) -> str:
    persona_skill = load_radio_persona_skill()
    track_lines = []
    for index, track in enumerate(recent_tracks[:20], start=1):
        track_lines.append(
            f"{index}. {first_string_value(track, 'title', 'name') or '未知歌曲'} - "
            f"{radio_artist_name(track)} - {radio_album_name(track) or '未知专辑'}"
        )
    weather_line = build_weather_intro(weather) or "天气暂时未知。"
    return (
        "你是一个私人音乐电台主持人。说话方式遵循下方电台人格技能，但不要自称原作角色。\n"
        "电台人格技能：\n"
        + (persona_skill or "- 使用克制、理性、私人化的中文 DJ 口吻。\n")
        + "\n"
        "请根据日期、天气和我的最近听歌记录，生成一期自然的中文电台脚本。\n"
        "关键要求：\n"
        f"- 日期：{today.isoformat()}\n"
        f"- 标题：{title}\n"
        f"- 天气：{weather_line}\n"
        f"- 选择 {track_count} 首歌，优先从最近听歌记录里选；如果推荐新歌，必须给出歌名和歌手。\n"
        "- 人格只影响说话方式；选歌仍必须基于最近听歌记录、天气和日期，不要因为人格编造偏好。\n"
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


async def generate_daypart_radio_script_plan(
    *,
    title: str,
    today: date,
    weather: dict[str, Any],
    recent_tracks: list[dict[str, Any]],
    force_mock: bool = False,
) -> dict[str, Any]:
    fallback = build_fallback_daypart_radio_script_plan(title, today, weather, recent_tracks)
    if force_mock or not resolved_llm_key():
        return fallback
    prompt = build_minimax_daypart_radio_prompt(title, today, weather, recent_tracks)
    try:
        result = await generate_llm_json(prompt)
    except Exception:
        return fallback
    stages = result.get("stages") if isinstance(result.get("stages"), list) else []
    clean_stages: list[dict[str, Any]] = []
    for index, fallback_stage in enumerate(fallback["stages"]):
        raw_stage = stages[index] if index < len(stages) and isinstance(stages[index], dict) else {}
        raw_tracks = raw_stage.get("tracks") if isinstance(raw_stage.get("tracks"), list) else []
        clean_tracks: list[dict[str, str]] = []
        for item in raw_tracks[:3]:
            if not isinstance(item, dict):
                continue
            track_title = str(item.get("title") or "").strip()
            if not track_title:
                continue
            clean_tracks.append(
                {
                    "title": track_title,
                    "artist": str(item.get("artist") or "").strip(),
                    "album": str(item.get("album") or "").strip(),
                    "reason": str(item.get("reason") or "").strip(),
                }
            )
        if len(clean_tracks) < 3:
            fallback_tracks = fallback_stage.get("tracks") or []
            for item in fallback_tracks:
                if len(clean_tracks) >= 3:
                    break
                clean_tracks.append(item)
        if len(clean_tracks) < 3:
            seed_tracks = DAYPART_FALLBACK_RECOMMENDATIONS.get(fallback_stage["key"], [])
            for item in seed_tracks:
                if len(clean_tracks) >= 3:
                    break
                if any(
                    normalize_radio_text(track.get("title")) == normalize_radio_text(item.get("title"))
                    and normalize_radio_text(track.get("artist")) == normalize_radio_text(item.get("artist"))
                    for track in clean_tracks
                ):
                    continue
                clean_tracks.append(item)
        clean_stages.append(
            {
                "key": fallback_stage["key"],
                "name": str(raw_stage.get("name") or fallback_stage["name"]).strip(),
                "timeRange": fallback_stage["timeRange"],
                "intro": str(raw_stage.get("intro") or fallback_stage["intro"]).strip(),
                "tracks": clean_tracks[:3],
            }
        )
    return {
        "title": str(result.get("title") or title).strip() or title,
        "stages": clean_stages,
        "outro": str(result.get("outro") or fallback["outro"]).strip(),
        "generator": f"{get_settings().llm_provider}-chat",
    }


def build_minimax_daypart_radio_prompt(
    title: str,
    today: date,
    weather: dict[str, Any],
    recent_tracks: list[dict[str, Any]],
) -> str:
    persona_skill = load_radio_persona_skill()
    weather_line = build_weather_intro(weather) or "天气暂时未知。"
    track_lines = []
    for index, track in enumerate(recent_tracks[:40], start=1):
        track_lines.append(
            f"{index}. {first_string_value(track, 'title', 'name') or '未知歌曲'} - "
            f"{radio_artist_name(track)} - {radio_album_name(track) or '未知专辑'}"
        )
    return (
        "你是沐音 FM 的私人 AI DJ，要为用户生成今天一整天的三阶段歌单。\n"
        "说话方式遵循下方电台人格技能，但不要自称原作角色。\n"
        "电台人格技能：\n"
        + (persona_skill or "- 使用克制、理性、私人化的中文 DJ 口吻。\n")
        + "\n"
        "用户明确偏好：喜欢周杰伦、Beyond、《后来》《喜欢你》；避开太吵、土嗨、喊麦；工作偏纯音乐和节奏强；上午中文歌；下午提神；晚上安静；每阶段 3 首。\n"
        "任务：生成上午、中午/下午、晚上三个阶段，每个阶段 3 首歌，每个阶段都有一段口播。\n"
        "关键要求：\n"
        f"- 日期：{today.isoformat()}\n"
        f"- 标题：{title}\n"
        f"- 天气：{weather_line}\n"
        "- 选歌优先来自最近听歌记录；如果推荐新歌，必须给出歌名和歌手。\n"
        "- 上午：中文歌，像一天的启动；中午/下午：提神，节奏更明显；晚上：安静一点。\n"
        "- 每段 intro 大约 80-160 个中文字符，要像 mmguo/Claudio：有观察、有推荐理由、有自然过渡，不要干巴巴报幕。\n"
        "- 不要出现：测试音频、生成中、推荐理由：、第 1 首、感谢收听。\n"
        "- 只输出 JSON，不要 markdown，不要额外解释。\n"
        "JSON 格式："
        '{"title":"...","stages":[{"key":"morning","name":"上午","intro":"...","tracks":[{"title":"...","artist":"...","album":"可空","reason":"..."}]},{"key":"afternoon","name":"中午/下午","intro":"...","tracks":[...]},{"key":"night","name":"晚上","intro":"...","tracks":[...]}],"outro":"..."}\n'
        "最近听歌记录：\n"
        + "\n".join(track_lines)
    )


def build_fallback_daypart_radio_script_plan(
    title: str,
    today: date,
    weather: dict[str, Any],
    recent_tracks: list[dict[str, Any]],
) -> dict[str, Any]:
    stage_defs = [
        ("morning", "上午", "07:00-11:30", "上午先用中文歌启动。样本还不够厚，我会优先从你最近听过的歌里选，避免太吵，也不把情绪推得过猛。"),
        ("afternoon", "中午/下午", "11:30-18:30", "中午到下午需要一点提神，但不需要土嗨。这里会把节奏抬起来一点，让注意力回到手上。"),
        ("night", "晚上", "18:30-23:30", "晚上不适合再用声音硬推你往前走。这里收一点，偏安静，适合把今天慢慢放下来。"),
    ]
    tracks = dedupe_radio_tracks(recent_tracks)
    stages = []
    for index, (key, name, time_range, intro) in enumerate(stage_defs):
        stage_tracks = tracks[index * 3 : index * 3 + 3]
        recommendations = [
            {
                "title": first_string_value(track, "title", "name") or "未知歌曲",
                "artist": radio_artist_name(track),
                "album": radio_album_name(track),
                "reason": radio_recommend_reason(track_index, first_string_value(track, "title", "name") or "未知歌曲", radio_artist_name(track), weather),
            }
            for track_index, track in enumerate(stage_tracks, start=1)
        ]
        for item in DAYPART_FALLBACK_RECOMMENDATIONS.get(key, []):
            if len(recommendations) >= 3:
                break
            if any(
                normalize_radio_text(track.get("title")) == normalize_radio_text(item.get("title"))
                and normalize_radio_text(track.get("artist")) == normalize_radio_text(item.get("artist"))
                for track in recommendations
            ):
                continue
            recommendations.append(item)
        stages.append(
            {
                "key": key,
                "name": name,
                "timeRange": time_range,
                "intro": intro,
                "tracks": recommendations,
            }
        )
    return {
        "title": title,
        "stages": stages,
        "outro": f"今天的三段歌单先到这里。{build_weather_intro(weather) or ''}如果哪一段更贴近你，明天我会把那个方向的权重加大。",
        "generator": "fallback",
        "date": today.isoformat(),
    }


def attach_tracks_to_daypart_stages(
    stages: list[dict[str, Any]],
    tracks: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    result = []
    cursor = 0
    for stage in stages:
        stage_tracks = tracks[cursor : cursor + 3]
        cursor += 3
        result.append(
            {
                "key": stage.get("key", ""),
                "name": stage.get("name", ""),
                "timeRange": stage.get("timeRange", ""),
                "intro": stage.get("intro", ""),
                "tracks": stage_tracks,
            }
        )
    return result


async def generate_llm_json(prompt: str) -> dict[str, Any]:
    settings = get_settings()
    llm_key = resolved_llm_key()
    if not llm_key:
        raise RuntimeError("文本模型未配置 OPENAI_COMPAT_API_KEY。")
    url = f"{settings.openai_compat_base_url}/responses"
    payload = {
        "model": settings.openai_compat_model,
        "input": [
            {
                "role": "system",
                "content": "你是一个会输出严格 JSON 的中文私人音乐电台文案助手。",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "top_p": 1,
        "max_output_tokens": 1200,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {llm_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if response.status_code >= 400:
        raise RuntimeError(f"{settings.llm_provider} Chat HTTP {response.status_code}: {response.text[:300]}")
    data = response.json()
    content = extract_chat_content(data)
    return parse_json_from_text(content)


async def generate_minimax_chat_json(prompt: str) -> dict[str, Any]:
    return await generate_llm_json(prompt)


def extract_chat_content(data: dict[str, Any]) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    output = data.get("output")
    if isinstance(output, list):
        chunks: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if isinstance(content, list):
                for part in content:
                    if not isinstance(part, dict):
                        continue
                    text = part.get("text") or part.get("value")
                    if isinstance(text, str):
                        chunks.append(text)
            elif isinstance(content, str):
                chunks.append(content)
        if chunks:
            return "\n".join(chunks)
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
    allow_download: bool = True,
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
        enqueue_missing_tracks(missing, source="radio_generation")
    if missing and allow_download:
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


def enqueue_missing_tracks(items: list[dict[str, Any]], source: str) -> int:
    queued = 0
    with db() as conn:
        for item in items:
            title = str(item.get("title") or "").strip()
            artist = str(item.get("artist") or "").strip()
            if not title:
                continue
            conn.execute(
                """
                INSERT INTO music_missing_track_queue (
                    id, title, artist, album, reason, source, status
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
                ON CONFLICT(title, artist) DO UPDATE SET
                    reason = CASE
                        WHEN excluded.reason != '' THEN excluded.reason
                        ELSE music_missing_track_queue.reason
                    END,
                    source = excluded.source,
                    status = CASE
                        WHEN music_missing_track_queue.status IN ('matched', 'download_requested') THEN music_missing_track_queue.status
                        ELSE 'pending'
                    END,
                    updated_at = current_timestamp
                """,
                (
                    uuid.uuid4().hex,
                    title,
                    artist,
                    str(item.get("album") or "").strip(),
                    str(item.get("reason") or "").strip(),
                    source,
                ),
            )
            queued += 1
    return queued


def missing_track_queue_status(limit: int = 100) -> dict[str, Any]:
    with db() as conn:
        counts = [
            dict(row)
            for row in conn.execute(
                """
                SELECT status, count(*) AS count
                FROM music_missing_track_queue
                GROUP BY status
                ORDER BY status
                """
            ).fetchall()
        ]
        rows = conn.execute(
            """
            SELECT *
            FROM music_missing_track_queue
            ORDER BY
                CASE status
                    WHEN 'pending' THEN 0
                    WHEN 'error' THEN 1
                    WHEN 'download_requested' THEN 2
                    WHEN 'matched' THEN 3
                    ELSE 4
                END,
                updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return {
        "status": "ready",
        "counts": counts,
        "items": [missing_queue_row_to_dict(row) for row in rows],
        "scheduler": {
            "enabled": get_settings().missing_download_enabled,
            "startHour": get_settings().missing_download_start_hour,
            "endHour": get_settings().missing_download_end_hour,
            "intervalHours": get_settings().missing_download_interval_hours,
            "batchSize": get_settings().missing_download_batch_size,
        },
    }


def process_missing_track_queue(limit: int | None = None) -> dict[str, Any]:
    settings = get_settings()
    batch_size = limit or settings.missing_download_batch_size
    from .local_music import scan_local_music_library
    from .metadata_scrape import ScrapeJobCreateRequest, create_scrape_job

    initial_scan = scan_local_music_library(incremental=True)
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM music_missing_track_queue
            WHERE status IN ('pending', 'error', 'download_requested')
              AND attempts < 6
            ORDER BY
                CASE status WHEN 'pending' THEN 0 WHEN 'download_requested' THEN 1 ELSE 2 END,
                updated_at ASC
            LIMIT ?
            """,
            (batch_size,),
        ).fetchall()

    processed = 0
    matched = 0
    requested = 0
    errors = 0
    post_download_scan: dict[str, Any] | None = None
    scrape_job: dict[str, Any] | None = None
    for row in rows:
        processed += 1
        title = row["title"]
        artist = row["artist"]
        local = find_local_track_for_radio(title, artist)
        if local:
            update_missing_queue_row(
                row["id"],
                status="matched",
                matched_track_id=str(local.get("id") or ""),
                download_result={},
                error="",
            )
            matched += 1
            continue
        try:
            result = download_recommended_track(title, artist)
            status = "download_requested" if result.get("status") in {"queued", "success"} else "error"
            update_missing_queue_row(
                row["id"],
                status=status,
                matched_track_id="",
                download_result=result,
                error="" if status == "download_requested" else str(result.get("message") or result.get("status") or ""),
            )
            if status == "download_requested":
                requested += 1
            else:
                errors += 1
        except Exception as error:  # noqa: BLE001 - queue should keep going
            update_missing_queue_row(
                row["id"],
                status="error",
                matched_track_id="",
                download_result={},
                error=str(error),
            )
            errors += 1
    if processed:
        post_download_scan = scan_local_music_library(incremental=True)
        scrape_job = create_scrape_job(
            ScrapeJobCreateRequest(
                providers=["qqmusic"],
                missing=["lyrics", "cover"],
                limit=50,
                candidateLimit=3,
                autoApply=True,
                minConfidence=0.92,
                scanAfterComplete=True,
            )
        )
    return {
        "status": "completed",
        "processed": processed,
        "matched": matched,
        "downloadRequested": requested,
        "errors": errors,
        "initialIncrementalScan": summarize_scan_result(initial_scan),
        "postDownloadIncrementalScan": summarize_scan_result(post_download_scan),
        "metadataScrapeJob": scrape_job,
        "postScrapeIncrementalScan": (
            {
                "status": "scheduled",
                "jobId": scrape_job.get("jobId") or scrape_job.get("id") or "",
                "message": "歌词/封面刮削任务完成后会自动再跑一次增量扫描。",
            }
            if scrape_job
            else None
        ),
    }


def summarize_scan_result(scan_result: dict[str, Any] | None) -> dict[str, Any] | None:
    if not scan_result:
        return None
    return {
        "status": scan_result.get("status", ""),
        "mode": scan_result.get("mode", ""),
        "scanned": scan_result.get("scanned", 0),
        "imported": scan_result.get("imported", 0),
        "skipped": scan_result.get("skipped", 0),
        "errorCount": scan_result.get("errorCount", 0),
        "durationSeconds": scan_result.get("durationSeconds", 0),
    }


def update_missing_queue_row(
    row_id: str,
    *,
    status: str,
    matched_track_id: str,
    download_result: dict[str, Any],
    error: str,
) -> None:
    with db() as conn:
        conn.execute(
            """
            UPDATE music_missing_track_queue
            SET status = ?,
                attempts = attempts + 1,
                matched_track_id = ?,
                download_result_json = ?,
                last_error = ?,
                last_attempt_at = current_timestamp,
                updated_at = current_timestamp
            WHERE id = ?
            """,
            (
                status,
                matched_track_id,
                json.dumps(download_result, ensure_ascii=False),
                error,
                row_id,
            ),
        )


def missing_queue_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "reason": row["reason"],
        "source": row["source"],
        "status": row["status"],
        "attempts": row["attempts"],
        "matchedTrackId": row["matched_track_id"],
        "downloadResult": json.loads(row["download_result_json"] or "{}"),
        "lastError": row["last_error"],
        "lastAttemptAt": row["last_attempt_at"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def find_local_track_for_radio(title: str, artist: str) -> dict[str, Any] | None:
    normalized_title = normalize_radio_text(title)
    normalized_artist = normalize_radio_text(artist)
    if not normalized_title:
        return None
    like_title = f"%{title.strip()}%"
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM music_tracks
            WHERE title LIKE ?
               OR file_name LIKE ?
               OR source_path LIKE ?
               OR (? != '' AND artist LIKE ?)
            ORDER BY
                CASE
                    WHEN title = ? THEN 0
                    WHEN file_name = ? THEN 1
                    WHEN title LIKE ? THEN 2
                    WHEN file_name LIKE ? THEN 3
                    ELSE 4
                END,
                play_count DESC,
                updated_at DESC
            LIMIT 80
            """
            ,
            (
                like_title,
                like_title,
                like_title,
                artist.strip(),
                f"%{artist.strip()}%",
                title.strip(),
                title.strip(),
                like_title,
                like_title,
            ),
        ).fetchall()
        if not rows:
            rows = conn.execute(
                """
                SELECT *
                FROM music_tracks
                WHERE title != '' OR file_name != ''
                ORDER BY play_count DESC, updated_at DESC
                LIMIT 2000
                """
            ).fetchall()
    best_row = None
    best_score = 0.0
    for row in rows:
        row_file_name = row["file_name"] or Path(row["source_path"]).stem
        row_source = Path(row["source_path"]).stem
        row_title = normalize_radio_text(row["title"] or row_file_name or row_source)
        row_file_title = normalize_radio_text(row_file_name)
        row_source_title = normalize_radio_text(row_source)
        row_artist = normalize_radio_text(row["artist"])
        score = 0.0
        if normalized_title and normalized_title in {row_title, row_file_title, row_source_title}:
            score += 0.75
        elif normalized_title and (
            normalized_title in row_title
            or row_title in normalized_title
            or normalized_title in row_file_title
            or normalized_title in row_source_title
        ):
            file_name_match = normalized_title in row_file_title or normalized_title in row_source_title
            score += 0.72 if file_name_match else 0.45
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


def episode_date_from_title(title: str) -> str:
    match = re.search(r"\d{4}-\d{2}-\d{2}", title)
    return match.group(0) if match else ""


def episode_date_from_script(script: str, fallback_title: str = "") -> str:
    try:
        data = json.loads(script)
    except json.JSONDecodeError:
        return episode_date_from_title(fallback_title)
    value = str(data.get("date") or "").strip() if isinstance(data, dict) else ""
    return value if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) else episode_date_from_title(fallback_title)


def radio_audio_basename(day_text: str) -> str:
    return f"migi-{day_text}" if day_text else f"migi-{datetime.now().date().isoformat()}"


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
    if resolved_tts_provider() != "mock":
        audio_format = "mp3"
        generator = f"{resolved_tts_provider()}-tts"
        audio_path = output_dir / f"{episode_id}.mp3"
        outro_audio_path = output_dir / f"{episode_id}-outro.mp3"
        audio_bytes = await generate_tts_audio(intro_text)
        audio_path.write_bytes(audio_bytes)
        if outro_text:
            outro_audio_path.write_bytes(await generate_tts_audio(outro_text))
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
        episode_date = episode_date_from_title(title)
        conn.execute(
            """
            INSERT INTO music_radio_episodes (
                id, episode_date, title, summary, script, audio_path, outro_audio_path,
                audio_format, duration_seconds, outro_duration_seconds,
                source_track_ids_json, segments_json, generator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                episode_id,
                episode_date,
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

    tts_provider = "mock" if force_mock_tts else resolved_tts_provider()
    generator = f"{settings.llm_provider}-chat+{tts_provider}-tts+ffmpeg"
    if tts_provider != "mock":
        intro_path.write_bytes(await generate_tts_audio(intro_script))
        outro_path.write_bytes(await generate_tts_audio(outro_script))
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

    mix_audio_files([intro_path, *music_paths, outro_path], final_path)
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
        "playbackFlow": build_radio_playback_flow(segments),
        "generator": generator,
        "streamUrl": f"/v1/music/radio/episodes/{episode_id}/stream",
        "outroStreamUrl": f"/v1/music/radio/episodes/{episode_id}/outro/stream",
    }
    with db() as conn:
        episode_date = episode_date_from_title(title)
        conn.execute(
            """
            INSERT INTO music_radio_episodes (
                id, episode_date, title, summary, script, audio_path, outro_audio_path,
                audio_format, duration_seconds, outro_duration_seconds,
                source_track_ids_json, segments_json, generator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                episode_id,
                episode_date,
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


async def generate_radio_daypart_mix_episode(
    *,
    job_id: str,
    title: str,
    track_ids: list[str],
    script: str,
    stages: list[dict[str, Any]],
    outro_script: str,
    force_mock_tts: bool = False,
) -> dict[str, Any]:
    settings = get_settings()
    output_dir = Path(settings.radio_output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    episode_id = uuid.uuid4().hex
    final_path = output_dir / f"{episode_id}-dayparts-mix.mp3"

    generator = f"{settings.llm_provider}-chat+{resolved_tts_provider()}-tts+ffmpeg-mix+dayparts"
    audio_inputs: list[Path] = []
    segments: list[dict[str, Any]] = []
    all_tracks: list[dict[str, Any]] = []

    use_minimax_tts = not force_mock_tts and resolved_tts_provider() != "mock"
    if not use_minimax_tts:
        generator = "fallback-script+mock-tts+ffmpeg-mix+dayparts"

    for stage_index, stage in enumerate(stages, start=1):
        stage_key = str(stage.get("key") or f"stage_{stage_index}")
        stage_name = str(stage.get("name") or f"阶段 {stage_index}")
        intro_text = str(stage.get("intro") or "").strip() or f"{stage_name}的三首歌，从你的最近记录里开始。"
        intro_suffix = "mp3" if use_minimax_tts else "wav"
        intro_path = output_dir / f"{episode_id}-{stage_key}-intro.{intro_suffix}"
        if use_minimax_tts:
            intro_path.write_bytes(await generate_tts_audio(intro_text))
        else:
            write_mock_radio_wav(intro_path, intro_text)
        audio_inputs.append(intro_path)
        segments.append(
            {
                "type": "stage_intro",
                "stage": stage_key,
                "stageName": stage_name,
                "id": f"radio_{episode_id}_{stage_key}_intro",
                "title": f"{stage_name}口播",
                "artist": "Migi",
                "audioPath": str(intro_path),
                "durationSeconds": probe_audio_duration_seconds(intro_path),
            }
        )
        for track in stage.get("tracks") or []:
            source_path = Path(str(track.get("sourcePath") or ""))
            if not source_path.exists() or not source_path.is_file():
                continue
            audio_inputs.append(source_path)
            all_tracks.append(track)
            segments.append(
                {
                    "type": "track",
                    "stage": stage_key,
                    "stageName": stage_name,
                    "id": str(track.get("id") or ""),
                    "title": first_string_value(track, "title", "name") or "未知歌曲",
                    "artist": radio_artist_name(track),
                    "album": radio_album_name(track),
                    "sourcePath": str(source_path),
                    "coverArtUrl": str(track.get("coverArtUrl") or ""),
                    "lyrics": str(track.get("lyrics") or ""),
                    "reason": str(track.get("reason") or ""),
                    "durationSeconds": int(track.get("durationSeconds") or 0),
                }
            )

    if not all_tracks:
        raise RuntimeError("没有找到可合并的本地音乐文件。")

    outro_suffix = "mp3" if use_minimax_tts else "wav"
    outro_path = output_dir / f"{episode_id}-outro.{outro_suffix}"
    outro_text = outro_script.strip() or "今天的歌单先到这里。明天我会继续按你的记录修正。"
    if use_minimax_tts:
        outro_path.write_bytes(await generate_tts_audio(outro_text))
    else:
        write_mock_radio_wav(outro_path, outro_text)
    audio_inputs.append(outro_path)
    segments.append(
        {
            "type": "outro",
            "id": f"radio_{episode_id}_outro",
            "title": "结束口播",
            "artist": "Migi",
            "audioPath": str(outro_path),
            "durationSeconds": probe_audio_duration_seconds(outro_path),
        }
    )

    mix_audio_files(audio_inputs, final_path)
    duration_seconds = probe_audio_duration_seconds(final_path)
    segments.append(
        {
            "type": "full_mix",
            "id": f"radio_{episode_id}_mix",
            "title": "全天三阶段完整电台",
            "artist": "沐音 FM",
            "audioPath": str(final_path),
            "streamUrl": f"/v1/music/radio/episodes/{episode_id}/stream",
            "durationSeconds": duration_seconds,
        }
    )
    summary = " / ".join(
        f"{stage.get('name', '阶段')} {len(stage.get('tracks') or [])} 首"
        for stage in stages
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
        episode_date = episode_date_from_title(title)
        conn.execute(
            """
            INSERT INTO music_radio_episodes (
                id, episode_date, title, summary, script, audio_path, outro_audio_path,
                audio_format, duration_seconds, outro_duration_seconds,
                source_track_ids_json, segments_json, generator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                episode_id,
                episode_date,
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


async def generate_radio_daypart_sequence_episode(
    *,
    job_id: str,
    title: str,
    track_ids: list[str],
    script: str,
    stages: list[dict[str, Any]],
    outro_script: str,
    force_mock_tts: bool = False,
) -> dict[str, Any]:
    settings = get_settings()
    output_dir = Path(settings.radio_output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    episode_id = uuid.uuid4().hex
    tts_provider = "mock" if force_mock_tts else resolved_tts_provider()
    audio_format = "wav" if tts_provider == "mock" else "mp3"
    generator = f"{settings.llm_provider}-chat+{tts_provider}-tts+playlist-segments"
    episode_date = episode_date_from_script(script, title)
    audio_base = radio_audio_basename(episode_date)
    segments: list[dict[str, Any]] = []
    all_tracks: list[dict[str, Any]] = []

    for stage_index, stage in enumerate(stages, start=1):
        stage_key = str(stage.get("key") or f"stage_{stage_index}")
        stage_name = str(stage.get("name") or f"阶段 {stage_index}")
        intro_text = str(stage.get("intro") or "").strip() or f"{stage_name}的三首歌，从你的最近记录里开始。"
        intro_path = output_dir / f"{audio_base}-{stage_key}-intro.{audio_format}"
        if tts_provider == "mock":
            write_mock_radio_wav(intro_path, intro_text)
        else:
            intro_path.write_bytes(await generate_tts_audio(intro_text))
        intro_segment_id = f"radio_{episode_id}_{stage_key}_intro"
        segments.append(
            {
                "type": "stage_intro",
                "stage": stage_key,
                "stageName": stage_name,
                "id": intro_segment_id,
                "title": f"{stage_name}口播",
                "artist": "Migi",
                "audioPath": str(intro_path),
                "streamUrl": f"/v1/music/radio/episodes/{episode_id}/segments/{intro_segment_id}/stream",
                "audioFormat": audio_format,
                "durationSeconds": probe_audio_duration_seconds(intro_path),
                "text": intro_text,
            }
        )
        for track in stage.get("tracks") or []:
            source_path = Path(str(track.get("sourcePath") or ""))
            if not source_path.exists() or not source_path.is_file():
                continue
            all_tracks.append(track)
            segments.append(
                {
                    "type": "track",
                    "stage": stage_key,
                    "stageName": stage_name,
                    "id": str(track.get("id") or ""),
                    "title": first_string_value(track, "title", "name") or "未知歌曲",
                    "artist": radio_artist_name(track),
                    "album": radio_album_name(track),
                    "sourcePath": str(source_path),
                    "coverArtUrl": str(track.get("coverArtUrl") or ""),
                    "lyrics": str(track.get("lyrics") or ""),
                    "durationSeconds": int(track.get("durationSeconds") or 0),
                    "reason": str(track.get("reason") or ""),
                }
            )

    if not all_tracks:
        raise RuntimeError("没有找到可播放的本地音乐文件。")

    outro_text = outro_script.strip() or "今天的歌单先到这里。明天我会继续按你的记录修正。"
    outro_path = output_dir / f"{audio_base}-outro.{audio_format}"
    if tts_provider == "mock":
        write_mock_radio_wav(outro_path, outro_text)
    else:
        outro_path.write_bytes(await generate_tts_audio(outro_text))
    segments.append(
        {
            "type": "outro",
            "id": f"radio_{episode_id}_outro",
            "title": "结束口播",
            "artist": "Migi",
            "audioPath": str(outro_path),
            "streamUrl": f"/v1/music/radio/episodes/{episode_id}/segments/radio_{episode_id}_outro/stream",
            "audioFormat": audio_format,
            "durationSeconds": probe_audio_duration_seconds(outro_path),
            "text": outro_text,
        }
    )

    first_voice = next(
        (Path(str(segment.get("audioPath"))) for segment in segments if segment.get("type") != "track"),
        outro_path,
    )
    duration_seconds = sum(int(segment.get("durationSeconds") or 0) for segment in segments)
    summary = " / ".join(
        f"{stage.get('name', '阶段')} {len(stage.get('tracks') or [])} 首"
        for stage in stages
    )
    episode = {
        "id": episode_id,
        "title": title,
        "summary": summary,
        "script": script,
        "audioPath": str(first_voice),
        "outroAudioPath": str(outro_path),
        "audioFormat": audio_format,
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
                id, episode_date, title, summary, script, audio_path, outro_audio_path,
                audio_format, duration_seconds, outro_duration_seconds,
                source_track_ids_json, segments_json, generator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                episode_id,
                episode_date,
                title,
                summary,
                script,
                str(first_voice),
                str(outro_path),
                audio_format,
                duration_seconds,
                episode["outroDurationSeconds"],
                json.dumps(track_ids, ensure_ascii=False),
                json.dumps(segments, ensure_ascii=False),
                generator,
            ),
        )
        persist_radio_daily_generation(
            conn,
            episode=episode,
            episode_date=episode_date,
            weather=(json.loads(script).get("weather", {}) if script.strip().startswith("{") else {}),
            script_plan=(json.loads(script) if script.strip().startswith("{") else {}),
            tts_provider=tts_provider,
            tts_model=settings.fish_tts_model if tts_provider == "fish" else settings.minimax_tts_model,
        )
    return episode


def persist_radio_daily_generation(
    conn: sqlite3.Connection,
    *,
    episode: dict[str, Any],
    episode_date: str,
    weather: dict[str, Any],
    script_plan: dict[str, Any],
    tts_provider: str,
    tts_model: str,
) -> None:
    if not episode_date:
        return
    generation_id = str(episode.get("id") or uuid.uuid4().hex)
    conn.execute("DELETE FROM radio_daily_tracks WHERE episode_date = ?", (episode_date,))
    conn.execute("DELETE FROM radio_spoken_segments WHERE episode_date = ?", (episode_date,))
    conn.execute(
        """
        INSERT INTO radio_daily_generations (
            id, episode_date, episode_id, title, weather_json, script_plan_json,
            generator, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'generated', current_timestamp)
        ON CONFLICT(episode_date) DO UPDATE SET
            id = excluded.id,
            episode_id = excluded.episode_id,
            title = excluded.title,
            weather_json = excluded.weather_json,
            script_plan_json = excluded.script_plan_json,
            generator = excluded.generator,
            status = 'generated',
            updated_at = current_timestamp
        """,
        (
            generation_id,
            episode_date,
            generation_id,
            str(episode.get("title") or ""),
            json.dumps(weather, ensure_ascii=False),
            json.dumps(script_plan, ensure_ascii=False),
            str(episode.get("generator") or ""),
        ),
    )
    track_position = 0
    for segment in episode.get("segments", []):
        if not isinstance(segment, dict):
            continue
        segment_type = str(segment.get("type") or "")
        if segment_type == "track":
            track_position += 1
            conn.execute(
                """
                INSERT INTO radio_daily_tracks (
                    id, generation_id, episode_date, stage_key, stage_name, position,
                    track_id, title, artist, album, reason, source_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    uuid.uuid4().hex,
                    generation_id,
                    episode_date,
                    str(segment.get("stage") or ""),
                    str(segment.get("stageName") or ""),
                    track_position,
                    str(segment.get("id") or ""),
                    str(segment.get("title") or ""),
                    str(segment.get("artist") or ""),
                    str(segment.get("album") or ""),
                    str(segment.get("reason") or ""),
                    str(segment.get("sourcePath") or ""),
                ),
            )
            continue
        if segment_type in {"stage_intro", "intro", "outro"}:
            conn.execute(
                """
                INSERT INTO radio_spoken_segments (
                    id, generation_id, episode_date, segment_type, stage_key, title,
                    text, audio_path, audio_format, tts_provider, tts_model,
                    duration_seconds
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(segment.get("id") or uuid.uuid4().hex),
                    generation_id,
                    episode_date,
                    segment_type,
                    str(segment.get("stage") or ""),
                    str(segment.get("title") or ""),
                    str(segment.get("text") or ""),
                    str(segment.get("audioPath") or ""),
                    str(segment.get("audioFormat") or ""),
                    tts_provider,
                    tts_model,
                    int(segment.get("durationSeconds") or 0),
                ),
            )


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


def mix_audio_files(input_paths: list[Path], output_path: Path) -> None:
    if len(input_paths) < 2:
        raise RuntimeError("混音至少需要两段输入。")
    settings = get_settings()
    crossfade = max(0.3, min(settings.radio_mix_crossfade_seconds, 5.0))
    ducking_volume = max(0.05, min(settings.radio_mix_ducking_volume, 0.6))
    music_volume = max(0.2, min(settings.radio_mix_music_volume, 1.4))
    duck_seconds = max(3.0, min(crossfade + 5.0, 12.0))
    filter_parts: list[str] = []
    previous_label = ""

    for index, path in enumerate(input_paths):
        is_voice = is_radio_voice_segment(path)
        if is_voice:
            volume_filter = "volume=1.0"
        else:
            volume_filter = (
                f"volume=if(lt(t\\,{duck_seconds:.2f})\\,"
                f"{ducking_volume:.3f}\\,{music_volume:.3f})"
            )
        filter_parts.append(
            f"[{index}:a]aformat=sample_rates=44100:channel_layouts=stereo,"
            f"{volume_filter},afade=t=in:st=0:d=0.35[a{index}]"
        )
        current_label = f"a{index}"
        if index == 0:
            previous_label = current_label
            continue
        output_label = f"mix{index}"
        filter_parts.append(
            f"[{previous_label}][{current_label}]"
            f"acrossfade=d={crossfade:.2f}:c1=tri:c2=tri[{output_label}]"
        )
        previous_label = output_label

    command = ["ffmpeg", "-y"]
    for path in input_paths:
        command.extend(["-i", str(path)])
    command.extend(
        [
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            f"[{previous_label}]",
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
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=900)
    except FileNotFoundError as error:
        raise RuntimeError("未找到 ffmpeg，请在 NAS 镜像或系统中安装 ffmpeg。") from error
    if result.returncode != 0:
        concat_audio_files(input_paths, output_path)


def is_radio_voice_segment(path: Path) -> bool:
    name = path.stem.lower()
    return any(part in name for part in ("intro", "outro", "voice", "spoken"))


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
            "artist": "Migi",
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
                "coverArtUrl": str(track.get("coverArtUrl") or ""),
                "lyrics": str(track.get("lyrics") or ""),
                "reason": str(track.get("reason") or ""),
                "durationSeconds": int(track.get("durationSeconds") or 0),
            }
        )
    segments.append(
        {
            "type": "outro",
            "id": f"radio_{episode_id}_outro",
            "title": "结束口播",
            "artist": "Migi",
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
    return await generate_tts_audio(text)


async def generate_tts_audio(text: str) -> bytes:
    provider = resolved_tts_provider()
    if provider == "fish":
        return await generate_fish_tts(text)
    if provider == "minimax":
        return await generate_minimax_tts_legacy(text)
    raise RuntimeError("TTS 未配置。")


async def generate_fish_tts(text: str) -> bytes:
    settings = get_settings()
    if not settings.fish_api_key:
        raise RuntimeError("Fish Audio TTS 未配置 FISH_API_KEY。")
    payload = {
        "text": text,
        "format": "mp3",
        "sample_rate": 44100,
        "mp3_bitrate": 128,
        "latency": "normal",
        "normalize": True,
        "prosody": {
            "speed": 0.95,
            "volume": 0,
            "normalize_loudness": True,
        },
    }
    if settings.fish_tts_reference_id:
        payload["reference_id"] = settings.fish_tts_reference_id
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(240.0, connect=30.0)) as client:
            response = await client.post(
                "https://api.fish.audio/v1/tts",
                headers={
                    "Authorization": f"Bearer {settings.fish_api_key}",
                    "Content-Type": "application/json",
                    "model": settings.fish_tts_model,
                },
                json=payload,
            )
    except httpx.HTTPError as error:
        detail = str(error).strip() or repr(error)
        raise RuntimeError(f"Fish Audio TTS 请求失败：{type(error).__name__}: {detail}") from error
    if response.status_code >= 400:
        raise RuntimeError(f"Fish Audio TTS HTTP {response.status_code}: {response.text[:300]}")
    content_type = response.headers.get("content-type", "")
    if "audio" not in content_type and not response.content:
        raise RuntimeError("Fish Audio TTS 响应没有音频内容。")
    return response.content


async def generate_minimax_tts_legacy(text: str) -> bytes:
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


def resolved_llm_key() -> str:
    return get_settings().openai_compat_api_key


def resolved_tts_provider() -> str:
    settings = get_settings()
    if settings.tts_provider == "fish" and settings.fish_api_key:
        return "fish"
    if settings.tts_provider == "minimax" and resolved_minimax_key() and settings.minimax_group_id:
        return "minimax"
    return "mock"


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
                "coverArtUrl": str(track.get("coverArtUrl") or ""),
                "lyrics": str(track.get("lyrics") or ""),
                "reason": str(track.get("reason") or ""),
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
    segments = json.loads(row["segments_json"] or "[]")
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
        "segments": segments,
        "playbackFlow": build_radio_playback_flow(segments),
        "generator": row["generator"],
        "streamUrl": f"/v1/music/radio/episodes/{episode_id}/stream",
        "outroStreamUrl": f"/v1/music/radio/episodes/{episode_id}/outro/stream"
        if row["outro_audio_path"]
        else "",
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def radio_chat_message_row_to_dict(row: sqlite3.Row | None) -> dict[str, Any]:
    if row is None:
        return {}
    return {
        "id": row["id"],
        "role": row["role"],
        "content": row["content"],
        "intentType": row["intent_type"],
        "effectSummary": row["effect_summary"],
        "memoryId": row["memory_id"],
        "createdAt": row["created_at"],
    }


def music_memory_row_to_dict(row: sqlite3.Row | None) -> dict[str, Any]:
    if row is None:
        return {}
    return {
        "id": row["id"],
        "category": row["category"],
        "title": row["title"],
        "content": row["content"],
        "sourceMessageId": row["source_message_id"],
        "status": row["status"],
        "confidence": row["confidence"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def classify_radio_chat(content: str) -> dict[str, Any]:
    lowered = content.lower()
    long_term_markers = [
        "以后",
        "一直",
        "我喜欢",
        "我爱听",
        "我不喜欢",
        "不爱听",
        "少推",
        "多推",
        "记住",
        "以后别",
        "工作时",
        "晚上",
        "雨天",
        "开车",
        "睡前",
    ]
    session_markers = [
        "今天",
        "这期",
        "现在",
        "下一首",
        "换",
        "少说话",
        "多放歌",
        "别说太多",
        "生成",
        "播放",
    ]
    is_long_term = any(marker in content for marker in long_term_markers)
    is_session = any(marker in content for marker in session_markers)
    if any(marker in lowered for marker in ["skip", "next"]):
        is_session = True

    intent_type = "long_term_preference" if is_long_term else "session_instruction" if is_session else "chat"
    effect_summary = {
        "long_term_preference": "识别为可能长期有效的音乐偏好，等待你确认是否记住。",
        "session_instruction": "识别为当前电台指令，先影响本期电台上下文。",
        "chat": "识别为普通聊天，暂时只保留在电台对话里。",
    }[intent_type]

    memory_title = ""
    memory_content = ""
    memory_category = "music_preference"
    confidence = 0.62
    if is_long_term:
        memory_title = build_memory_title(content)
        memory_content = content
        if any(marker in content for marker in ["不喜欢", "不爱听", "少推", "以后别"]):
            memory_category = "music_avoidance"
            confidence = 0.72
        elif any(marker in content for marker in ["工作", "晚上", "雨天", "开车", "睡前"]):
            memory_category = "music_scene_rule"
            confidence = 0.68

    return {
        "intentType": intent_type,
        "effectSummary": effect_summary,
        "memoryCandidate": is_long_term,
        "memoryCategory": memory_category,
        "memoryTitle": memory_title,
        "memoryContent": memory_content,
        "confidence": confidence,
        "reply": "",
        "generator": "local-rules",
    }


def load_radio_chat_context() -> dict[str, Any]:
    with db() as conn:
        message_rows = conn.execute(
            """
            SELECT * FROM music_radio_chat_messages
            ORDER BY created_at DESC
            LIMIT 16
            """
        ).fetchall()
        memory_rows = conn.execute(
            """
            SELECT * FROM music_preference_memories
            WHERE status = 'remembered'
            ORDER BY updated_at DESC
            LIMIT 20
            """
        ).fetchall()
    return {
        "messages": [
            radio_chat_message_row_to_dict(row) for row in reversed(message_rows)
        ],
        "memories": [music_memory_row_to_dict(row) for row in memory_rows],
    }


async def classify_radio_chat_with_minimax(
    content: str,
    local_classification: dict[str, Any],
    chat_context: dict[str, Any],
) -> dict[str, Any]:
    if not resolved_llm_key():
        return local_classification
    prompt = build_minimax_radio_chat_prompt(content, local_classification, chat_context)
    try:
        result = await generate_llm_json(prompt)
    except Exception as error:
        fallback = dict(local_classification)
        fallback["effectSummary"] = f"{fallback['effectSummary']} 文本模型暂不可用，已使用本地规则兜底。"
        fallback["generator"] = "local-rules"
        fallback["aiError"] = str(error)
        return fallback
    merged = normalize_minimax_radio_chat_result(result, local_classification)
    merged["generator"] = f"{get_settings().llm_provider}-{get_settings().openai_compat_model}"
    return merged


def build_minimax_radio_chat_prompt(
    content: str,
    local_classification: dict[str, Any],
    chat_context: dict[str, Any],
) -> str:
    persona_skill = load_radio_persona_skill()
    memories = chat_context.get("memories") or []
    messages = chat_context.get("messages") or []
    memory_lines = [
        f"- {item.get('category', 'music_preference')}: {item.get('content', '')}"
        for item in memories[:20]
        if isinstance(item, dict)
    ]
    message_lines = [
        f"{item.get('role', 'user')}: {item.get('content', '')}"
        for item in messages[-12:]
        if isinstance(item, dict)
    ]
    return (
        "你是“沐音 FM”的私人 AI DJ。说话方式遵循下方电台人格技能，但不要自称原作角色。\n"
        "电台人格技能：\n"
        + (persona_skill or "- 使用克制、理性、私人化的中文 DJ 口吻。\n")
        + "\n"
        "你还要判断这句话应该如何进入系统：当前电台指令、长期音乐偏好候选、普通聊天。\n"
        "不要装作已经真的切歌或播放，除非用户只是表达偏好；可说“我会把本期方向调成...”。\n"
        "音乐建议仍以已确认长期偏好、最近对话、听歌记录为依据；不要因为人格技能虚构用户偏好。\n"
        "长期偏好必须是以后也有价值的信息，例如喜欢/不喜欢的歌手、曲风、场景规则、口播习惯。"
        "临时请求例如“今天、这期、现在、下一首”只作为 session_instruction。\n"
        "回复要短，20-70 个中文字符，不能像客服，不要说“已为您”。\n"
        "只输出 JSON，不要 markdown，不要额外解释。\n"
        "JSON 字段："
        '{"reply":"...","intentType":"session_instruction|long_term_preference|chat",'
        '"effectSummary":"...","memoryCandidate":true,'
        '"memoryCategory":"music_preference|music_avoidance|music_scene_rule|dj_style",'
        '"memoryTitle":"...","memoryContent":"...","confidence":0.0}\n'
        f"本地初判：{json.dumps(local_classification, ensure_ascii=False)}\n"
        "已确认长期偏好：\n"
        + ("\n".join(memory_lines) if memory_lines else "- 暂无\n")
        + "\n最近对话：\n"
        + ("\n".join(message_lines) if message_lines else "- 暂无\n")
        + f"\n用户刚说：{content}\n"
    )


def normalize_minimax_radio_chat_result(
    result: dict[str, Any],
    fallback: dict[str, Any],
) -> dict[str, Any]:
    allowed_intents = {"session_instruction", "long_term_preference", "chat"}
    allowed_categories = {
        "music_preference",
        "music_avoidance",
        "music_scene_rule",
        "dj_style",
    }
    intent_type = str(result.get("intentType") or fallback["intentType"]).strip()
    if intent_type not in allowed_intents:
        intent_type = fallback["intentType"]
    memory_candidate = bool(result.get("memoryCandidate"))
    if intent_type != "long_term_preference":
        memory_candidate = False
    memory_category = str(
        result.get("memoryCategory") or fallback.get("memoryCategory") or "music_preference"
    ).strip()
    if memory_category not in allowed_categories:
        memory_category = fallback.get("memoryCategory") or "music_preference"
    memory_content = str(result.get("memoryContent") or "").strip()
    if memory_candidate and not memory_content:
        memory_content = fallback.get("memoryContent") or ""
    if not memory_content:
        memory_candidate = False
    memory_title = str(result.get("memoryTitle") or "").strip()
    if not memory_title and memory_content:
        memory_title = build_memory_title(memory_content)
    reply = str(result.get("reply") or "").strip()
    confidence = result.get("confidence", fallback.get("confidence", 0.62))
    try:
        confidence_value = float(confidence)
    except (TypeError, ValueError):
        confidence_value = float(fallback.get("confidence", 0.62))
    confidence_value = max(0.0, min(confidence_value, 1.0))
    effect_summary = str(result.get("effectSummary") or "").strip()
    if not effect_summary:
        effect_summary = {
            "long_term_preference": "文本模型识别为长期音乐偏好候选，等待你确认是否记住。",
            "session_instruction": "文本模型识别为当前电台指令，先影响本期电台上下文。",
            "chat": "文本模型识别为普通聊天，暂时只保留在电台对话里。",
        }[intent_type]
    return {
        "intentType": intent_type,
        "effectSummary": effect_summary,
        "memoryCandidate": memory_candidate,
        "memoryCategory": memory_category,
        "memoryTitle": memory_title,
        "memoryContent": memory_content,
        "confidence": confidence_value,
        "reply": reply,
    }


def build_memory_title(content: str) -> str:
    compact = " ".join(content.split())
    if len(compact) <= 22:
        return compact
    return f"{compact[:22]}..."


def build_radio_chat_reply(
    content: str,
    classification: dict[str, Any],
    memory: dict[str, Any] | None,
) -> str:
    intent_type = classification["intentType"]
    if intent_type == "long_term_preference" and memory:
        return (
            f"我听到了，这像是一条长期音乐偏好：{memory['title']}。"
            "我先放到待确认记忆里，你点“记住”后，以后生成电台会参考它。"
        )
    if intent_type == "session_instruction":
        return "收到，这条先作为本期电台指令。我会优先按这个方向调整今天的 DJ 企划和播放感觉。"
    return "收到，我先记在这次电台对话里。你也可以直接说“以后记住……”来沉淀成长期偏好。"


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
