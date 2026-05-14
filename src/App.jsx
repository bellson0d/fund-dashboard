import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <Layout 
      searchQuery={searchQuery} 
      onSearchChange={setSearchQuery}
      onRefresh={handleRefresh}
    >
      <Routes>
        <Route path="/" element={<Dashboard searchQuery={searchQuery} refreshKey={refreshKey} />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Layout>
  )
}

export default App
