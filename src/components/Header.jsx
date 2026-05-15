import { useState } from 'react'
import { Search, RefreshCw, TrendingUp, LayoutDashboard, Settings, ChevronDown, ChevronUp, Database, Server } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

function Header({ searchQuery, onSearchChange, onRefresh, lastSyncTime, useRealApi, onApiToggle, activeTab }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const formatTime = (date) => {
    if (!date) return '--:--'
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="w-full h-6 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white/70 hover:text-white transition-colors"
      >
        <ChevronUp size={14} className="mr-1" />
        <span className="text-xs">展开顶部</span>
      </button>
    )
  }

  const isFund = activeTab === 'fund'
  const isStock = activeTab === 'stock'
  const isAdmin = activeTab === 'admin'

  return (
    <header className="h-8 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-white font-semibold text-sm">投资看板</div>
        <div className="flex gap-1">
          <button
            onClick={() => navigate('/fund')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              isFund
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <LayoutDashboard size={12} />
            <span>Fund</span>
          </button>
          <button
            onClick={() => navigate('/stock')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              isStock
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <TrendingUp size={12} />
            <span>Stock</span>
          </button>
          <button
            onClick={() => navigate('/admin')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              isAdmin
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
            placeholder={`搜索${isStock ? '股票' : '基金'}名称或代码...`}
            className="w-full h-5 pl-7 pr-3 bg-white/90 text-xs rounded-full focus:outline-none focus:ring-1 focus:ring-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-white/50 text-xs hidden sm:inline">
          {formatTime(lastSyncTime)}
        </span>
        <button
          onClick={onApiToggle}
          className={`p-1 transition-colors flex items-center gap-1 ${
            useRealApi 
              ? 'text-green-300 hover:text-green-200' 
              : 'text-white/50 hover:text-white'
          }`}
          title={useRealApi ? '使用模拟数据' : '使用真实API'}
        >
          {useRealApi ? <Database size={14} /> : <Server size={14} />}
          <span className="text-xs hidden sm:inline">{useRealApi ? '真实' : '模拟'}</span>
        </button>
        <button
          onClick={onRefresh}
          className="p-1 text-white/70 hover:text-white transition-colors"
          title="刷新数据"
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-white/70 hover:text-white transition-colors"
          title="收起顶部"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </header>
  )
}

export default Header
