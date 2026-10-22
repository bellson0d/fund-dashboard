// 登录页 - 登录 / 注册双 tab
import { useState } from 'react'
import { Loader2, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  const switchMode = (next) => {
    setMode(next)
    setErrorMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    setErrorMessage('')
    setSubmitting(true)
    try {
      if (isRegister) {
        await register(username.trim(), password)
      } else {
        await login(username.trim(), password)
      }
    } catch (error) {
      setErrorMessage(error?.message || '操作失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="投资看板" className="w-7 h-7 rounded" />
          <h1 className="text-lg font-semibold text-gray-800">投资看板</h1>
        </div>
        <p className="text-xs text-gray-500 mb-4">登录后即可在任意设备查看同一份持仓数据</p>

        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm rounded-md transition ${
              !isRegister ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LogIn size={14} />
            登录
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm rounded-md transition ${
              isRegister ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus size={14} />
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="3–20 位字母、数字或下划线"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder={isRegister ? '至少 8 位，含字母和数字' : '请输入密码'}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {errorMessage && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg hover:opacity-90 disabled:opacity-60 transition"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {isRegister ? '注册并登录' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
