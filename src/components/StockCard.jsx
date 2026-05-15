function StockCard({ stock }) {
  const isUp = stock.change > 0
  const isDown = stock.change < 0

  const cardClass = isUp 
    ? 'card-up' 
    : isDown 
      ? 'card-down' 
      : 'card-neutral'

  return (
    <div className={`${cardClass} rounded-xl p-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-gray-800 truncate">{stock.name}</h3>
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
    </div>
  )
}

export default StockCard