# EdgeOne Pages 部署指南（Gitee + 边缘函数 + KV）

> 线上部署主路径。前端静态资源与 `/api` 后端都跑在腾讯 EdgeOne Pages，数据存 Pages KV，不再需要服务器或 Docker。
> 旧的 ClawCloud / VPS 方案保留在 [deploy-clawcloud.md](deploy-clawcloud.md)，仅作备用。

## 架构

```
浏览器
  │  https://fund.<你的域名>
  ▼
EdgeOne Pages
  ├─ 静态资源：dist（Vite 构建，HashRouter，无需 SPA 重写）
  └─ /api/*  → functions/api/[[default]].js（边缘函数，V8 + Web API）
                 ├─ 认证：PBKDF2-SHA256 + HttpOnly Cookie 会话
                 ├─ 数据：Pages KV（用户/会话/持仓/快照/变更）
                 └─ 行情代理：天天基金、东方财富
```

- 数据库由 SQLite 换成 **Pages KV**（边缘键值存储，1GB/账户，最终一致，60s 内全球同步）。
- 后端代码在 `functions/api/[[default]].js`，只使用 Web 标准 API（fetch / WebCrypto / Request / Response），不使用 Node 内置模块。
- 本地开发仍可用 `npm run dev` + `npm run dev:server`（Express + SQLite），两套后端接口一致。

## 一、准备仓库

代码已在 Gitee：`https://gitee.com/bellson0d/fund-dashboard`，分支 `feat/cloud-deploy`（合并后可改用 `master`）。

EdgeOne Pages 关联私有仓库需要授权 Gitee，首次导入时按控制台提示完成 OAuth 即可。

## 二、创建 Pages 项目

1. 打开 [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages)，点击 **创建项目**。
2. 选择 **导入 Git 仓库** → 授权并选择 `bellson0d/fund-dashboard` → 分支选 `feat/cloud-deploy`。
3. 构建配置：

| 配置项 | 值 |
|---|---|
| 框架预设 | Vite |
| 构建命令 | `npm run build:edge` |
| 输出目录 | `dist` |
| Node 版本 | 20.x |
| 环境变量 | 暂时不需要 |

> `build:edge` 等价于 `vite build --base=/`，保证资源路径是 `/assets/...`。不要用默认的 `npm run build`（那是给本地 `/fund-dashboard/` 路径用的）。

4. 点击 **部署**，等待构建完成（首次会装依赖，约几分钟）。

## 三、开通并绑定 KV（必须）

函数里的所有数据都存在 KV，未绑定会返回 `storage_unavailable`。

1. 控制台左侧 **KV 存储** → **立即申请**（开通账户，容量 1GB）。
2. **创建命名空间**，名称随意，例如 `fund-dashboard`。
3. 进入命名空间 → **关联项目** → 选择刚创建的 Pages 项目；或在项目详情 → **KV 存储** → **绑定命名空间**。
4. **变量名必须填 `KV`**（函数按 `KV` 读取绑定），一个项目只绑一个即可。
5. 重新部署一次，让绑定在运行时生效。

## 四、绑定域名（推荐）

1. 项目详情 → **域名管理** → **添加域名**，填 `fund.<你的域名>`。
2. 按提示在阿里云 DNS 添加 CNAME 记录（指向控制台给出的 `*.edgeone.app` 或类似目标）。
3. 等待证书自动签发（通常几分钟），之后用 `https://fund.<你的域名>` 访问。
4. 不绑域名也能用平台分配的预览域名，但预览域名带随机串、且部分浏览器对第三方 Cookie 更严格，正式使用建议绑自己的子域。

## 五、上线检查清单

按顺序执行，全部通过才算部署完成：

1. `curl -s https://<域名>/api/healthz` → `{"ok":true}`
2. 打开首页 → 注册账号（用户名 3–20 位字母数字下划线，密码 8–72 位且含字母和数字）→ 自动登录
3. 基金页出现卡片，净值/涨跌幅有数据（行情代理正常）
4. Admin 添加一只基金 → 刷新页面仍在（KV 写入成功）
5. 历史页“保存当前快照” → 列表出现一条 → 刷新仍在
6. 退出登录 → 回到登录页；重新登录 → 数据仍在
7. 项目里点一次 **重新部署**，部署完成后重新登录 → 数据仍在（证明 KV 不是临时存储）
8. 用另一台设备/手机打开同一地址 → 登录后看到同一份数据
9. 用 `curl -X PUT https://<域名>/api/portfolio/fund -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{"codes":[]}' -i` → `403 forbidden_origin`

## 六、旧数据迁移

旧版本地站点的数据在浏览器 localStorage 里，需要手动搬到新站：

1. 在旧站点（`http://localhost:3000/fund-dashboard/`）打开 DevTools Console，执行 `scripts/export-legacy-data.js` 的内容，会下载 `legacy-portfolio-YYYY-MM-DD.json`。
2. 新站点登录后进入 **Admin → 迁移数据**，选择该文件导入（合并模式，不覆盖已有数据）。
3. 到基金/股票页确认代码、添加时间、添加后涨幅都正确。

## 七、已知限制

| 项目 | 限制 | 影响 |
|---|---|---|
| KV 一致性 | 最终一致，60s 内全球同步 | 极端情况下刚写入的数据在另一地域短暂读不到；单人使用基本无感 |
| KV 容量 | 1GB/账户，单值 25MB | 快照 100 条、变更 500 条远低于上限 |
| 请求体 | 6MB | 导入 JSON 一般 <1MB |
| 函数时长 | 30s | 行情批量请求已控制在 20 只/批，正常远低于限制 |
| KV 调用范围 | 仅 Edge Functions 支持 | 因此后端用 `functions/`，不是 `node-functions/` |
| 会话 | HttpOnly + Secure + SameSite=Lax | 必须通过 HTTPS 访问（绑定域名后即可） |

## 八、常见问题

| 现象 | 原因与处理 |
|---|---|
| 接口返回 `storage_unavailable` | KV 未绑定或变量名不是 `KV`；绑定后需重新部署 |
| 页面 404 / 资源加载失败 | 构建命令用了 `npm run build`（产物路径带 `/fund-dashboard/`），改成 `npm run build:edge` |
| 登录后刷新又回到登录页 | 未用 HTTPS 访问（Cookie 带 Secure），或域名与预览域名混用导致跨站 |
| 行情空白 | 上游接口被限流；函数里已带浏览器 UA 与 referer，可稍后重试 |
| 写接口 403 `forbidden_origin` | 请求 Origin 与当前域名不一致；确认不是从别的域名调接口 |
| 部署后仍是旧代码 | 控制台确认部署的是最新 commit；Gitee 推送后需要触发部署（或开启自动部署） |

## 九、回滚

- 代码回滚：Gitee 回退 commit 后重新部署。
- 换回自建服务器：仓库仍保留 `Dockerfile`、`server.js` 与 `src/server/*`（Express + SQLite），按 [deploy-clawcloud.md](deploy-clawcloud.md) 或 VPS 方式部署即可；两套后端 API 路径一致，前端无需改动。
- 但两套后端数据不互通：KV 与 SQLite 之间请用 **导出/导入** 迁移。
