// 简易并发限流器：同一时刻最多 limit 个任务在飞行，其余排队等待
// 浏览器端 stock-sdk 无内置限流（其 retry/rateLimit 治理仅 Node 端生效），
// 用于避免突发并发被数据源丢弃连接（如东财返回 ERR_EMPTY_RESPONSE）
export function createLimiter(limit = 4) {
  let active = 0
  const queue = []

  const next = () => {
    if (active >= limit || queue.length === 0) return
    active += 1
    const { fn, resolve, reject } = queue.shift()
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active -= 1
        next()
      })
  }

  return function run(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject })
      next()
    })
  }
}
