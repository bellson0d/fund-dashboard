// 旧版本地数据导出脚本
// 用法：在旧站（本地 http://localhost:3000）的浏览器 DevTools Console 中整段粘贴执行，
// 会自动下载 legacy-portfolio-<日期>.json；随后到新站 Admin →「迁移数据」上传该文件即可。
// 注意：必须在旧站的同源页面执行，否则读不到原来的 localStorage 数据。
(() => {
  const read = (key, fallback) => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch (error) {
      console.warn('读取失败:', key, error)
      return fallback
    }
  }

  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    lists: {
      fund: read('fundCodes', []),
      stock: read('stockCodes', [])
    },
    info: {
      fund: read('fundInfoCache', {}),
      stock: read('stockInfoCache', {})
    },
    addedMeta: {
      fund: read('fundAddedMeta', {}),
      stock: read('stockAddedMeta', {})
    },
    snapshots: read('portfolioSnapshots', []),
    changes: read('portfolioChangeLog', [])
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `legacy-portfolio-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)

  console.log(
    `已导出：基金 ${data.lists.fund.length} 只、股票 ${data.lists.stock.length} 只、` +
    `快照 ${data.snapshots.length} 条、变更记录 ${data.changes.length} 条`
  )
})()
