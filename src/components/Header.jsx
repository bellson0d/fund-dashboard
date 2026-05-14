import { Search, RefreshCw, LayoutDashboard, Settings } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

function Header({ searchQuery, onSearchChange, onRefresh }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <header className="h-8 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-white font-semibold text-sm">基金数据</div>
        <div className="flex gap-1">
          <button
            onClick={() => navigate('/')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              location.pathname === '/'
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <LayoutDashboard size={12} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => navigate('/admin')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              location.pathname === '/admin'
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Settings size={12} />
            <span>Admin</span>
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索基金名称或代码..."
            className="w-full h-5 pl-7 pr-3 bg-white/90 text-xs rounded-full focus:outline-none focus:ring-1 focus:ring-white"
          />
        </div>
      </div>

      <button
        onClick={onRefresh}
        className="p-1 text-white/70 hover:text-white transition-colors"
        title="刷新数据"
      >
        <RefreshCw size={16} />
      </button>
    </header>
  )
}

export default Header
