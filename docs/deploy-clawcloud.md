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

> 当前项目远程仓库是 Gitee（`origin`），而 ClawCloud Run 部署时填的是**镜像地址**，
> 因此需要先把代码放到 GitHub，由 GitHub Actions 构建镜像并推送到 GHCR（无需本机 Docker）：
>
> - **方式 A（推荐，无需本机 Docker）**
>   1. 新建一个 GitHub 空仓库（public 最省事；private 也行，见下方镜像可见性说明）。
>   2. 本地加远程并推送**改造分支**：
>      ```bash
>      git remote add github https://github.com/<你的账号>/fund-dashboard.git
>      git push github feat/cloud-deploy
>      ```
>   3. 推送后仓库的 **Actions** 会自动运行 `Build and publish image`，
>      产出 `ghcr.io/<你的账号>/fund-dashboard:latest`。
>   4. 打开 GitHub 仓库 → **Packages** → 该镜像 → **Package settings → Change visibility → Public**，
>      否则 ClawCloud 无法匿名拉取（也可以在 ClawCloud 里配置镜像仓库凭据）。
>      私有镜像的凭据：Image 选 **Private**，Username 填 GitHub 用户名，Password 填
>      **Personal Access Token**（classic 勾选 `read:packages`；fine-grained 需 `Packages: Read`）。
>   5. 部署时选择 `feat/cloud-deploy`；上线验证通过、合并 master 后，再改为推送并部署 `master`。
> - **方式 B（本机 Docker 可用时）** 本地构建并推到 ClawCloud 私有仓库：
>   ```bash
>   docker build -t registry.clawcloud.io/<账号>/fund-dashboard:latest .
>   docker push registry.clawcloud.io/<账号>/fund-dashboard:latest
>   ```
>   在 ClawCloud 部署时 Image 选 Private 并填写该地址。

> 账号要求：ClawCloud 免费额度需要用**注册满 6 个月的 GitHub 账号**登录领取（$5/月）。

1. 确认要部署的分支就是当前验证过的分支（改造阶段为 `feat/cloud-deploy`）。
2. 仓库根目录必须包含 `Dockerfile`、`.dockerignore`、`server.js`、`src/server/`、`.github/workflows/docker-publish.yml`。
3. GitHub Actions 构建完成后，先确认镜像地址可访问，再去 ClawCloud 创建应用。
4. 新建仓库不要勾选 README / .gitignore / license，否则首次推送会因历史不相关被拒。

## 3. 在 ClawCloud Run 创建应用

1. 注册 / 登录 ClawCloud Run，进入 **App Launchpad**（应用启动台）。
2. 点击 **Create App**，按控制台表单填写：
   - **Basic**：Application Name 任意（如 `fund-dashboard`）；Image 选 **Public**；
     Image Name 填 `ghcr.io/<你的账号>/fund-dashboard:latest`（若镜像设为私有，则选 Private 并配置凭据）
   - **Usage**：Fixed；Replicas `1`；CPU `1`；Memory `512M`
   - **Network**：Container Port `3000`；Public Access 打开
3. 区域选择离国内较近的节点（如新加坡 / 日本），避免选择欧美节点。
4. 存储（Local Storage）：
   - 添加 `1G` 存储，挂载路径填 **`/data`**
   - 这是数据库唯一持久化位置，**不挂载会导致每次重新部署数据丢失**
5. 环境变量（参考 `.env.example`）：

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

6. 点击 **Deploy Application**，等待公共地址状态变为 **Available**（首次拉取镜像需要几分钟）。
7. 打开平台分配的免费子域名，应看到登录页。
8. 后续代码更新：重新推送分支触发 Actions 生成新镜像，再在应用右上角点 **Update** 重新拉取。

> 说明：免费额度的应用可能在长时间无访问后休眠，首次访问会有几秒冷启动；持久卷中的数据不受影响。

## 4. 上线检查清单

- [ ] 访问 `/` 返回登录页（非 502 / 404）
- [ ] `GET /api/healthz` 返回 `{"ok":true}`（容器健康检查也用这个地址）
- [ ] 注册一个账号（用户名 3–20 位字母数字下划线，密码至少 8 位且含字母和数字）
- [ ] 注册后能进入看板；Admin 中"重置默认"可恢复 24 只基金默认列表
- [ ] 基金卡片能显示净值与 TOP10 持仓（验证容器内 `/api/pingzhong` 代理可用）
- [ ] Admin 添加基金时输入代码能搜到结果（验证 `/api/fundlist` 代理可用，非 502/超时）
- [ ] 股票页能显示行情（浏览器直连 HTTPS 上游，非代理）
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
| 镜像拉取失败 / ImagePullBackOff | GHCR 包仍是 Private；在 Packages 里改成 Public，或在 ClawCloud 配置镜像仓库凭据 |
| Actions 页看不到工作流 | 仓库 Actions 曾被关闭；Settings → Actions → General 选 Allow all 后，需推送一次**新增/修改工作流文件**的提交才会重新注册 |
| `/api/healthz` 500 | 卷未挂载或目录不可写；检查 `DATA_DIR` 是否指向 `/data` |
| SQLite 报 `disk I/O error` / 无法打开 | 网络卷不支持 WAL 共享内存，设置 `SQLITE_JOURNAL_MODE=DELETE` |
| 数据在重新部署后消失 | 卷没有挂到 `/data`，或覆盖了旧卷 |
| 行情接口偶发失败 | 上游（天天基金/东方财富）限流，属正常现象；页面会保留上次数据 |
| 国内访问慢 | 优先选新加坡/日本节点；确认使用平台分配的 https 域名直连，不经过代理 |

## 8. 回滚

- 平台侧：在应用详情里回退到上一个成功构建的版本。
- 代码侧：`git revert` 或切回 `master` 之前的提交重新部署。
- 数据侧：回滚代码不影响卷内数据；如需恢复旧数据，用最近一次导出的 JSON 通过“导入 → 覆盖”恢复。
