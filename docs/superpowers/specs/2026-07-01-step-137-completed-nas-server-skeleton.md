# Step 137 完成记录：NAS Agent Server 骨架

## 已完成

新增 NAS 服务端目录：

- `services/agent-server`

新增文件：

- `services/agent-server/README.md`
- `services/agent-server/requirements.txt`
- `services/agent-server/Dockerfile`
- `services/agent-server/app/config.py`
- `services/agent-server/app/db.py`
- `services/agent-server/app/models.py`
- `services/agent-server/app/repository.py`
- `services/agent-server/app/main.py`
- `docker-compose.yml`

## 当前服务能力

### 基础

- FastAPI 服务骨架。
- SQLite 自动初始化。
- Dockerfile。
- Docker Compose 服务定义。

### 数据表

- `module_blueprints`
- `external_assets`
- `skill_sources`
- `devices`
- `task_sessions`
- `task_steps`

### HTTP 接口

- `GET /health`
- `GET /v1/modules`
- `GET /v1/assets`
- `POST /v1/assets/scan`
- `GET /v1/skills`
- `POST /v1/skills/scan`
- `GET /v1/devices`
- `POST /v1/devices/register`
- `GET /v1/tasks`
- `POST /v1/tasks`

### WebSocket

- `WS /v1/ws/{device_id}`
- 当前支持连接确认和消息 ack。
- 后续用于 PC 执行器、未来 Flutter 手机端和 NAS 之间同步任务状态。

## 启动方式

本地开发：

```bash
cd services/agent-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8088 --reload
```

Docker：

```bash
docker compose up --build agent-server
```

健康检查：

```bash
curl http://127.0.0.1:8088/health
```

## 验证结果

- `python3 -m compileall services/agent-server/app`：通过。
- `CI=true pnpm build`：通过。
- `cargo test`：通过，32 个测试全部成功。
- `docker compose config`：未执行成功，因为当前机器没有 `docker` 命令。

## 下一步

Step 138: PC 端 NAS 连接配置。

小计划：

1. PC 设置页增加 NAS 服务地址。
2. 后端增加保存/读取 NAS 连接配置。
3. 前端增加“检测连接”按钮。
4. 调用 NAS `/health`。
5. 显示本地模式 / NAS 模式。
6. 先不自动同步数据，只打通连接状态。
