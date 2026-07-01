# Step 139: 倒流 Daoliyu NAS 音乐服务接入计划

## 来源

OpenAPI 文件：

- `/Users/xuguopeng/Downloads/daoliyu-openapi.json`

服务信息：

- 标题：倒流 Daoliyu 音乐服务 API
- 版本：0.1.8
- 默认端口：5173
- 路径前缀：`/api`
- 认证：除 `/api/auth/login`、`/api/auth/bootstrap`、`/api/auth/bootstrap-admin` 外，其余接口需要 `Authorization: Bearer <token>`

## 实现策略

不在 Agent Server 里逐个重写 84 条 path / 100 个 method 级接口，而是实现一个稳定代理层：

```text
Agent Server /v1/music/... -> Daoliyu http://host.docker.internal:5173/api/...
```

这样好处是：

- 84 条 path / 100 个 method 级接口一次性覆盖。
- Daoliyu 后续增加接口时，不需要马上改 Agent Server。
- PC 端和未来手机端只连 Agent Server，不直接暴露音乐服务。
- Agent 后续可以把“听歌、播放、暂停、推荐、查歌单”等动作统一走 `/v1/music`。

## 已完成

- 新增 `services/agent-server/app/music.py`
- 新增 `DAOLIYU_BASE_URL` 配置
- Docker Compose 默认配置：
  - `DAOLIYU_BASE_URL=http://host.docker.internal:5173`
  - `extra_hosts=host.docker.internal:host-gateway`
- 新增接口：
  - `GET /v1/music/status`
  - `GET /v1/music/endpoints`
  - `ANY /v1/music/{full_path:path}`

## 代理规则

以下两种写法都支持：

```text
/v1/music/api/tracks -> /api/tracks
/v1/music/tracks     -> /api/tracks
```

登录示例：

```bash
curl -X POST https://os.xuguopeng.com/v1/music/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

带 token 调用：

```bash
curl https://os.xuguopeng.com/v1/music/api/tracks \
  -H 'Authorization: Bearer <daoliyu-token>'
```

## 安全注意

- 当前只是代理 Daoliyu token，不保存 Daoliyu 密码。
- 后续 PC 端保存 Daoliyu token 时应走系统 keychain。
- 管理后台接口，例如扫描、用户、元数据修改，后续 Agent 调用前必须走确认门。

## 下一步

1. 部署新版 Agent Server 到 NAS。
2. 测试：
   - `/v1/music/status`
   - `/v1/music/endpoints`
   - `/v1/music/api/auth/bootstrap`
3. PC 端设置页增加 Daoliyu 服务状态和 token 状态。
4. 聊天命令 `@音乐` 接入：
   - 查曲目
   - 查歌单
   - 播放
   - 暂停
   - 下一首
   - 调音量
