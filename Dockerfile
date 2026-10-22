# 多阶段构建：前端构建 + 生产运行（含 SQLite 数据层）
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 线上部署在根路径 /（本地开发仍使用 /fund-dashboard/）
ENV VITE_BASE=/
RUN npm run build

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
COPY src/server ./src/server
# 服务端依赖的默认代码列表与共用常量
COPY src/data ./src/data
COPY src/shared ./src/shared
COPY --from=build /app/dist ./dist
RUN mkdir -p /data
# 不使用非 root 用户：平台挂载的持久卷通常由 root 拥有，切换用户会导致 SQLite 无法写入
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
