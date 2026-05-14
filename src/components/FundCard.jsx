import StockMini from './StockMini'

function FundCard({ fund }) {
  const isUp = fund.change > 0
  const isDown = fund.change < 0
  
  const cardClass = isUp 
    ? 'card-up' 
    : isDown 
      ? 'card-down' 
      : 'card-neutral'

  return (
    <div className={`${cardClass} rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-sm text-gray-800 truncate">{fund.name}</h3>
          <p className="text-xs text-gray-500">{fund.code}</p>
        </div>
        <div className={`text-right ${
          isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-500'
        }`}>
          <p className="text-lg font-bold">{fund.netValue.toFixed(4)}</p>
          <p className="text-xs font-medium">
            {isUp ? '+' : ''}{fund.change.toFixed(2)}%
          </p>
        </div>
      </div>
      
      <div className="border-t border-gray-200/50 pt-2 mt-2">
        <p className="text-xs text-gray-500 mb-1.5">持仓股票</p>
        <div className="space-y-0.5">
          {fund.holdings.slice(0, 5).map((stock, index) => (
            <StockMini key={index} {...stock} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default FundCard
