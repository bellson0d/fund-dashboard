import { useState, useEffect, useLocation } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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

  useEffect(() => {
    setSearchQuery('')
  }, [location.pathname])

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
