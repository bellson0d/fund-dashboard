import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/fund-dashboard/',
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
        target: 'http://fund.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fundlist/, '/js/fundcode_search.js'),
      },
    },
  },
})
