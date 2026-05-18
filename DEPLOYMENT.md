# Fund Dashboard - 部署说明

## 版本信息
- 当前版本: v0.1.0
- 发布日期: 2025-01-22

## 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0
- PM2 (可选，用于生产环境)

## 开发环境

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
# 启动前端开发服务器 (端口: 5173)
npm run dev

# 启动后端API服务器 (端口: 3001)
npm run dev:server
```

## 生产环境

### 构建生产版本
```bash
npm run build
```

### 使用PM2启动

#### 安装PM2 (如果未安装)
```bash
npm install -g pm2
```

#### 启动生产服务
```bash
# 生产环境 (端口: 3000)
pm2 start ecosystem.config.cjs

# 或者使用npm脚本
npm start
```

#### PM2常用命令
```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs fund-dashboard

# 重启应用
pm2 restart fund-dashboard

# 停止应用
pm2 stop fund-dashboard

# 删除应用
pm2 delete fund-dashboard

# 监控
pm2 monit
```

## 端口说明
- **开发环境**:
  - 前端: 5173 (Vite开发服务器)
  - 后端API: 3001

- **生产环境**:
  - 应用服务: 3000 (Express服务器，包含前端静态文件和API)

## 访问地址
- 开发环境: http://localhost:5173/fund-dashboard/
- 生产环境: http://localhost:3000/fund-dashboard/

## 目录结构
```
fund-dashboard/
├── dist/                  # 构建输出目录
├── logs/                  # PM2日志目录
├── src/                   # 源代码
├── server.js              # Express服务器
├── ecosystem.config.cjs   # PM2配置文件
└── package.json           # 项目配置
```

## 环境变量
- `NODE_ENV`: 环境模式 (development/production)
- `PORT`: 服务端口 (默认: 开发3001，生产3000)
