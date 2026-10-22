// 顶部导航栏 - 路由切换 / 搜索 / 刷新 / 当前用户
import { useState } from 'react'
import { Search, RefreshCw, TrendingUp, LayoutDashboard, Settings, ChevronDown, ChevronUp, History, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Header({ searchQuery, onSearchChange, onRefresh, lastSyncTime, activeTab }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const formatTime = (date) => {
    if (!date) return '--:--'
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // 收起状态 - 只显示展开按钮
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
  const isHistory = activeTab === 'history'

  return (
    <header className="h-8 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-between px-2 sm:px-4 shadow-sm">
      <div className="flex items-center gap-1 sm:gap-3">
        <div className="flex items-center gap-1.5">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="投资看板"
            className="w-4 h-4 rounded"
          />
          <span className="text-white font-semibold text-xs sm:text-sm">投资看板</span>
        </div>
        <div className="flex gap-0.5 sm:gap-1">
          <button
            onClick={() => navigate('/fund')}
            className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded text-xs transition-colors ${
              isFund
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <LayoutDashboard size={12} />
            <span className="hidden sm:inline">Fund</span>
          </button>
          <button
            onClick={() => navigate('/stock')}
            className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded text-xs transition-colors ${
              isStock
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <TrendingUp size={12} />
            <span className="hidden sm:inline">Stock</span>
          </button>
          <button
            onClick={() => navigate('/admin')}
            className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded text-xs transition-colors ${
              isAdmin
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Settings size={12} />
            <span className="hidden sm:inline">Admin</span>
          </button>
          <button
            onClick={() => navigate('/history')}
            className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded text-xs transition-colors ${
              isHistory
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <History size={12} />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-4">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`搜索${isStock ? '股票' : '基金'}...`}
            className="w-full h-5 pl-7 pr-3 bg-white/90 text-xs rounded-full focus:outline-none focus:ring-1 focus:ring-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <span className="text-white/50 text-xs hidden md:inline">
          {formatTime(lastSyncTime)}
        </span>
        <span className="text-white/80 text-xs hidden sm:inline-block max-w-[8rem] truncate align-middle" title={user?.username}>
          {user?.username}
        </span>
        <button
          onClick={logout}
          className="p-1 text-white/70 hover:text-white transition-colors"
          title="退出登录"
        >
          <LogOut size={14} />
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
