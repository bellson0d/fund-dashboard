import Header from './Header'

function Layout({ children, searchQuery, onSearchChange, onRefresh, lastSyncTime, useRealApi, onApiToggle }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header 
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
        lastSyncTime={lastSyncTime}
        useRealApi={useRealApi}
        onApiToggle={onApiToggle}
      />
      <main className="p-4">
        {children}
      </main>
    </div>
  )
}

export default Layout
