// 全局布局 - 顶部 Header + 内容区
import { useLocation } from 'react-router-dom'
import Header from './Header'

function Layout({ children, searchQuery, onSearchChange, onRefresh, lastSyncTime }) {
  const location = useLocation()
  const activeTab = location.pathname.split('/')[1] || 'fund'

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
        lastSyncTime={lastSyncTime}
        activeTab={activeTab}
      />
      <main className="p-4">
        {children}
      </main>
    </div>
  )
}

export default Layout
