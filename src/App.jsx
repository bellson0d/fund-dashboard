import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const [useRealApi, setUseRealApi] = useState(false)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    setLastSyncTime(new Date())
  }

  const handleApiToggle = () => {
    setUseRealApi(prev => !prev)
    handleRefresh()
  }

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
      onSearchChange={setSearchQuery}
      onRefresh={handleRefresh}
      lastSyncTime={lastSyncTime}
      useRealApi={useRealApi}
      onApiToggle={handleApiToggle}
    >
      <Routes>
        <Route path="/" element={<Dashboard searchQuery={searchQuery} refreshKey={refreshKey} useRealApi={useRealApi} />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Layout>
  )
}

export default App
