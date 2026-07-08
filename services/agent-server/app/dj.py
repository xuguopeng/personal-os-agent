from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse, JSONResponse

from .config import get_settings
from .db import db
from .music import (
    build_weather_intro,
    create_daily_radio_daypart_episode,
    fetch_radio_weather,
    fetch_recent_playback_tracks,
    first_string_value,
    find_local_track_for_radio,
    enqueue_missing_tracks,
    generate_tts_audio,
    generate_llm_json,
    load_radio_chat_context,
    load_radio_persona_skill,
    latest_daily_radio_mix_episode,
    missing_track_queue_status,
    next_daily_radio_run_at,
    music_memory_row_to_dict,
    process_missing_track_queue,
    RADIO_SCHEDULER_STATE,
    radio_artist_name,
    radio_album_name,
    radio_chat_message_row_to_dict,
    resolved_llm_key,
    resolved_tts_provider,
)
from .repository import row_to_dict

router = APIRouter(prefix="/v1/dj", tags=["dj"])


def error_detail(error: BaseException) -> str:
    message = str(error).strip()
    if message:
        return message
    return f"{type(error).__module__}.{type(error).__name__}"


def profile_intake_questions() -> list[dict[str, Any]]:
    return [
        {
            "id": "favorite_artists",
            "title": "喜欢的歌手",
            "prompt": "你最喜欢哪些歌手、乐队或制作人？可以按最常听的顺序写。",
            "targetDoc": "taste.md",
        },
        {
            "id": "disliked_artists_or_styles",
            "title": "不喜欢的内容",
            "prompt": "哪些歌手、曲风、声音、口播方式你不想听或少听？",
            "targetDoc": "taste.md",
        },
        {
            "id": "work_music",
            "title": "工作音乐",
            "prompt": "工作、写代码或整理资料时，你喜欢什么节奏和氛围？",
            "targetDoc": "routines.md",
        },
        {
            "id": "morning_music",
            "title": "上午偏好",
            "prompt": "上午想听什么风格？需要清醒、平稳、热闹，还是安静？",
            "targetDoc": "routines.md",
        },
        {
            "id": "afternoon_music",
            "title": "下午偏好",
            "prompt": "下午容易疲惫的时候，你希望电台怎么选歌？",
            "targetDoc": "routines.md",
        },
        {
            "id": "night_music",
            "title": "晚上偏好",
            "prompt": "晚上、睡前或独处时，你更想听什么？",
            "targetDoc": "routines.md",
        },
        {
            "id": "weather_rules",
            "title": "天气规则",
            "prompt": "晴天、雨天、雾天、降温时，你希望电台有什么变化？",
            "targetDoc": "mood-rules.md",
        },
        {
            "id": "dj_style",
            "title": "DJ 说话方式",
            "prompt": "你希望 DJ 多说、少说、冷静分析、像朋友，还是更像私人助理？",
            "targetDoc": "mood-rules.md",
        },
    ]


@router.get("/status")
def dj_status() -> dict[str, Any]:
    with db() as conn:
        document_count = conn.execute("SELECT count(*) AS count FROM dj_profile_documents").fetchone()["count"]
        memory_count = conn.execute(
            "SELECT count(*) AS count FROM music_preference_memories WHERE status = 'remembered'"
        ).fetchone()["count"]
        candidate_count = conn.execute(
            "SELECT count(*) AS count FROM music_preference_memories WHERE status = 'candidate'"
        ).fetchone()["count"]
        last_plan = conn.execute(
            "SELECT * FROM dj_plans ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
    settings = get_settings()
    scheduler_state = dict(RADIO_SCHEDULER_STATE)
    scheduler_state.update(
        {
            "enabled": settings.radio_daily_enabled,
            "time": settings.radio_daily_time,
            "timezone": settings.radio_daily_timezone,
            "nextRunAt": next_daily_radio_run_at().isoformat(),
        }
    )
    return {
        "status": "ready",
        "mode": "claudio-style-dj-agent",
        "llmProvider": settings.llm_provider,
        "llmConfigured": bool(resolved_llm_key()),
        "ttsProvider": resolved_tts_provider(),
        "minimaxConfigured": False,
        "personaConfigured": bool(load_radio_persona_skill()),
        "documentCount": document_count,
        "rememberedMemoryCount": memory_count,
        "candidateMemoryCount": candidate_count,
        "lastPlan": dj_plan_row_to_dict(last_plan) if last_plan else None,
        "scheduler": scheduler_state,
        "message": "DJ Agent 已按 Claudio 流程就绪：语料、上下文、规划、记忆和播放接口分层运行。",
    }


@router.post("/tts/probe")
async def dj_tts_probe() -> dict[str, Any]:
    settings = get_settings()
    sample_text = "你好，我是 Migi。现在测试私人电台口播。"
    try:
        audio = await generate_tts_audio(sample_text)
    except Exception as error:  # noqa: BLE001 - diagnostic endpoint must report provider failures
        return {
            "status": "error",
            "provider": resolved_tts_provider(),
            "model": settings.fish_tts_model if resolved_tts_provider() == "fish" else settings.minimax_tts_model,
            "message": error_detail(error),
        }
    return {
        "status": "ready",
        "provider": resolved_tts_provider(),
        "model": settings.fish_tts_model if resolved_tts_provider() == "fish" else settings.minimax_tts_model,
        "voice": settings.fish_tts_reference_id if resolved_tts_provider() == "fish" else settings.minimax_tts_voice_id,
        "bytes": len(audio),
        "head": audio[:8].hex(),
        "message": "TTS 测试音频已生成。",
    }


@router.get("/profile")
def dj_profile(days: int = Query(default=180, ge=1, le=3650)) -> dict[str, Any]:
    return {
        "documents": load_profile_documents(),
        "questions": profile_intake_questions(),
        "memories": load_music_memories(include_candidates=True),
        "listeningProfile": load_listening_profile(days),
    }


@router.post("/profile/intake")
def apply_profile_intake(payload: dict[str, Any]) -> dict[str, Any]:
    answers = payload.get("answers") if isinstance(payload.get("answers"), dict) else payload
    if not isinstance(answers, dict):
        return {"status": "error", "message": "answers 必须是对象。"}
    grouped: dict[str, list[str]] = {}
    questions = {item["id"]: item for item in profile_intake_questions()}
    for question_id, raw_value in answers.items():
        value = str(raw_value or "").strip()
        if not value:
            continue
        question = questions.get(str(question_id))
        if question is None:
            continue
        grouped.setdefault(question["targetDoc"], []).append(
            f"- {question['title']}：{value}"
        )
    with db() as conn:
        for doc_key, lines in grouped.items():
            existing = conn.execute(
                "SELECT content FROM dj_profile_documents WHERE doc_key = ?",
                (doc_key,),
            ).fetchone()
            current = existing["content"] if existing else f"# {doc_key}\n"
            addition = "\n\n## 用户一次性画像补充\n" + "\n".join(lines) + "\n"
            conn.execute(
                """
                INSERT INTO dj_profile_documents (doc_key, title, content, source)
                VALUES (?, ?, ?, 'user_intake')
                ON CONFLICT(doc_key) DO UPDATE SET
                    content = excluded.content,
                    source = 'user_intake',
                    updated_at = current_timestamp
                """,
                (doc_key, document_title(doc_key), current.rstrip() + addition),
            )
    return {
        "status": "saved",
        "updatedDocuments": sorted(grouped.keys()),
        "message": "画像语料已写入 DJ 大脑，后续推荐会把这些答案放进 context window。",
    }


@router.get("/context")
async def dj_context(message: str = "") -> dict[str, Any]:
    return await build_dj_context(message=message, trigger_type="preview")


@router.get("/plans")
def list_dj_plans(limit: int = Query(default=30, ge=1, le=200)) -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM dj_plans ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return {"items": [dj_plan_row_to_dict(row) for row in rows]}


@router.get("/today")
async def dj_today(autoBuild: bool = Query(default=False)) -> dict[str, Any]:
    settings = get_settings()
    today = datetime.now(ZoneInfo(settings.radio_daily_timezone)).date()
    episode = latest_daily_radio_mix_episode(today)
    if episode:
        return {
            "status": "ready",
            "date": today.isoformat(),
            "episode": episode,
            "message": "已找到今天的私人电台。",
        }
    if not autoBuild:
        return {
            "status": "not_found",
            "date": today.isoformat(),
            "episode": None,
            "message": "今天的私人电台还没有生成；客户端可请求 autoBuild=true 或等待 07:00 定时任务。",
        }
    try:
        result = await create_daily_radio_daypart_episode(
            {
                "title": f"沐音今日歌单 {today.isoformat()}",
            }
        )
    except Exception as error:  # noqa: BLE001 - surface generation failures to clients
        return {
            "status": "error",
            "date": today.isoformat(),
            "episode": None,
            "radio": None,
            "message": f"今天的私人电台生成失败：{error_detail(error)}",
        }
    result_status = str(result.get("status") or "ready")
    result_episode = result.get("episode")
    if result_status == "error" or not result_episode:
        return {
            "status": "error",
            "date": today.isoformat(),
            "episode": None,
            "radio": result,
            "message": str(result.get("message") or "今天的私人电台生成失败。"),
        }
    return {
        "status": result_status,
        "date": today.isoformat(),
        "episode": result_episode,
        "radio": result,
        "message": str(result.get("message") or "今天的私人电台已生成。"),
    }


@router.get("/chat")
def dj_chat_history() -> dict[str, Any]:
    return load_radio_chat_context()


@router.post("/memories/{memory_id}/{action}")
def update_dj_memory(memory_id: str, action: str) -> JSONResponse:
    status = {
        "remember": "remembered",
        "ignore": "ignored",
    }.get(action)
    if status is None:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "记忆操作只支持 remember 或 ignore。"},
        )
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM music_preference_memories WHERE id = ?",
            (memory_id,),
        ).fetchone()
        if row is None:
            return JSONResponse(
                status_code=404,
                content={"status": "not_found", "message": "没有找到这条记忆候选。"},
            )
        conn.execute(
            """
            UPDATE music_preference_memories
            SET status = ?, updated_at = current_timestamp
            WHERE id = ?
            """,
            (status, memory_id),
        )
        updated = conn.execute(
            "SELECT * FROM music_preference_memories WHERE id = ?",
            (memory_id,),
        ).fetchone()
        memory = music_memory_row_to_dict(updated)
        if status == "remembered":
            append_memory_to_profile_document(conn, memory)
    return JSONResponse(content={"status": "ok", "memory": memory})


@router.get("/missing-tracks")
def dj_missing_tracks(limit: int = Query(default=100, ge=1, le=500)) -> dict[str, Any]:
    return missing_track_queue_status(limit)


@router.post("/missing-tracks/process")
def process_dj_missing_tracks(limit: int = Query(default=20, ge=1, le=100)) -> dict[str, Any]:
    return process_missing_track_queue(limit)


@router.post("/plan/today")
async def plan_today(payload: dict[str, Any] | None = None) -> JSONResponse:
    payload = payload or {}
    message = str(payload.get("message") or "生成今天的私人音乐电台").strip()
    plan = await create_dj_plan(message=message, trigger_type="today")
    return JSONResponse(content={"status": "ok", "plan": plan})


@router.post("/plan/from-message")
async def plan_from_message(payload: dict[str, Any]) -> JSONResponse:
    message = str(payload.get("message") or payload.get("content") or "").strip()
    if not message:
        return JSONResponse(status_code=400, content={"status": "error", "message": "请输入要交给 DJ 的内容。"})
    plan = await create_dj_plan(message=message, trigger_type="message")
    return JSONResponse(content={"status": "ok", "plan": plan})


@router.post("/chat")
async def dj_chat(payload: dict[str, Any]) -> JSONResponse:
    content = str(payload.get("content") or payload.get("message") or "").strip()
    if not content:
        return JSONResponse(status_code=400, content={"status": "error", "message": "请输入要告诉 DJ 的内容。"})
    confirmation = handle_memory_confirmation_message(content)
    if confirmation:
        return JSONResponse(content=confirmation)
    plan = await create_dj_plan(message=content, trigger_type="chat")
    action = await build_playback_action(content, plan)
    if action.get("type") == "missing_track":
        action_message = str(action.get("message") or "").strip()
        if action_message and action_message not in str(plan.get("say") or ""):
            plan["say"] = f"{plan.get('say', '').rstrip()}\n{action_message}".strip()
            with db() as conn:
                conn.execute(
                    "UPDATE dj_plans SET say = ?, updated_at = current_timestamp WHERE id = ?",
                    (plan["say"], plan["id"]),
                )
    memory = persist_plan_memory_candidate(plan)
    persist_chat_turn(content, plan, memory)
    spoken = await build_chat_spoken_segment(plan)
    return JSONResponse(
        content={
            "status": "ok",
            "reply": plan["say"],
            "plan": plan,
            "action": action,
            "spoken": spoken,
            "memoryCandidate": memory,
        }
    )


@router.get("/spoken/{plan_id}/stream", response_model=None)
def stream_dj_spoken(plan_id: str):
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", plan_id)
    if not safe_id:
        return JSONResponse(status_code=404, content={"status": "error", "message": "口播不存在。"})
    path = Path(get_settings().radio_output_dir) / f"migi-chat-{safe_id}.mp3"
    if not path.exists() or not path.is_file():
        return JSONResponse(status_code=404, content={"status": "error", "message": "口播音频文件不存在。"})
    return FileResponse(path, media_type="audio/mpeg", filename=path.name)


@router.post("/episode/build")
async def build_dj_episode(payload: dict[str, Any] | None = None) -> JSONResponse:
    payload = payload or {}
    message = str(payload.get("message") or "生成今天的私人音乐电台").strip()
    plan = await create_dj_plan(message=message, trigger_type="episode")
    try:
        result = await create_daily_radio_daypart_episode(
            {
                "title": plan.get("title") or "沐音私人电台",
                "force": bool(payload.get("force")),
            }
        )
    except Exception as error:  # noqa: BLE001 - keep API JSON-shaped
        return JSONResponse(
            status_code=200,
            content={
                "status": "error",
                "plan": plan,
                "radio": None,
                "message": f"私人电台生成失败：{error_detail(error)}",
            },
        )
    episode = result.get("episode") if isinstance(result, dict) else None
    if isinstance(episode, dict):
        with db() as conn:
            conn.execute(
                "UPDATE dj_plans SET episode_id = ?, updated_at = current_timestamp WHERE id = ?",
                (episode.get("id", ""), plan["id"]),
            )
        plan["episodeId"] = episode.get("id", "")
    return JSONResponse(content={"status": result.get("status", "ok"), "plan": plan, "radio": result})


async def build_chat_spoken_segment(plan: dict[str, Any]) -> dict[str, Any]:
    plan_id = str(plan.get("id") or "").strip()
    text = str(plan.get("say") or "").strip()
    if not plan_id or not text:
        return {"status": "skipped", "message": "没有可生成的口播文本。"}
    output_dir = Path(get_settings().radio_output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", plan_id)
    audio_path = output_dir / f"migi-chat-{safe_id}.mp3"
    if not audio_path.exists():
        try:
            audio_path.write_bytes(await generate_tts_audio(text))
        except Exception as error:  # noqa: BLE001 - chat should still return text/action
            return {
                "status": "error",
                "provider": resolved_tts_provider(),
                "message": error_detail(error),
            }
    return {
        "status": "ready",
        "id": safe_id,
        "text": text,
        "streamUrl": f"/v1/dj/spoken/{safe_id}/stream",
        "audioFormat": "mp3",
        "provider": resolved_tts_provider(),
    }


async def create_dj_plan(message: str, trigger_type: str) -> dict[str, Any]:
    context = await build_dj_context(message=message, trigger_type=trigger_type)
    fallback = build_fallback_dj_plan(message, context)
    if resolved_llm_key():
        try:
            raw = await generate_llm_json(build_dj_prompt(context))
            normalized = normalize_dj_plan(raw, fallback)
            generator = f"{get_settings().llm_provider}-{get_settings().openai_compat_model}"
        except Exception as error:  # noqa: BLE001 - DJ should still respond
            normalized = dict(fallback)
            normalized["reason"] = f"{normalized['reason']} 文本模型暂不可用，已使用本地保守规划：{error}"
            raw = {"error": str(error)}
            generator = "local-fallback"
    else:
        normalized = fallback
        raw = {}
        generator = "local-fallback"

    plan_id = uuid.uuid4().hex
    plan = {
        "id": plan_id,
        "triggerType": trigger_type,
        "userMessage": message,
        "title": normalized["title"],
        "say": normalized["say"],
        "reason": normalized["reason"],
        "segue": normalized["segue"],
        "play": normalized["play"],
        "memoryCandidate": normalized.get("memoryCandidate") or {},
        "context": context,
        "raw": raw,
        "generator": generator,
        "episodeId": "",
    }
    with db() as conn:
        conn.execute(
            """
            INSERT INTO dj_plans (
                id, trigger_type, user_message, say, reason, segue, play_json,
                memory_candidate_json, context_json, raw_json, generator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                plan_id,
                trigger_type,
                message,
                plan["say"],
                plan["reason"],
                plan["segue"],
                json.dumps(plan["play"], ensure_ascii=False),
                json.dumps(plan["memoryCandidate"], ensure_ascii=False),
                json.dumps(compact_context_for_storage(context), ensure_ascii=False),
                json.dumps(raw, ensure_ascii=False),
                generator,
            ),
        )
    return plan


async def build_dj_context(message: str, trigger_type: str) -> dict[str, Any]:
    settings = get_settings()
    now = datetime.now(ZoneInfo(settings.radio_daily_timezone))
    weather = await fetch_radio_weather()
    recent_tracks = await fetch_recent_playback_tracks(settings.radio_recent_limit)
    return {
        "triggerType": trigger_type,
        "now": now.isoformat(),
        "date": now.date().isoformat(),
        "city": settings.radio_weather_city,
        "message": message,
        "persona": load_radio_persona_skill(),
        "documents": load_profile_documents(),
        "weather": weather,
        "weatherText": build_weather_intro(weather),
        "listeningProfile": load_listening_profile(180),
        "recentTracks": [track_summary(track) for track in recent_tracks[:30]],
        "chat": load_radio_chat_context(),
        "executionTrace": [
            "router: classify user message",
            "context: persona + profile docs + weather + listening records + memories",
            f"model: {settings.llm_provider}/{settings.openai_compat_model} returns say/play/reason/segue/memoryCandidate",
            "tools: optional episode build uses TTS + local music + ffmpeg",
        ],
    }


def build_dj_prompt(context: dict[str, Any]) -> str:
    return (
        "你是沐音 FM 的私人 AI DJ 大脑，按 Claudio 风格工作：先读用户语料和环境，再规划要说什么、播什么、为什么。\n"
        "你必须输出严格 JSON，不要 markdown，不要额外解释。\n"
        "最重要规则：推荐歌曲必须优先来自 recentTracks 和 listeningProfile；如果样本不足，要说明样本不足，不要编造用户偏好。\n"
        "人格只影响说话方式，不能覆盖真实听歌记录。\n"
        "输出字段："
        '{"title":"...","say":"...","play":[{"title":"...","artist":"...","reason":"..."}],'
        '"reason":"...","segue":"...","memoryCandidate":{"title":"...","content":"...","category":"music_preference","confidence":0.0}}\n'
        "say 控制在 30-120 个中文字符；reason 是给系统看的规划理由；segue 是进入播放前的过渡句。\n"
        "如果没有值得记住的新偏好，memoryCandidate 输出空对象 {}。\n"
        "CONTEXT JSON:\n"
        + json.dumps(context, ensure_ascii=False, indent=2)
    )


def normalize_dj_plan(raw: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    play = raw.get("play") if isinstance(raw.get("play"), list) else fallback["play"]
    clean_play: list[dict[str, str]] = []
    for item in play[:6]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        clean_play.append(
            {
                "title": title,
                "artist": str(item.get("artist") or "").strip(),
                "reason": str(item.get("reason") or "").strip(),
            }
        )
    if not clean_play:
        clean_play = fallback["play"]
    memory = raw.get("memoryCandidate") if isinstance(raw.get("memoryCandidate"), dict) else {}
    if memory and not str(memory.get("content") or "").strip():
        memory = {}
    return {
        "title": str(raw.get("title") or fallback["title"]).strip() or fallback["title"],
        "say": str(raw.get("say") or fallback["say"]).strip() or fallback["say"],
        "play": clean_play,
        "reason": str(raw.get("reason") or fallback["reason"]).strip() or fallback["reason"],
        "segue": str(raw.get("segue") or fallback["segue"]).strip() or fallback["segue"],
        "memoryCandidate": sanitize_memory_candidate(memory),
    }


def build_fallback_dj_plan(message: str, context: dict[str, Any]) -> dict[str, Any]:
    tracks = context.get("recentTracks") or []
    play = [
        {
            "title": item.get("title", "未知歌曲"),
            "artist": item.get("artist", ""),
            "reason": "来自最近播放和本地曲库，作为保守推荐。",
        }
        for item in tracks[:3]
        if isinstance(item, dict)
    ]
    if not play:
        play = [{"title": "等待曲库样本", "artist": "", "reason": "当前样本不足，需要先同步听歌记录或扫描曲库。"}]
    return {
        "title": f"沐音私人电台 {context.get('date', '')}".strip(),
        "say": "样本先按保守方式处理。我会优先使用你最近真实听过的歌，不凭空判断你的口味。",
        "play": play,
        "reason": f"用户输入：{message or '无'}；当前使用本地规则从最近播放中选择。",
        "segue": "先从已有证据开始，风险较低。",
        "memoryCandidate": {},
    }


async def build_playback_action(content: str, plan: dict[str, Any]) -> dict[str, Any]:
    lowered = content.lower()
    wants_playback = any(
        marker in content
        for marker in ("播放", "放歌", "开始听", "听歌", "今日电台", "今天的歌单", "来点", "推荐")
    ) or any(marker in lowered for marker in ("play", "music", "radio"))
    if not wants_playback:
        return {
            "type": "none",
            "status": "idle",
            "message": "这次聊天只更新理解，不触发播放。",
        }

    if any(marker in content for marker in ("今日电台", "今天的歌单", "今天电台", "全天歌单")):
        today_action = await build_today_episode_action(auto_build=False)
        if today_action["type"] != "none":
            return today_action
        return {
            "type": "build_and_play_today",
            "status": "needs_build",
            "method": "GET",
            "url": "/v1/dj/today?autoBuild=true",
            "message": "今天的电台还没有生成，客户端可调用该地址补生成后播放。",
        }

    direct_request = extract_direct_song_request(content)
    if direct_request:
        direct_tracks = find_local_tracks_for_action([direct_request], 1)
        if not direct_tracks:
            enqueue_missing_tracks([direct_request], source="dj_chat_direct")
            process_result = process_missing_track_queue(1)
            direct_tracks = find_local_tracks_for_action([direct_request], 1)
            if not direct_tracks:
                return {
                    "type": "missing_track",
                    "status": "queued",
                    "source": "dj_chat_direct",
                    "requestedTrack": direct_request,
                    "processResult": process_result,
                    "message": f"《{direct_request['title']}》当前不在本地曲库，已加入缺歌下载和刮削队列；下载完成后再点播就会播放。",
                }
        return {
            "type": "play_tracks",
            "status": "ready",
            "source": "dj_chat_direct",
            "title": plan.get("title", "DJ 点播"),
            "tracks": prepare_play_action_tracks(direct_tracks),
            "message": "已找到点播歌曲，开始播放。",
        }

    direct_tracks = []
    tracks = [*direct_tracks, *find_local_tracks_for_action(plan.get("play") or [], 6)]
    playable_tracks = prepare_play_action_tracks(tracks)
    if playable_tracks:
        return {
            "type": "play_tracks",
            "status": "ready",
            "source": "dj_chat",
            "title": plan.get("title", "DJ 推荐"),
            "tracks": playable_tracks,
            "message": "已根据聊天内容找到可播放歌曲。",
        }
    if plan.get("play"):
        enqueue_missing_tracks(plan.get("play") or [], source="dj_chat")

    today_action = await build_today_episode_action(auto_build=False)
    if today_action["type"] != "none":
        today_action["message"] = "没有匹配到单曲，先播放今天的私人电台。"
        return today_action
    return {
        "type": "build_and_play_today",
        "status": "needs_build",
        "method": "GET",
        "url": "/v1/dj/today?autoBuild=true",
        "message": "没有匹配到可播放单曲，客户端可补生成今天电台后播放。",
    }


def extract_direct_song_request(content: str) -> dict[str, str] | None:
    text = content.strip()
    if not text:
        return None
    patterns = (
        r"(?:播放|放一下|放首|听一下|听听|来一首|点播)\s*[《「“\"]?([^》」”\"，。,.!?！？]+)[》」”\"]?",
        r"[《「“\"]([^》」”\"]+)[》」”\"]",
    )
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        title = match.group(1).strip()
        title = re.sub(r"^(一下|一首|歌曲|音乐)\s*", "", title).strip()
        title = re.sub(r"\s*(这首歌|这首|吧|看看|试试)$", "", title).strip()
        if title:
            return {"title": title, "artist": ""}
    return None


async def build_today_episode_action(auto_build: bool) -> dict[str, Any]:
    settings = get_settings()
    today = datetime.now(ZoneInfo(settings.radio_daily_timezone)).date()
    episode = latest_daily_radio_mix_episode(today)
    if episode is None and auto_build:
        result = await create_daily_radio_daypart_episode(
            {
                "title": f"沐音今日歌单 {today.isoformat()}",
            }
        )
        episode = result.get("episode") if isinstance(result, dict) else None
    if not episode:
        return {
            "type": "none",
            "status": "not_found",
            "message": "今天的私人电台还没有生成。",
        }
    return {
        "type": "play_episode",
        "status": "ready",
        "source": "dj_today",
        "episode": {
            "id": episode.get("id", ""),
            "title": episode.get("title", "今日电台"),
            "summary": episode.get("summary", ""),
            "streamUrl": episode.get("streamUrl", ""),
            "durationSeconds": episode.get("durationSeconds", 0),
            "segments": episode.get("segments", []),
        },
        "message": "已找到今天的私人电台，可以直接播放。",
    }


def track_to_play_action_item(track: dict[str, Any]) -> dict[str, Any]:
    track_id = str(track.get("id") or "")
    return {
        "id": track_id,
        "title": first_string_value(track, "title", "name") or "未知歌曲",
        "artist": radio_artist_name(track),
        "album": radio_album_name(track),
        "durationSeconds": int(track.get("durationSeconds") or 0),
        "coverArtUrl": str(track.get("coverArtUrl") or ""),
        "lyrics": str(track.get("lyrics") or ""),
        "streamUrl": f"/v1/music/audio/{track_id}" if track_id else "",
        "sourcePath": str(track.get("sourcePath") or ""),
    }


def prepare_play_action_tracks(tracks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    playable_tracks = [track_to_play_action_item(track) for track in tracks if track.get("id")]
    if any(not str(track.get("lyrics") or "").strip() for track in playable_tracks):
        queue_metadata_refresh_for_tracks(playable_tracks)
    return playable_tracks


def queue_metadata_refresh_for_tracks(tracks: list[dict[str, Any]]) -> None:
    try:
        from .metadata_scrape import ScrapeJobCreateRequest, create_scrape_job

        create_scrape_job(
            ScrapeJobCreateRequest(
                providers=["qqmusic"],
                missing=["lyrics", "cover"],
                trackIds=[
                    str(track.get("id") or "")
                    for track in tracks
                    if str(track.get("id") or "").strip()
                ],
                limit=max(10, min(len(tracks) * 5, 50)),
                candidateLimit=3,
                autoApply=True,
                minConfidence=0.92,
            )
        )
    except Exception:
        return


def find_local_tracks_for_action(recommendations: list[Any], limit: int) -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in recommendations[:limit]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        artist = str(item.get("artist") or "").strip()
        if not title:
            continue
        track = find_local_track_for_radio(title, artist)
        if not track:
            continue
        track_id = str(track.get("id") or "")
        if track_id in seen:
            continue
        seen.add(track_id)
        tracks.append(track)
    return tracks


def load_profile_documents() -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM dj_profile_documents ORDER BY doc_key"
        ).fetchall()
    return [row_to_dict(row) for row in rows]


def load_music_memories(include_candidates: bool = False) -> list[dict[str, Any]]:
    where = "" if include_candidates else "WHERE status = 'remembered'"
    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM music_preference_memories
            {where}
            ORDER BY
                CASE status WHEN 'candidate' THEN 0 WHEN 'remembered' THEN 1 ELSE 2 END,
                updated_at DESC
            LIMIT 80
            """
        ).fetchall()
    return [music_memory_row_to_dict(row) for row in rows]


def load_listening_profile(days: int) -> dict[str, Any]:
    with db() as conn:
        sources = conn.execute(
            """
            SELECT source AS name, count(*) AS eventCount, sum(play_count) AS playCount
            FROM listening_events
            GROUP BY source
            ORDER BY playCount DESC, eventCount DESC
            LIMIT 12
            """
        ).fetchall()
        artists = conn.execute(
            """
            SELECT artist_name AS name, count(*) AS eventCount, sum(play_count) AS playCount
            FROM listening_events
            WHERE artist_name != ''
            GROUP BY artist_name
            ORDER BY playCount DESC, eventCount DESC
            LIMIT 20
            """
        ).fetchall()
        tracks = conn.execute(
            """
            SELECT track_name AS title, artist_name AS artist, album_name AS album,
                   source, sum(play_count) AS playCount, max(last_played_at) AS lastPlayedAt
            FROM listening_events
            WHERE track_name != ''
            GROUP BY track_name, artist_name
            ORDER BY playCount DESC, lastPlayedAt DESC
            LIMIT 30
            """
        ).fetchall()
    return {
        "days": days,
        "sources": [row_to_dict(row) for row in sources],
        "topArtists": [row_to_dict(row) for row in artists],
        "topTracks": [row_to_dict(row) for row in tracks],
    }


def track_summary(track: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(track.get("id") or ""),
        "title": first_string_value(track, "title", "name") or "未知歌曲",
        "artist": radio_artist_name(track),
        "album": str((track.get("album") or {}).get("title") if isinstance(track.get("album"), dict) else track.get("album") or ""),
        "durationSeconds": track.get("durationSeconds") or 0,
    }


def persist_plan_memory_candidate(plan: dict[str, Any]) -> dict[str, Any]:
    memory = sanitize_memory_candidate(plan.get("memoryCandidate") or {})
    if not memory:
        return {}
    memory_id = uuid.uuid4().hex
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_preference_memories (
                id, category, title, content, source_message_id, status, confidence
            ) VALUES (?, ?, ?, ?, ?, 'candidate', ?)
            """,
            (
                memory_id,
                memory.get("category", "music_preference"),
                memory.get("title", "音乐偏好候选"),
                memory.get("content", ""),
                plan["id"],
                float(memory.get("confidence") or 0.65),
            ),
        )
        row = conn.execute(
            "SELECT * FROM music_preference_memories WHERE id = ?",
            (memory_id,),
        ).fetchone()
    return music_memory_row_to_dict(row)


def handle_memory_confirmation_message(content: str) -> dict[str, Any] | None:
    normalized = content.strip().lower()
    remember_words = {"记住", "保存", "长期记住", "可以记住", "好，记住", "好的记住"}
    ignore_words = {"忽略", "不用记", "不要记", "取消", "算了"}
    session_words = {"这次有效", "仅这次", "只今天", "今天有效", "本次有效"}
    if normalized not in remember_words | ignore_words | session_words:
        return None
    with db() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM music_preference_memories
            WHERE status = 'candidate'
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()
        if row is None:
            return {
                "status": "ok",
                "reply": "现在没有等待确认的记忆。我会继续从聊天里提取有用的偏好。",
                "action": {"type": "none", "status": "idle"},
                "memoryCandidate": {},
            }
        memory = music_memory_row_to_dict(row)
        if normalized in ignore_words:
            conn.execute(
                "UPDATE music_preference_memories SET status = 'ignored', updated_at = current_timestamp WHERE id = ?",
                (memory["id"],),
            )
            reply = f"已忽略这条候选记忆：{memory.get('content', '')}"
            status = "ignored"
        elif normalized in session_words:
            conn.execute(
                "UPDATE music_preference_memories SET status = 'session_only', updated_at = current_timestamp WHERE id = ?",
                (memory["id"],),
            )
            reply = f"好，这条只影响今天：{memory.get('content', '')}"
            status = "session_only"
        else:
            conn.execute(
                "UPDATE music_preference_memories SET status = 'remembered', updated_at = current_timestamp WHERE id = ?",
                (memory["id"],),
            )
            append_memory_to_profile_document(conn, memory)
            reply = f"记住了：{memory.get('content', '')}"
            status = "remembered"
    return {
        "status": "ok",
        "reply": reply,
        "plan": {
            "say": reply,
            "play": [],
            "memoryCandidate": memory,
            "generator": "memory-confirmation",
        },
        "action": {"type": "none", "status": "idle"},
        "memoryCandidate": {**memory, "status": status},
    }


def append_memory_to_profile_document(conn, memory: dict[str, Any]) -> None:
    category = str(memory.get("category") or "music_preference")
    doc_key = {
        "music_preference": "taste.md",
        "music_avoidance": "taste.md",
        "music_scene_rule": "routines.md",
        "dj_style": "mood-rules.md",
    }.get(category, "taste.md")
    title = document_title(doc_key)
    existing = conn.execute(
        "SELECT content FROM dj_profile_documents WHERE doc_key = ?",
        (doc_key,),
    ).fetchone()
    current = existing["content"] if existing else f"# {title}\n"
    addition = (
        "\n\n## 聊天确认记忆\n"
        f"- {memory.get('title') or '音乐偏好'}：{memory.get('content') or ''}\n"
    )
    conn.execute(
        """
        INSERT INTO dj_profile_documents (doc_key, title, content, source)
        VALUES (?, ?, ?, 'chat_memory')
        ON CONFLICT(doc_key) DO UPDATE SET
            content = excluded.content,
            source = 'chat_memory',
            updated_at = current_timestamp
        """,
        (doc_key, title, current.rstrip() + addition),
    )


def persist_chat_turn(content: str, plan: dict[str, Any], memory: dict[str, Any]) -> None:
    now = datetime.now(ZoneInfo(get_settings().radio_daily_timezone))
    now_text = now.isoformat()
    assistant_time_text = now.replace(microsecond=min(now.microsecond + 1000, 999999)).isoformat()
    user_id = uuid.uuid4().hex
    memory_id = memory.get("id", "") if isinstance(memory, dict) else ""
    with db() as conn:
        conn.execute(
            """
            INSERT INTO music_radio_chat_messages (
                id, role, content, intent_type, effect_summary, memory_id, created_at
            ) VALUES (?, 'user', ?, 'dj_chat', ?, ?, ?)
            """,
            (user_id, content, plan.get("reason", ""), memory_id, now_text),
        )
        conn.execute(
            """
            INSERT INTO music_radio_chat_messages (
                id, role, content, intent_type, effect_summary, memory_id, created_at
            ) VALUES (?, 'assistant', ?, 'dj_chat', ?, ?, ?)
            """,
            (uuid.uuid4().hex, plan.get("say", ""), plan.get("segue", ""), memory_id, assistant_time_text),
        )


def sanitize_memory_candidate(memory: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(memory, dict):
        return {}
    content = str(memory.get("content") or "").strip()
    if not content:
        return {}
    category = str(memory.get("category") or "music_preference").strip()
    if category not in {"music_preference", "music_avoidance", "music_scene_rule", "dj_style"}:
        category = "music_preference"
    return {
        "title": str(memory.get("title") or "音乐偏好候选").strip(),
        "content": content,
        "category": category,
        "confidence": float(memory.get("confidence") or 0.65),
    }


def compact_context_for_storage(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "triggerType": context.get("triggerType"),
        "now": context.get("now"),
        "date": context.get("date"),
        "city": context.get("city"),
        "message": context.get("message"),
        "weatherText": context.get("weatherText"),
        "documents": [
            {"docKey": item.get("doc_key"), "updatedAt": item.get("updated_at")}
            for item in context.get("documents", [])
            if isinstance(item, dict)
        ],
        "recentTracks": context.get("recentTracks", [])[:10],
        "executionTrace": context.get("executionTrace", []),
    }


def dj_plan_row_to_dict(row: Any) -> dict[str, Any]:
    if row is None:
        return {}
    return {
        "id": row["id"],
        "triggerType": row["trigger_type"],
        "userMessage": row["user_message"],
        "say": row["say"],
        "reason": row["reason"],
        "segue": row["segue"],
        "play": json.loads(row["play_json"] or "[]"),
        "memoryCandidate": json.loads(row["memory_candidate_json"] or "{}"),
        "context": json.loads(row["context_json"] or "{}"),
        "raw": json.loads(row["raw_json"] or "{}"),
        "generator": row["generator"],
        "episodeId": row["episode_id"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def document_title(doc_key: str) -> str:
    return {
        "taste.md": "用户品味语料",
        "routines.md": "日常节奏语料",
        "mood-rules.md": "情绪和场景规则",
    }.get(doc_key, doc_key)
