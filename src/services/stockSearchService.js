const API_URL = 'http://localhost:3001/api/search-stocks'

export async function searchStocks(keyword) {
  if (!keyword || keyword.trim().length === 0) {
    return []
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: keyword.trim()
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      return []
    }

    return data
  } catch (error) {
    console.error('Failed to search stocks:', error)
    return []
  }
}
