from __future__ import annotations

import json
import re
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .config import get_settings


SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS module_blueprints (
    module_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source_refs_json TEXT NOT NULL DEFAULT '[]',
    agent_triggers_json TEXT NOT NULL DEFAULT '[]',
    current_phase TEXT NOT NULL DEFAULT 'registered',
    next_action TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS external_assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    module_key TEXT NOT NULL DEFAULT '',
    source_path TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    launch_command TEXT NOT NULL DEFAULT '',
    build_command TEXT NOT NULL DEFAULT '',
    last_scanned_at TEXT,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS skill_sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    source_path TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    indexed INTEGER NOT NULL DEFAULT 0,
    last_indexed_at TEXT,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'offline',
    last_seen_at TEXT,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS task_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    source_device_id TEXT,
    target_device_id TEXT,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp,
    FOREIGN KEY(source_device_id) REFERENCES devices(id) ON DELETE SET NULL,
    FOREIGN KEY(target_device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_steps (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    step_type TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT '',
    tool_name TEXT NOT NULL DEFAULT '',
    input_summary TEXT NOT NULL DEFAULT '',
    output_summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    FOREIGN KEY(session_id) REFERENCES task_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_radio_jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    mode TEXT NOT NULL DEFAULT 'mock',
    track_ids_json TEXT NOT NULL DEFAULT '[]',
    script TEXT NOT NULL DEFAULT '',
    episode_id TEXT,
    error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS music_radio_episodes (
    id TEXT PRIMARY KEY,
    episode_date TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    script TEXT NOT NULL DEFAULT '',
    audio_path TEXT NOT NULL DEFAULT '',
    outro_audio_path TEXT NOT NULL DEFAULT '',
    audio_format TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    outro_duration_seconds INTEGER NOT NULL DEFAULT 0,
    source_track_ids_json TEXT NOT NULL DEFAULT '[]',
    segments_json TEXT NOT NULL DEFAULT '[]',
    generator TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS radio_daily_generations (
    id TEXT PRIMARY KEY,
    episode_date TEXT NOT NULL UNIQUE,
    episode_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    weather_json TEXT NOT NULL DEFAULT '{}',
    script_plan_json TEXT NOT NULL DEFAULT '{}',
    generator TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'generated',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS radio_daily_tracks (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL,
    episode_date TEXT NOT NULL,
    stage_key TEXT NOT NULL DEFAULT '',
    stage_name TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    track_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    album TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    source_path TEXT NOT NULL DEFAULT '',
    played INTEGER NOT NULL DEFAULT 0,
    played_at TEXT,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    FOREIGN KEY(generation_id) REFERENCES radio_daily_generations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_radio_daily_tracks_generation ON radio_daily_tracks(generation_id, position);
CREATE INDEX IF NOT EXISTS idx_radio_daily_tracks_date ON radio_daily_tracks(episode_date, stage_key, position);

CREATE TABLE IF NOT EXISTS radio_spoken_segments (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL,
    episode_date TEXT NOT NULL,
    segment_type TEXT NOT NULL DEFAULT 'intro',
    stage_key TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    audio_path TEXT NOT NULL DEFAULT '',
    audio_format TEXT NOT NULL DEFAULT '',
    tts_provider TEXT NOT NULL DEFAULT '',
    tts_model TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    FOREIGN KEY(generation_id) REFERENCES radio_daily_generations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_radio_spoken_segments_generation ON radio_spoken_segments(generation_id, created_at);

CREATE TABLE IF NOT EXISTS music_radio_chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    intent_type TEXT NOT NULL DEFAULT 'chat',
    effect_summary TEXT NOT NULL DEFAULT '',
    memory_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS music_preference_memories (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'music_preference',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_message_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'candidate',
    confidence REAL NOT NULL DEFAULT 0.6,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS music_tracks (
    id TEXT PRIMARY KEY,
    source_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    artist TEXT NOT NULL DEFAULT '',
    album TEXT NOT NULL DEFAULT '',
    album_artist TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    track_number INTEGER NOT NULL DEFAULT 0,
    disc_number INTEGER NOT NULL DEFAULT 0,
    year TEXT NOT NULL DEFAULT '',
    genre TEXT NOT NULL DEFAULT '',
    lyrics TEXT NOT NULL DEFAULT '',
    cover_path TEXT NOT NULL DEFAULT '',
    file_format TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    file_mtime REAL NOT NULL DEFAULT 0,
    play_count INTEGER NOT NULL DEFAULT 0,
    favorite INTEGER NOT NULL DEFAULT 0,
    last_played_at TEXT,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_music_tracks_title ON music_tracks(title);
CREATE INDEX IF NOT EXISTS idx_music_tracks_artist ON music_tracks(artist);
CREATE INDEX IF NOT EXISTS idx_music_tracks_album ON music_tracks(album);
CREATE INDEX IF NOT EXISTS idx_music_tracks_favorite ON music_tracks(favorite);
CREATE INDEX IF NOT EXISTS idx_music_tracks_last_played ON music_tracks(last_played_at DESC);

CREATE TABLE IF NOT EXISTS music_metadata_scrape_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    mode TEXT NOT NULL DEFAULT 'missing',
    providers_json TEXT NOT NULL DEFAULT '[]',
    missing_json TEXT NOT NULL DEFAULT '[]',
    apply_fields_json TEXT NOT NULL DEFAULT '[]',
    limit_count INTEGER NOT NULL DEFAULT 50,
    candidate_limit INTEGER NOT NULL DEFAULT 3,
    auto_apply INTEGER NOT NULL DEFAULT 0,
    min_confidence REAL NOT NULL DEFAULT 0.92,
    processed_count INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    applied_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp,
    finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_music_metadata_jobs_status ON music_metadata_scrape_jobs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS music_metadata_scrape_candidates (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT '',
    source_id TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 0,
    candidate_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'candidate',
    applied_fields_json TEXT NOT NULL DEFAULT '[]',
    error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp,
    FOREIGN KEY(job_id) REFERENCES music_metadata_scrape_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY(track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_music_metadata_candidates_job ON music_metadata_scrape_candidates(job_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_music_metadata_candidates_track ON music_metadata_scrape_candidates(track_id, confidence DESC);

CREATE TABLE IF NOT EXISTS music_play_history (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    played_at TEXT NOT NULL DEFAULT current_timestamp,
    source TEXT NOT NULL DEFAULT 'client',
    device_id TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_music_play_history_played ON music_play_history(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_play_history_track ON music_play_history(track_id);

CREATE TABLE IF NOT EXISTS music_playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS music_playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY(playlist_id) REFERENCES music_playlists(id) ON DELETE CASCADE,
    FOREIGN KEY(track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS listening_sources (
    source_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'plugin',
    plugin_name TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'not_configured',
    config_hint TEXT NOT NULL DEFAULT '',
    last_synced_at TEXT,
    last_error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS listening_events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_event_id TEXT NOT NULL,
    source_user_id TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'history',
    track_name TEXT NOT NULL,
    artist_name TEXT NOT NULL DEFAULT '',
    album_name TEXT NOT NULL DEFAULT '',
    play_count INTEGER NOT NULL DEFAULT 1,
    last_played_at TEXT,
    confidence REAL NOT NULL DEFAULT 0.8,
    tags_json TEXT NOT NULL DEFAULT '[]',
    raw_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp,
    UNIQUE(source, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_listening_events_source ON listening_events(source);
CREATE INDEX IF NOT EXISTS idx_listening_events_track_artist ON listening_events(track_name, artist_name);
CREATE INDEX IF NOT EXISTS idx_listening_events_last_played ON listening_events(last_played_at DESC);

CREATE TABLE IF NOT EXISTS listening_sync_runs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    imported_count INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL DEFAULT current_timestamp,
    finished_at TEXT
);

CREATE TABLE IF NOT EXISTS dj_profile_documents (
    doc_key TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS dj_plans (
    id TEXT PRIMARY KEY,
    trigger_type TEXT NOT NULL DEFAULT 'chat',
    user_message TEXT NOT NULL DEFAULT '',
    say TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    segue TEXT NOT NULL DEFAULT '',
    play_json TEXT NOT NULL DEFAULT '[]',
    memory_candidate_json TEXT NOT NULL DEFAULT '{}',
    context_json TEXT NOT NULL DEFAULT '{}',
    raw_json TEXT NOT NULL DEFAULT '{}',
    generator TEXT NOT NULL DEFAULT '',
    episode_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_dj_plans_created ON dj_plans(created_at DESC);

CREATE TABLE IF NOT EXISTS music_missing_track_queue (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    album TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'dj',
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    matched_track_id TEXT NOT NULL DEFAULT '',
    download_result_json TEXT NOT NULL DEFAULT '{}',
    last_error TEXT NOT NULL DEFAULT '',
    last_attempt_at TEXT,
    created_at TEXT NOT NULL DEFAULT current_timestamp,
    updated_at TEXT NOT NULL DEFAULT current_timestamp,
    UNIQUE(title, artist)
);

CREATE INDEX IF NOT EXISTS idx_music_missing_queue_status ON music_missing_track_queue(status, updated_at DESC);
"""


def connect() -> sqlite3.Connection:
    db_path = Path(get_settings().db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def initialize_database() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)
        migrate_database(conn)
        seed_modules(conn)
        seed_listening_sources(conn)
        seed_dj_profile_documents(conn)


def migrate_database(conn: sqlite3.Connection) -> None:
    migrate_music_tracks(conn)
    ensure_column(conn, "music_radio_episodes", "episode_date", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "music_radio_episodes", "outro_audio_path", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "music_radio_episodes", "outro_duration_seconds", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "music_radio_episodes", "segments_json", "TEXT NOT NULL DEFAULT '[]'")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_music_radio_episodes_date ON music_radio_episodes(episode_date, created_at DESC)"
    )
    backfill_radio_daily_generation_records(conn)


def migrate_music_tracks(conn: sqlite3.Connection) -> None:
    """Keep old NAS databases compatible with the current music scanner."""
    columns = {
        "source_path": "TEXT NOT NULL DEFAULT ''",
        "file_name": "TEXT NOT NULL DEFAULT ''",
        "title": "TEXT NOT NULL DEFAULT ''",
        "artist": "TEXT NOT NULL DEFAULT ''",
        "album": "TEXT NOT NULL DEFAULT ''",
        "album_artist": "TEXT NOT NULL DEFAULT ''",
        "duration_seconds": "INTEGER NOT NULL DEFAULT 0",
        "track_number": "INTEGER NOT NULL DEFAULT 0",
        "disc_number": "INTEGER NOT NULL DEFAULT 0",
        "year": "TEXT NOT NULL DEFAULT ''",
        "genre": "TEXT NOT NULL DEFAULT ''",
        "lyrics": "TEXT NOT NULL DEFAULT ''",
        "cover_path": "TEXT NOT NULL DEFAULT ''",
        "file_format": "TEXT NOT NULL DEFAULT ''",
        "file_size": "INTEGER NOT NULL DEFAULT 0",
        "file_mtime": "REAL NOT NULL DEFAULT 0",
        "play_count": "INTEGER NOT NULL DEFAULT 0",
        "favorite": "INTEGER NOT NULL DEFAULT 0",
        "last_played_at": "TEXT",
        "created_at": "TEXT NOT NULL DEFAULT ''",
        "updated_at": "TEXT NOT NULL DEFAULT ''",
    }
    for column_name, definition in columns.items():
        ensure_column(conn, "music_tracks", column_name, definition)


def ensure_column(
    conn: sqlite3.Connection,
    table_name: str,
    column_name: str,
    definition: str,
) -> None:
    columns = {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in columns:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def backfill_radio_daily_generation_records(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        """
        SELECT *
        FROM music_radio_episodes
        ORDER BY created_at ASC
        """
    ).fetchall()
    for row in rows:
        episode_date = str(row["episode_date"] or "").strip()
        script_plan = parse_json_object(row["script"])
        if not episode_date:
            episode_date = extract_date_from_text(row["title"]) or str(script_plan.get("date") or "")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", episode_date):
            continue
        exists = conn.execute(
            "SELECT id FROM radio_daily_generations WHERE episode_date = ?",
            (episode_date,),
        ).fetchone()
        if exists:
            continue
        segments = parse_json_array(row["segments_json"])
        generation_id = str(row["id"])
        conn.execute(
            """
            INSERT INTO radio_daily_generations (
                id, episode_date, episode_id, title, weather_json, script_plan_json,
                generator, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'backfilled', ?, current_timestamp)
            """,
            (
                generation_id,
                episode_date,
                generation_id,
                row["title"],
                json.dumps(script_plan.get("weather", {}) if isinstance(script_plan, dict) else {}, ensure_ascii=False),
                json.dumps(script_plan, ensure_ascii=False),
                row["generator"],
                row["created_at"],
            ),
        )
        track_position = 0
        for segment in segments:
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
            elif segment_type in {"stage_intro", "intro", "outro"}:
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
                        str(segment.get("audioFormat") or row["audio_format"] or ""),
                        infer_tts_provider(row["generator"]),
                        infer_tts_model(row["generator"]),
                        int(segment.get("durationSeconds") or 0),
                    ),
                )


def parse_json_object(value: str | None) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def parse_json_array(value: str | None) -> list:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def extract_date_from_text(value: str | None) -> str:
    match = re.search(r"\d{4}-\d{2}-\d{2}", value or "")
    return match.group(0) if match else ""


def infer_tts_provider(generator: str | None) -> str:
    text = (generator or "").lower()
    if "fish" in text:
        return "fish"
    if "minimax" in text:
        return "minimax"
    if "mock" in text:
        return "mock"
    return ""


def infer_tts_model(generator: str | None) -> str:
    provider = infer_tts_provider(generator)
    if provider == "fish":
        return "s2.1-pro-free"
    if provider == "minimax":
        return "speech-2.8-hd"
    return ""


def seed_modules(conn: sqlite3.Connection) -> None:
    modules = [
        ("sticker", "表情包", "微信表情包规划、批量生图、导出和投稿检查。", '["@表情包"]', "接入表情包工作台。"),
        ("comic", "漫画", "故事分镜、AI 绘图、排版和发布。", '["@漫画","漫画做到哪了"]', "接入漫画状态和草稿。"),
        ("video", "视频", "无限画布、AI 视频生成、Palmier/MCP 视频剪辑。", '["@视频"]', "接入视频画布和 PC 执行器。"),
        ("music", "音乐", "沐音、NAS 音乐源、MuAudio AI 音乐电台。", '["@音乐","@听歌"]', "接入音乐源和播放控制。"),
        ("novel", "小说", "小说创作、人物关系、章节规划和写作 Skill。", '["@小说","@写小说"]', "接入写作项目和 Skill。"),
        ("blog", "博客/公众号", "博客草稿、公众号发布配置、发布记录。", '["@博客","@公众号"]', "同步发布渠道和草稿。"),
        ("design", "设计", "Figma、UI、品牌视觉、截图转设计稿。", '["@设计"]', "接入设计资料。"),
        ("finance", "沐账", "个人记账和财务管理。", '["@记账","@沐账"]', "保留模块蓝图。"),
        ("reading", "沐阅", "阅读、资料库和个人内容消费。", '["@阅读","@沐阅"]', "保留模块蓝图。"),
    ]
    conn.executemany(
        """
        INSERT INTO module_blueprints (
            module_key, display_name, description, agent_triggers_json, next_action
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(module_key) DO UPDATE SET
            display_name = excluded.display_name,
            description = excluded.description,
            agent_triggers_json = excluded.agent_triggers_json,
            next_action = excluded.next_action,
            updated_at = current_timestamp
        """,
        modules,
    )


def seed_listening_sources(conn: sqlite3.Connection) -> None:
    sources = [
        (
            "daoliyu",
            "Daoliyu / NAS",
            "builtin",
            "daoliyu",
            1,
            "ready",
            "读取 Daoliyu/NAS 播放次数和最近播放时间。",
        ),
        (
            "netease",
            "网易云音乐",
            "private_plugin",
            "netease_history",
            1,
            "not_configured",
            "支持网易云接口片段/JSON 导入；如需自动同步，把私有插件放到 LISTENING_PLUGIN_DIRS。",
        ),
        (
            "qqmusic",
            "QQ 音乐",
            "client_or_import",
            "",
            0,
            "not_configured",
            "网页端暂未发现个人播放记录接口；先通过本机播放采集、手动导入或后续客户端插件汇总。",
        ),
        (
            "kugou",
            "酷狗音乐",
            "client_or_import",
            "",
            0,
            "not_configured",
            "网页端暂未发现个人播放记录接口；先通过本机播放采集、手动导入或后续客户端插件汇总。",
        ),
        (
            "kuwo",
            "酷我音乐",
            "client_or_import",
            "",
            0,
            "not_configured",
            "网页端暂未发现个人播放记录接口；先通过本机播放采集、手动导入或后续客户端插件汇总。",
        ),
    ]
    conn.executemany(
        """
        INSERT INTO listening_sources (
            source_key, display_name, source_type, plugin_name, enabled, status, config_hint
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_key) DO UPDATE SET
            display_name = excluded.display_name,
            source_type = excluded.source_type,
            plugin_name = excluded.plugin_name,
            enabled = excluded.enabled,
            config_hint = excluded.config_hint,
            updated_at = current_timestamp
        """,
        sources,
    )


def seed_dj_profile_documents(conn: sqlite3.Connection) -> None:
    documents = [
        (
            "taste.md",
            "用户品味语料",
            (
                "# 用户品味语料\n\n"
                "## 明确偏好\n\n"
                "- 喜欢的歌手：周杰伦。\n"
                "- 喜欢的乐队：Beyond。\n"
                "- 常回听歌曲：《后来》《喜欢你》。\n"
                "- 最希望电台懂的一点：懂我的歌曲偏好，不要只按热门歌乱推。\n\n"
                "## 避免内容\n\n"
                "- 少推或不推：太吵、土嗨、喊麦。\n\n"
                "## 推断来源\n\n"
                "- 继续结合 NAS 播放历史、网易云/QQ 导入记录、客户端播放采集和聊天记忆修正。\n"
            ),
        ),
        (
            "routines.md",
            "日常节奏语料",
            (
                "# 日常节奏语料\n\n"
                "- 城市：陕西西安。\n"
                "- 默认每天早上 07:00 生成今天一天的歌单：上午、中午/下午、晚上三个阶段，每个阶段 3 首。\n"
                "- 用户每天第一次进入客户端时，不需要手动输入，客户端应读取当天已生成歌单并开始播放。\n"
                "- 工作/写代码/整理资料：偏向纯音乐，节奏比较强，但不要太吵。\n"
                "- 上午：中文歌。\n"
                "- 下午：提神一点的歌。\n"
                "- 晚上/睡前/独处：安静一点的歌。\n"
            ),
        ),
        (
            "mood-rules.md",
            "情绪和场景规则",
            (
                "# 情绪和场景规则\n\n"
                "- 天气、日期、当前时间和最近听歌记录必须影响推荐。\n"
                "- 记录不足时，先说样本不足，再给保守推荐。\n"
                "- 雨天、阴天、晴天、降温等天气变化不写死曲风，要结合天气和最近听歌记录判断。\n"
                "- DJ 可以稍微多说一点，但不要太多；开场建议 30 秒以上，但不要拖长。\n"
                "- 内容不要太干，要像 mmguo/Claudio 那样有私人观察、推荐理由和自然过渡。\n"
                "- 默认全天 3 个阶段，每个阶段 3 首歌。\n"
                "- 口吻继续使用理性观察型，不要客服腔，不要油腻。\n"
            ),
        ),
    ]
    conn.executemany(
        """
        INSERT INTO dj_profile_documents (doc_key, title, content, source)
        VALUES (?, ?, ?, 'user_answers_2026_07_06')
        ON CONFLICT(doc_key) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            source = excluded.source,
            updated_at = current_timestamp
        WHERE dj_profile_documents.source IN ('seed', 'system', 'user_answers_2026_07_06')
        """,
        documents,
    )
