import Header from './Header'

function Layout({ children, searchQuery, onSearchChange, onRefresh }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header 
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
      />
      <main className="p-4">
        {children}
      </main>
    </div>
  )
}

export default Layout
