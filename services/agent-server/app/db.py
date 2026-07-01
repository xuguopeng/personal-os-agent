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
        seed_modules(conn)


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
