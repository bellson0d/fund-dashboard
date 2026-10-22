// 内存级数据缓存 - 用于跨路由切换保留上次拉取的数据
// 仅在页面会话内有效（刷新/重开页面即清空），因此"全新打开"仍会走骨架屏
const store = new Map()

export function readCache(key) {
  return store.has(key) ? store.get(key) : null
}

export function writeCache(key, value) {
  store.set(key, value)
}
