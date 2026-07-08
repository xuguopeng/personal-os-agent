from __future__ import annotations

from pathlib import Path
from sqlite3 import Connection, Row
from uuid import uuid4


def row_to_dict(row: Row) -> dict:
    return dict(row)


def list_rows(conn: Connection, table: str, order_by: str) -> list[dict]:
    rows = conn.execute(f"SELECT * FROM {table} ORDER BY {order_by}").fetchall()
    return [row_to_dict(row) for row in rows]


def scan_default_assets(conn: Connection) -> list[dict]:
    home = Path.home()
    assets = [
        ("沐系列软件库", "software", "system", "Documents/徐徐如声/徐徐如声/软件/软件库.md", "自研软件路线图：沐影、沐音、沐声、沐阅、沐账。"),
        ("贴纸小铺表情包项目", "project", "sticker", "Documents/徐徐如声/徐徐如声/产品库/微信表情包/xu-biaoqing", "Tauri 2 + React 表情包工作台。"),
        ("表情包通用生成流程", "document", "sticker", "Documents/徐徐如声/徐徐如声/产品库/微信表情包/表情包通用生成流程.md", "微信静态 PNG 表情包制作标准。"),
        ("漫画应用索引", "document", "comic", "Documents/徐徐如声/徐徐如声/产品库/漫画应用/index.md", "漫画工作流索引。"),
        ("第一次战斗漫画项目", "comic_project", "comic", "Documents/徐徐如声/徐徐如声/产品库/漫画/第一次战斗", "已有漫画作品和公众号草稿。"),
        ("Tauri2Public", "project", "system", "Documents/徐郭鹏项目/徐-开发项目/Tauri2Public", "Tauri 2 公共代码参考。"),
        ("xu-ai", "project", "system", "Documents/徐郭鹏项目/徐-开发项目/xu-ai", "AI 桌面应用参考。"),
        ("MuAudio", "project", "music", "Documents/徐郭鹏项目/徐-开发项目/MuAudio", "AI 音乐电台和音乐推荐项目。"),
        ("NAS-music", "project", "music", "Documents/徐郭鹏项目/徐-开发项目/NAS-music", "NAS 音乐源参考。"),
        ("TauriVideo", "project", "video", "Documents/徐郭鹏项目/徐-开发项目/徐-AI视频生成/TauriVideo", "AI 视频生成和画布项目参考。"),
        ("Plotforge 小说桌面端", "project", "novel", "Documents/徐郭鹏项目/徐-开发项目/徐-写小说/desktop", "小说创作桌面项目参考。"),
        ("wxwrite 公众号写作", "project", "blog", "Documents/徐郭鹏项目/徐-开发项目/徐-公众号爆文生成/wxwrite", "公众号写作项目参考。"),
        ("Figma-design", "project", "design", "Documents/徐郭鹏项目/徐-开发项目/Figma-design", "设计稿生成参考。"),
    ]
    for name, kind, module_key, relative_path, summary in assets:
        conn.execute(
            """
            INSERT INTO external_assets (
                id, name, kind, module_key, source_path, summary, status,
                tags_json, last_scanned_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'reference', '[]', current_timestamp, current_timestamp, current_timestamp)
            ON CONFLICT(source_path) DO UPDATE SET
                name = excluded.name,
                kind = excluded.kind,
                module_key = excluded.module_key,
                summary = excluded.summary,
                last_scanned_at = current_timestamp,
                updated_at = current_timestamp
            """,
            (str(uuid4()), name, kind, module_key, str(home / relative_path), summary),
        )
    return list_rows(conn, "external_assets", "module_key ASC, kind ASC, name ASC")


def scan_default_skills(conn: Connection) -> list[dict]:
    home = Path.home()
    roots = [
        Path(__file__).resolve().parent / "radio_skills",
        home / "Documents/徐徐如声/徐徐如声/skills",
        home / "Documents/徐徐如声/徐徐如声/.trae/skills",
        home / "Documents/徐徐如声/徐徐如声/.claude/skills",
    ]
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*.md"):
            if any(part in {".git", "node_modules", "target", "dist", "build", ".dart_tool"} for part in path.parts):
                continue
            title = path.stem
            category = path.parent.name
            conn.execute(
                """
                INSERT INTO skill_sources (
                    id, title, category, source_path, summary, enabled, indexed, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, 0, current_timestamp, current_timestamp)
                ON CONFLICT(source_path) DO UPDATE SET
                    title = excluded.title,
                    category = excluded.category,
                    summary = excluded.summary,
                    updated_at = current_timestamp
                """,
                (
                    str(uuid4()),
                    title,
                    category,
                    str(path),
                    f"{category} Skill 来源，等待后续向量索引。",
                ),
            )
    return list_rows(conn, "skill_sources", "category ASC, title ASC")


def register_device(conn: Connection, name: str, device_type: str, role: str, device_id: str | None) -> dict:
    resolved_id = device_id or str(uuid4())
    conn.execute(
        """
        INSERT INTO devices (
            id, name, device_type, role, status, last_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'online', current_timestamp, current_timestamp, current_timestamp)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            device_type = excluded.device_type,
            role = excluded.role,
            status = 'online',
            last_seen_at = current_timestamp,
            updated_at = current_timestamp
        """,
        (resolved_id, name, device_type, role),
    )
    return row_to_dict(
        conn.execute("SELECT * FROM devices WHERE id = ?", (resolved_id,)).fetchone()
    )


def create_task(
    conn: Connection,
    title: str,
    module: str,
    source_device_id: str | None,
    target_device_id: str | None,
) -> dict:
    task_id = str(uuid4())
    conn.execute(
        """
        INSERT INTO task_sessions (
            id, title, module, status, source_device_id, target_device_id
        ) VALUES (?, ?, ?, 'pending', ?, ?)
        """,
        (task_id, title, module, source_device_id, target_device_id),
    )
    conn.execute(
        """
        INSERT INTO task_steps (
            id, session_id, step_type, module, input_summary, output_summary, status
        ) VALUES (?, ?, 'created', ?, ?, '任务已进入 NAS 队列。', 'success')
        """,
        (str(uuid4()), task_id, module, title),
    )
    return row_to_dict(conn.execute("SELECT * FROM task_sessions WHERE id = ?", (task_id,)).fetchone())
