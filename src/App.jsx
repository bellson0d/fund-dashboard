// 应用入口 - 路由定义 / 全局状态 / 定时刷新（页面不可见时自动暂停）
import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Admin from './pages/Admin'
import History from './pages/History'

function App() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const [useRealApi, setUseRealApi] = useState(true)
  const intervalRef = useRef(null)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    setLastSyncTime(new Date())
  }

  const handleApiToggle = () => {
    setUseRealApi(prev => !prev)
    handleRefresh()
  }

  // 路由切换时清空搜索
  useEffect(() => {
    setSearchQuery('')
  }, [location.pathname])

  // 页面可见时才轮询，后台标签页自动暂停，切回时立即刷新
  useEffect(() => {
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      handleRefresh()
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          handleRefresh()
        }
      }, 60000)
    }

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return (
    <Layout
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onRefresh={handleRefresh}
      lastSyncTime={lastSyncTime}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/fund" replace />} />
        <Route path="/fund" element={<Dashboard searchQuery={searchQuery} refreshKey={refreshKey} useRealApi={useRealApi} />} />
        <Route path="/stock" element={<Stock searchQuery={searchQuery} refreshKey={refreshKey} />} />
        <Route path="/admin" element={<Admin useRealApi={useRealApi} onApiToggle={handleApiToggle} />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Layout>
  )
}

export default App
