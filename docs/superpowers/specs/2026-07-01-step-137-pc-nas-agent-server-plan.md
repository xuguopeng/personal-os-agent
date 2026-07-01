# Step 137: PC 端 + NAS Agent Server 第一阶段计划

## 目标

先完成 PC 端和 NAS 服务端这一条主线。Flutter 手机端暂时不开发，但接口从第一天就按多端设计，避免以后返工。

最终结构：

```text
Tauri PC 端
  <-> NAS Agent Server
      <-> SQLite / 向量库 / 文件索引 / Skill 注册 / 任务日志
```

未来手机端加入后：

```text
Flutter 手机端
  <-> NAS Agent Server
  <-> Tauri PC 端执行器
```

## 阶段边界

### PC 端负责

- 桌面 UI 和本地工作台。
- 打开、读取、执行电脑本地项目。
- 调用本机 MCP、Palmier、本地文件系统。
- 管理本地安全密钥。
- 在 NAS 不可用时保留本地模式。

### NAS 服务端负责

- 长期记忆。
- 知识库和向量索引。
- 外部资产索引。
- Skill 注册中心。
- 聊天会话和任务日志。
- 多设备同步。
- PC 与未来手机端之间的指令中转。

## 技术选择

第一版使用 Python FastAPI。

原因：

- AI、Embedding、RAG、文件索引生态更直接。
- 后续接 Qdrant、Chroma、文档解析、图片/视频任务更省力。
- Docker 部署到 NAS 成本低。

第一版数据库：

- SQLite：先跑通服务端数据结构。
- 后续可升级 PostgreSQL。
- 向量库后续再接 Qdrant，不在本步骤实现。

## 本步骤实现内容

1. 新增 `services/agent-server`。
2. 新增 FastAPI 服务骨架。
3. 新增 Dockerfile。
4. 新增 `docker-compose.yml`。
5. 新增 SQLite 初始化逻辑。
6. 新增接口：
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
   - `WS /v1/ws/{device_id}`
7. 暂不接真实 AI 模型。
8. 暂不做公网鉴权，只预留 token 配置。

## 后续步骤

### Step 138: PC 端 NAS 连接配置

- 设置页增加 NAS 服务地址。
- 检测 NAS 连接状态。
- 显示本地模式 / NAS 模式。
- 支持手动同步模块蓝图、外部资产、Skill 来源。

### Step 139: PC 端设备注册

- PC 端注册为 `desktop_executor`。
- 服务端记录设备在线状态。
- WebSocket 连接 NAS。
- 先只接收 ping/任务广播，不执行危险动作。

### Step 140: 资产库 UI 接 NAS

- 资产库 UI 从 NAS 读取外部资产。
- NAS 不可用时回落本地 SQLite。
- 支持刷新扫描。

### Step 141: 任务日志同步

- PC 任务日志同步到 NAS。
- NAS 任务日志可以回放。
- 为未来手机端查看 PC 执行过程打基础。

## 安全规则

- 第一版 NAS 服务只监听内网。
- 默认不暴露公网。
- 不把密钥写入 NAS SQLite。
- 不自动运行 PC 本地命令。
- 任何发布、删除、付费调用、外部脚本执行都必须由 PC 端二次确认。

## 完成标准

- Docker 服务可以启动。
- `/health` 返回 ok。
- 资产、Skill、模块接口可返回数据。
- SQLite 数据库自动初始化。
- Python 文件可通过编译检查。
- PC 端后续可直接调用这些 API。
