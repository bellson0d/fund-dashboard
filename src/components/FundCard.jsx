// 基金卡片 - 显示净值/涨跌幅/前十大持仓
import StockMini from './StockMini'

function FundCard({ fund }) {
  const upCount = fund.holdings.filter(h => h.change > 0).length
  const downCount = fund.holdings.filter(h => h.change < 0).length
  const isUp = fund.change > 0
  const isDown = fund.change < 0
  const addedUp = fund.addedGain > 0
  const addedDown = fund.addedGain < 0

  // 持仓涨跌决定卡片色调
  let cardClass
  if (upCount > downCount) {
    cardClass = 'card-up'
  } else if (downCount > upCount) {
    cardClass = 'card-down'
  } else {
    cardClass = 'card-neutral'
  }

  return (
    <div className={`${cardClass} rounded-xl p-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-sm truncate text-gray-800 hover:text-gray-600 hover:underline cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); window.open(`https://fund.eastmoney.com/${fund.code}.html`, '_blank') }}
            title="点击查看天天基金详情"
          >{fund.name}</h3>
          <p className="text-xs text-gray-500 mt-0.25">{fund.code}</p>
        </div>
        <div className={`text-right ${
          isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-gray-500'
        }`}>
          <p className="text-lg font-bold">{fund.netValue.toFixed(4)}</p>
          <p className="text-xs font-medium">
            {isUp ? '+' : ''}{fund.change.toFixed(2)}%
          </p>
        </div>
      </div>

      {fund.addedAt && (
        <div className="flex items-center justify-between text-xs mt-0.5">
          <span className="flex items-center gap-1">
            <span className="text-gray-500">添加后</span>
            {fund.addedGain != null ? (
              <span className={`font-medium ${
                addedUp ? 'text-red-600' : addedDown ? 'text-green-600' : 'text-gray-500'
              }`}>
                {addedUp ? '+' : ''}{fund.addedGain.toFixed(2)}%
              </span>
            ) : (
              <span className="text-gray-400">--</span>
            )}
          </span>
          <span className="text-gray-400" title={`添加于 ${fund.addedAt}`}>{fund.addedDays}</span>
        </div>
      )}

      <div className="border-t border-gray-200/50 pt-0.5 mt-0.5 flex-1">
        <p className="text-xs text-gray-500 mb-0.25">持仓</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {fund.holdings.slice(0, 10).map((stock, index) => (
            <StockMini key={index} {...stock} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default FundCard
