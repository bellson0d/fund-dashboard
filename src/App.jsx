// 应用入口 - 路由定义 / 全局状态 / 定时刷新
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Admin from './pages/Admin'

function App() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const [useRealApi, setUseRealApi] = useState(true)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    setLastSyncTime(new Date())
  }

  const handleApiToggle = () => {
    setUseRealApi(prev => !prev)
    handleRefresh()
  }

  const handleSearchChange = (value) => {
    setSearchQuery(value)
  }

  // 路由切换时清空搜索
  useEffect(() => {
    setSearchQuery('')
  }, [location.pathname])

  // 启动时立即刷新 + 每分钟自动刷新
  useEffect(() => {
    handleRefresh()
    const interval = setInterval(() => {
      handleRefresh()
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  return (
    <Layout
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      onRefresh={handleRefresh}
      lastSyncTime={lastSyncTime}
      useRealApi={useRealApi}
      onApiToggle={handleApiToggle}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/fund" replace />} />
        <Route path="/fund" element={<Dashboard searchQuery={searchQuery} refreshKey={refreshKey} useRealApi={useRealApi} />} />
        <Route path="/stock" element={<Stock searchQuery={searchQuery} refreshKey={refreshKey} />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Layout>
  )
}

export default App
