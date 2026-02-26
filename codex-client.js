/**
 * Codex API Client for Volume Tracking
 * Provides real-time and historical volume data from Codex
 */

const CODEX_API_URL = 'https://api.codex.io/graphql';

class CodexClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Query Codex GraphQL API
   */
  async query(query, variables = {}) {
    const response = await fetch(CODEX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Codex API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors.map(e => e.message).join(', ')}`);
    }

    return data.data;
  }

  /**
   * Get pairs for a token
   * @param {string} tokenAddress - Token contract address
   * @param {number} networkId - Network ID
   * @param {number} limit - Max number of pairs to return
   */
  async getPairsForToken(tokenAddress, networkId, limit = 10) {
    const query = `
      query GetPairs($tokenAddress: String!, $networkId: Int!, $limit: Int) {
        listPairsWithMetadataForToken(
          tokenAddress: $tokenAddress
          networkId: $networkId
          limit: $limit
        ) {
          results {
            pair {
              id
              address
              networkId
              token0 {
                address
                symbol
                name
              }
              token1 {
                address
                symbol
                name
              }
              exchange {
                name
                address
              }
            }
            volume
            liquidity
            backingToken {
              symbol
              address
            }
          }
        }
      }
    `;

    const data = await this.query(query, { tokenAddress, networkId, limit });
    return data?.listPairsWithMetadataForToken?.results || [];
  }

  /**
   * Get historical volume data (OHLCV bars)
   * @param {string} pairAddress - Pair contract address
   * @param {number} networkId - Network ID
   * @param {number} from - Start timestamp (seconds)
   * @param {number} to - End timestamp (seconds)
   * @param {string} resolution - Timeframe: 1S, 5S, 15S, 30S, 1, 5, 15, 30, 60, 240, 720, 1D, 7D
   */
  async getBars(pairAddress, networkId, from, to, resolution = '1D') {
    const query = `
      query GetBars($pairAddress: String!, $networkId: Int!, $from: Int!, $to: Int!, $resolution: String!) {
        getBars(
          pairAddress: $pairAddress
          networkId: $networkId
          from: $from
          to: $to
          resolution: $resolution
        ) {
          bars {
            timestamp
            open
            high
            low
            close
            volume
            volumeUSD: volume
            txns
            uniqueBuyers
            uniqueSellers
          }
          pair {
            address
            token0 {
              symbol
              address
            }
            token1 {
              symbol
              address
            }
          }
        }
      }
    `;

    const data = await this.query(query, { 
      pairAddress, 
      networkId, 
      from, 
      to, 
      resolution 
    });
    
    return data?.getBars || { bars: [], pair: null };
  }

  /**
   * Get 24h volume for a specific pair
   */
  async get24hVolume(pairAddress, networkId) {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    
    const data = await this.getBars(pairAddress, networkId, oneDayAgo, now, '1D');
    
    if (!data.bars || data.bars.length === 0) {
      return { volumeUSD: 0, txns: 0 };
    }

    const bar = data.bars[0];
    return {
      volumeUSD: parseFloat(bar.volume || 0),
      txns: parseInt(bar.txns || 0),
      uniqueBuyers: parseInt(bar.uniqueBuyers || 0),
      uniqueSellers: parseInt(bar.uniqueSellers || 0),
    };
  }

  /**
   * Get custom date range volume
   * @param {string} pairAddress - Pair address
   * @param {number} networkId - Network ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getVolumeForDateRange(pairAddress, networkId, startDate, endDate) {
    const from = Math.floor(startDate.getTime() / 1000);
    const to = Math.floor(endDate.getTime() / 1000);
    const days = Math.ceil((endDate - startDate) / (1000 * 86400));
    
    // Use 1D resolution for date ranges > 1 day, 1H for shorter ranges
    const resolution = days > 1 ? '1D' : '60';
    
    const data = await this.getBars(pairAddress, networkId, from, to, resolution);
    
    if (!data.bars || data.bars.length === 0) {
      return { volumeUSD: 0, txns: 0, bars: [] };
    }

    // Aggregate volume across all bars
    let totalVolume = 0;
    let totalTxns = 0;
    
    for (const bar of data.bars) {
      totalVolume += parseFloat(bar.volume || 0);
      totalTxns += parseInt(bar.txns || 0);
    }

    return {
      volumeUSD: totalVolume,
      txns: totalTxns,
      bars: data.bars,
      pair: data.pair,
    };
  }

  /**
   * Find pair by token symbols
   * @param {string} tokenA - First token symbol (e.g., "FOGO")
   * @param {string} tokenB - Second token symbol (e.g., "iFOGO")
   * @param {string} fogoTokenAddress - FOGO token address to search from
   * @param {number} networkId - Network ID
   */
  async findPairBySymbols(tokenA, tokenB, fogoTokenAddress, networkId) {
    const pairs = await this.getPairsForToken(fogoTokenAddress, networkId, 50);
    
    for (const result of pairs) {
      const pair = result.pair;
      const symbols = [
        pair.token0.symbol?.toUpperCase(),
        pair.token1.symbol?.toUpperCase(),
      ];
      
      const lookingFor = [tokenA.toUpperCase(), tokenB.toUpperCase()];
      
      // Check if pair contains both tokens
      if (lookingFor.every(sym => symbols.includes(sym))) {
        return {
          pairAddress: pair.address,
          networkId: pair.networkId,
          token0: pair.token0,
          token1: pair.token1,
          exchange: pair.exchange,
          volume24h: result.volume,
          liquidity: result.liquidity,
        };
      }
    }
    
    return null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CodexClient };
}
