# Operate Log

## 2026-07-01

- 将 NAS Agent Server 的 Docker 数据挂载从匿名 volume 改为绿联 NAS 宿主机路径：`/volume1/docker/personal-os-agent/data:/data`。
- 新增 `data/README.md` 和 `data/secrets/daoliyu.env.example`，用于在 NAS 文件管理里创建 `/data/secrets/daoliyu.env`。
- 更新 `.gitignore`：继续忽略真实数据库和真实 `.env` 密钥文件，但允许提交数据目录说明和示例模板。
- 移除 `docker-compose.yml` 里的空 `DAOLIYU_USERNAME` / `DAOLIYU_PASSWORD`，避免空环境变量覆盖 `/data/secrets/daoliyu.env`。
- 调整服务端配置读取逻辑：环境变量为空字符串时视为未配置，继续读取 env 文件。
- 音乐工作台接入 NAS Agent Server 的 Daoliyu 登录状态、播放器、曲目和歌单概览；登录状态只显示在音乐模块。
- NAS Agent Server 增加 CORS 允许规则，方便 Tauri/Web 预览直接读取 `https://os.xuguopeng.com/v1/music/*`。
