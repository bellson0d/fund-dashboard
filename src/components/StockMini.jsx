function StockMini({ name, change, type }) {
  const isUp = change > 0
  const isDown = change < 0

  return (
    <div className="flex items-center justify-between text-xs py-0.5 px-1.5 bg-white/30 rounded-md">
      <div className="flex-1 min-w-0">
        <span className="text-gray-700 truncate block">
          {name}
          {type === 'bond' && <span className="text-blue-400 ml-0.5">债</span>}
          {type === 'us_stock' && <span className="text-purple-400 ml-0.5">美</span>}
        </span>
      </div>
      <span className={`font-medium w-10 text-left ml-1 ${
        isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-gray-500'
      }`}>
        {isUp ? '+' : ''}{change.toFixed(1)}%
      </span>
    </div>
  )
}

export default StockMini
