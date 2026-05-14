function StockMini({ name, change }) {
  const isUp = change > 0
  const isDown = change < 0

  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-gray-700 truncate max-w-[60%]">{name}</span>
      <span className={`font-medium ${
        isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-500'
      }`}>
        {isUp ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  )
}

export default StockMini
