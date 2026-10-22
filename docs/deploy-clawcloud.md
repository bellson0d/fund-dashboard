# ClawCloud Run 部署与上线检查清单

> 目标：把基金看板部署到免费容器平台，任意设备登录后使用同一份数据；数据存 SQLite 文件并挂载持久卷。

## 1. 架构

```
浏览器 ──HTTPS──> ClawCloud 容器（node:24-slim）
                    ├── dist/          前端静态资源（Vite 构建）
                    ├── /api/*         行情代理 + 登录 + 业务 API
                    └── /data/data.db  SQLite（持久卷，单副本）
```

- 前端仍使用 HashRouter（`/#/fund`），因此刷新任意页面都不会 404。
- 站点挂在根路径 `/`；旧地址 `/fund-dashboard/*` 会 301 重定向到根路径。
- 本地开发保持 `/fund-dashboard/` 不变，互不影响。

## 2. 仓库准备

> 当前项目远程仓库是 Gitee（`origin`），而 ClawCloud Run 的代码源是 **GitHub**，
> 因此需要先把代码放到 GitHub 上，二选一：
>
> - **方式 A（推荐）** 新建一个 GitHub 空仓库（私有即可），本地加一个远程并推送：
>   ```bash
>   git remote add github https://github.com/<你的账号>/fund-dashboard.git
>   git push github master
>   ```
>   之后每次更新都执行 `git push github master`，或使用 Gitee 仓库的「镜像到 GitHub」功能自动同步。
> - **方式 B** 本机 Docker 可用时构建镜像并推到 Docker Hub / GHCR，
>   在 ClawCloud 选择 **Docker Image** 方式部署（无需 GitHub 仓库）。

1. 确认改动已合并回主分支（或直接部署 `feat/cloud-deploy` 分支）。
2. 仓库根目录必须包含 `Dockerfile`、`.dockerignore`、`server.js`、`src/server/`。
3. 在 ClawCloud 创建应用时选择对应的 GitHub 仓库与分支。

## 3. 在 ClawCloud Run 创建应用

1. 注册 / 登录 ClawCloud Run，进入 **App Launchpad**（应用启动台）。
2. 选择 **Create App → Docker / GitHub Repository**，授权并选择本仓库与分支。
3. 构建方式选择 **Dockerfile**（仓库已有），无需填写构建命令。
4. 区域选择离国内较近的节点（如新加坡 / 日本），避免选择欧美节点。
5. 容器配置：
   - 端口：`3000`（HTTP）
   - 实例数 / 副本数：**1**（SQLite 是单文件，不支持多副本同时写入）
   - 规格：0.5 核 / 512MB 起即可，免费额度（$5/月）足够
6. 存储卷（Volume）：
   - 新建卷并挂载到 **`/data`**
   - 这是数据库唯一持久化位置，**不挂载会导致每次重新部署数据丢失**
7. 环境变量（参考 `.env.example`）：

   | 变量 | 值 | 说明 |
   |---|---|---|
   | `NODE_ENV` | `production` | 启用静态资源托管与 SPA 兜底 |
   | `PORT` | `3000` | 容器监听端口 |
   | `DATA_DIR` | `/data` | SQLite 文件目录（指向持久卷） |
   | `APP_ORIGIN` | `https://<你的平台域名>` | 写接口 Origin 校验 + Cookie Secure |
   | `SESSION_TTL_DAYS` | `30` | 登录有效期 |
   | `SQLITE_JOURNAL_MODE` | `WAL` | 若卷为网络文件系统报错，改为 `DELETE` |
   | `LOGIN_RATE_LIMIT` | `5` | 15 分钟内允许的失败次数 |
   | `LOGIN_RATE_WINDOW_MIN` | `15` | 限流窗口（分钟） |

8. 点击部署，等待构建完成。首次构建需要 `npm ci` + `vite build`，耐心等待。
9. 打开平台分配的免费子域名，应看到登录页。

> 说明：免费额度的应用可能在长时间无访问后休眠，首次访问会有几秒冷启动；持久卷中的数据不受影响。

## 4. 上线检查清单

- [ ] 访问 `/` 返回登录页（非 502 / 404）
- [ ] `GET /api/healthz` 返回 `{"ok":true}`（容器健康检查也用这个地址）
- [ ] 注册一个账号（用户名 3–20 位字母数字下划线，密码至少 8 位且含字母和数字）
- [ ] 注册后能进入看板；Admin 中"重置默认"可恢复 24 只基金默认列表
- [ ] 手机流量（非代理网络）访问速度可接受
- [ ] 退出登录后刷新页面回到登录页；重新登录后数据仍在
- [ ] 再注册第二个账号，看不到第一个账号的数据（数据隔离）
- [ ] `/fund-dashboard/` 能 301 跳回 `/`
- [ ] 重新部署一次，确认登录状态与数据仍在（验证卷挂载正确）

## 5. 迁移旧版本地数据

旧版把数据存在浏览器 localStorage，需要一次性搬到新站：

1. 在**旧站**（本地 `http://localhost:3000`，也就是原来那个版本）打开页面，按 F12 打开 DevTools Console。
2. 把 [scripts/export-legacy-data.js](../scripts/export-legacy-data.js) 的全部内容粘贴执行，浏览器会下载 `legacy-portfolio-<日期>.json`。
3. 在新站登录账号 → **Admin → 迁移数据** → 选择该文件。
4. 弹窗会显示导入的基金/股票/快照/变更数量；页面自动刷新为导入后的数据。
5. 导入采用 **merge（只补缺，不覆盖已有）**：先保证新账号为空（或准备覆盖时用导出接口手工处理），
   才能完整保留旧列表的顺序。

> 迁移脚本必须在旧站同源页面执行，否则读不到原来的 localStorage。

## 6. 备份与恢复

- 全量导出：History 页「导出」按钮（`GET /api/export`，version 2 JSON，含持仓、名称缓存、添加信息、快照、变更）。
- 全量恢复：History 页「导入」走 `merge`；如需完全覆盖，可调用 `POST /api/import` 并传 `{"mode":"replace"}`。
- 数据库文件位于卷内 `/data/data.db`，WAL 模式下同目录还会有 `data.db-wal` / `data.db-shm`；
  直接复制时建议先停实例，或使用导出接口获取逻辑备份。

## 7. 常见问题

| 现象 | 处理 |
|---|---|
| 部署后登录立刻失效 | `APP_ORIGIN` 与实际访问域名不一致；Cookie 带了 `Secure` 但用 http 访问 |
| `/api/healthz` 500 | 卷未挂载或目录不可写；检查 `DATA_DIR` 是否指向 `/data` |
| SQLite 报 `disk I/O error` / 无法打开 | 网络卷不支持 WAL 共享内存，设置 `SQLITE_JOURNAL_MODE=DELETE` |
| 数据在重新部署后消失 | 卷没有挂到 `/data`，或覆盖了旧卷 |
| 行情接口偶发失败 | 上游（天天基金/东方财富）限流，属正常现象；页面会保留上次数据 |
| 国内访问慢 | 优先选新加坡/日本节点；确认使用平台分配的 https 域名直连，不经过代理 |

## 8. 回滚

- 平台侧：在应用详情里回退到上一个成功构建的版本。
- 代码侧：`git revert` 或切回 `master` 之前的提交重新部署。
- 数据侧：回滚代码不影响卷内数据；如需恢复旧数据，用最近一次导出的 JSON 通过“导入 → 覆盖”恢复。
