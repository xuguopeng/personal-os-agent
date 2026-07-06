from __future__ import annotations

import sqlite3
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


def migrate_database(conn: sqlite3.Connection) -> None:
    ensure_column(conn, "music_radio_episodes", "outro_audio_path", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "music_radio_episodes", "outro_duration_seconds", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "music_radio_episodes", "segments_json", "TEXT NOT NULL DEFAULT '[]'")


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
