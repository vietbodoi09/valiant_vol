// Proxy API for Valiant pools data
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { page = 1, limit = 50, interval = '24h' } = req.query;
    
    const valiantUrl = `https://mainnet-api.valiant.trade/api/v1/pools/paginated?page=${page}&limit=${limit}&interval=${interval}`;
    
    const response = await fetch(valiantUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://valiant.trade/',
        'Origin': 'https://valiant.trade'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Valiant API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from Valiant API',
      message: error.message 
    });
  }
}
