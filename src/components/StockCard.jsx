// 股票卡片 - 显示名称/代码/价格/涨跌幅，标题可跳转百度金融详情
function StockCard({ stock }) {
  const isUp = stock.change > 0
  const isDown = stock.change < 0
  const addedUp = stock.addedGain > 0
  const addedDown = stock.addedGain < 0

  // 构造百度金融个股链接
  // 内部前缀: 0./1.=A股, 105.=美股, 116.=港股
  const getStockUrl = (code) => {
    if (!code) return 'https://finance.baidu.com/'

    // A股: ab-{6位代码}
    if (code.startsWith('0.') || code.startsWith('1.')) {
      return `https://finance.baidu.com/stock/ab-${code.substring(2)}`
    }
    // 美股: us-{ticker}
    if (code.startsWith('105.')) {
      return `https://finance.baidu.com/stock/us-${code.substring(4)}`
    }
    // 港股: hk-{代码}
    if (code.startsWith('116.')) {
      return `https://finance.baidu.com/stock/hk-${code.substring(4)}`
    }
    // 兜底 A 股格式
    return `https://finance.baidu.com/stock/ab-${code.replace(/^[01]\./, '')}`
  }

  const stockUrl = getStockUrl(stock.code)

  const cardClass = isUp
    ? 'card-up'
    : isDown
      ? 'card-down'
      : 'card-neutral'

  return (
    <div className={`${cardClass} rounded-xl p-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-sm truncate text-gray-800 hover:text-gray-600 hover:underline cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); window.open(stockUrl, '_blank') }}
            title="点击查看详情"
          >{stock.name}</h3>
          <p className="text-xs text-gray-500 mt-0.25">{stock.code}</p>
        </div>
        <div className={`text-right ${
          isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-gray-500'
        }`}>
          <p className="text-lg font-bold">{stock.price?.toFixed(2) || '--'}</p>
          <p className="text-xs font-medium">
            {isUp ? '+' : ''}{stock.change.toFixed(2)}%
          </p>
        </div>
      </div>

      {stock.addedAt && (
        <div className="flex items-center justify-between text-xs mt-0.5 pt-0.5 border-t border-gray-200/50">
          <span className="flex items-center gap-1">
            <span className="text-gray-500">添加后</span>
            {stock.addedGain != null ? (
              <span className={`font-medium ${
                addedUp ? 'text-red-600' : addedDown ? 'text-green-600' : 'text-gray-500'
              }`}>
                {addedUp ? '+' : ''}{stock.addedGain.toFixed(2)}%
              </span>
            ) : (
              <span className="text-gray-400">--</span>
            )}
          </span>
          <span className="text-gray-400" title={`添加于 ${stock.addedAt}`}>{stock.addedDays}</span>
        </div>
      )}
    </div>
  )
}

export default StockCard
