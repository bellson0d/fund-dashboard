import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本地开发/构建使用 /fund-dashboard/（兼容 GitHub Pages 子路径）
// 容器部署时通过 VITE_BASE=/ 将站点挂在根路径
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/fund-dashboard/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      '/api/fundgz': {
        target: 'http://fundgz.1234567.com.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fundgz/, '/js'),
      },
      '/api/pingzhong': {
        target: 'https://fund.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pingzhong/, '/pingzhongdata'),
      },
      '/api/fundlist': {
        target: 'https://fund.eastmoney.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/api\/fundlist/, '/js/fundcode_search.js'),
      },
      // 登录与业务数据由本地 node server.js（默认 3001）提供
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
})
