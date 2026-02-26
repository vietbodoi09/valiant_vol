// Valiant DEX Volume Tracker - DEPLOYED VERSION
// Tracks ALL swap volume with correct price and pool detection
// GitHub: https://github.com/vietbodoi09/valiant_vol

// All Valiant Pools with vault addresses (from transaction analysis)
const VALIANT_POOLS = {
  'HULdR8aMSxJAiNJmrTBcfKN4Zq6FgG33AHbQ3nDD8P5E': { 
    name: 'FOGO-iFOGO', 
    tokenA: 'FOGO', 
    tokenB: 'iFOGO',
    vaultA: '3iKBqsoRF6rkAVAhvf46BUBEse51HTvQPSaiLFrC1TkQ',  // FOGO vault
    vaultB: 'EHvGQWaGX1TThxSJXufwzqDaKcdXStRHBcs2VMtNg56q'   // iFOGO vault
  },
  'J7mxBLSz51Tcbog3XsiJTAXS64N46KqbpRGQmd3dQMKp': { 
    name: 'FOGO-USDC', 
    tokenA: 'FOGO', 
    tokenB: 'USDC',
    vaultA: '5Hi57na7wCbQ2b7D3QXRPAy9b4tsT1S5WWeXJ7WcDga7',  // FOGO vault
    vaultB: 'Dfyuf7jjpZ1xSKSBTYLc8i6HGBnrEn8429b9ziDDgNBo'   // USDC vault
  },
  'Be2eoA9g1Yp8WKqMM14tXjSHuYCudaPpaudLTmC4gizp': { name: 'FOGO-stFOGO', tokenA: 'FOGO', tokenB: 'stFOGO' },
  'DjM47hJzwQmsXwRRhsEWsjRVt4vXfEmZTDAP1zhM6XKF': { name: 'USDC-FISH', tokenA: 'USDC', tokenB: 'FISH' },
  '2exTq4dyaUa1mwXytfMSZ9r5BAcZ98L2zawBQDMfaU9o': { name: 'USDC-wSOL', tokenA: 'USDC', tokenB: 'wSOL' },
  '2zKEnSqCVwPUgR6UkNDr6U5PYGpfwXFrV1pT9LRxQCtk': { name: 'FOGO-CHASE', tokenA: 'FOGO', tokenB: 'CHASE' },
  'HEv4767Y7NwPm367bHuunuhcjbsgVpsybT7etovqc9KR': { name: 'FOGO-FISH Classic', tokenA: 'FOGO', tokenB: 'FISH Classic' },
  'vnt1u7PzorND5JjweFWmDawKe2hLWoTwHU6QKz6XX98': { name: 'wFOGO-iFOGO', tokenA: 'wFOGO', tokenB: 'iFOGO' },
};

// Token info
const TOKEN_INFO = {
  'So11111111111111111111111111111111111111112': { name: 'FOGO', decimals: 9 },
  'HLc5qava5deWKeoVkN9nsu9RrqqD8PoHaGsvQzPFNbxR': { name: 'wFOGO', decimals: 9 },
  'uSd2czE61Evaf76RNbq4KPpXnkiL3irdzgLFUMe3NoG': { name: 'USDC', decimals: 6 },
  'Brasa3xzkSC9XqMBEcN9v53x4oMkpb1nQwfaGMyJE88b': { name: 'stFOGO', decimals: 9 },
  'iFoGoY5nMWpuMJogR7xjUAWDJtygHDF17zREeP4MKuD': { name: 'iFOGO', decimals: 9 },
  'F1SHsk3rbKUJp28MQyyqtmfoJqnrkVUuZYK5ymGW4ZAr': { name: 'FISH', decimals: 9 },
  'F1SHuJ3sFF2wJoYbUJxK4iZ6CYg6MakFj8q6QHACFd4s': { name: 'FISH Classic', decimals: 9 },
  'GPK7grvKT8kQPMYsgAN8N537XUNdJLs3WsnXkUNfpump': { name: 'CHASE', decimals: 6 },
};

// ============================================
// CONSTANTS FROM FOGO AGENT KIT SDK
// ============================================
const TOKENS = {
  FOGO: 'So11111111111111111111111111111111111111112',
  USDC: 'uSd2czE61Evaf76RNbq4KPpXnkiL3irdzgLFUMe3NoG',
  IFOGO: 'iFoGoY5nMWpuMJogR7xjUAWDJtygHDF17zREeP4MKuD',
  STFOGO: 'Brasa3xzkSC9XqMBEcN9v53x4oMkpb1nQwfaGMyJE88b',
  WFOGO: 'HLc5qava5deWKeoVkN9nsu9RrqqD8PoHaGsvQzPFNbxR', // wSOL address used as wrapped FOGO
};

const POOLS = {
  FOGO_IFOGO: 'HULdR8aMSxJAiNJmrTBcfKN4Zq6FgG33AHbQ3nDD8P5E',
  FOGO_USDC: 'J7mxBLSz51Tcbog3XsiJTAXS64N46KqbpRGQmd3dQMKp',
  FOGO_STFOGO: 'Be2eoA9g1Yp8WKqMM14tXjSHuYCudaPpaudLTmC4gizp',
};

const DECIMALS = {
  FOGO: 9,
  USDC: 6,
  IFOGO: 9,
  STFOGO: 9,
  WFOGO: 9,
};

// Codex API Configuration
// Default API key for public access - users can override with their own key
const CODEX_CONFIG = {
  API_KEY: 'ca4a6df8c99ae58f40aa0414c2d5d0b19d0763d4', // Production key
  NETWORK_ID: 150601, // Fogo network ID in Codex
  API_URL: 'https://graph.codex.io/graphql',
  ENABLED: true, // Enabled by default for all users
};

// Known pool vault to pool mapping
const VAULT_TO_POOL = {};
for (const [poolAddr, pool] of Object.entries(VALIANT_POOLS)) {
  if (pool.vaultA) VAULT_TO_POOL[pool.vaultA] = { poolAddr, ...pool, isVaultA: true };
  if (pool.vaultB) VAULT_TO_POOL[pool.vaultB] = { poolAddr, ...pool, isVaultB: true };
}

// CONFIG - SAFE ULTRA SPEED MODE
const CONFIG = {
  SIG_BATCH_SIZE: 200,    // 100 signatures per call (safe)
  TX_BATCH_SIZE: 80,      // 50 transactions per batch  
  TX_CONCURRENT: 10,       // 5 concurrent = 250 tx parallel (browser safe)
  MAX_BATCHES: 2000,       // Max 2000 batches = 400k signatures (for wallets with many tx)
  MAX_TX_TO_PROCESS: 50000, // Max 50k transactions
  RPC_TIMEOUT: 5000       // 5 second timeout
};

// ============================================
// CODEX API CLIENT
// ============================================
class CodexClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async query(query, variables = {}) {
    console.log('🔮 Codex API Query:', { query: query.slice(0, 100), variables });
    
    const response = await fetch(CODEX_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    console.log('🔮 Codex API Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Codex API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('🔮 Codex API Response data:', JSON.stringify(data).slice(0, 500));
    
    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors.map(e => e.message).join(', ')}`);
    }

    return data.data;
  }

  async getBars(pairAddress, from, to, resolution = '1D') {
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
            volume
            txns
            uniqueBuyers
            uniqueSellers
          }
        }
      }
    `;

    const data = await this.query(query, { 
      pairAddress, 
      networkId: CODEX_CONFIG.NETWORK_ID, 
      from, 
      to, 
      resolution 
    });
    
    return data?.getBars?.bars || [];
  }

  async getVolumeForDateRange(pairAddress, startDate, endDate) {
    const from = Math.floor(startDate.getTime() / 1000);
    const to = Math.floor(endDate.getTime() / 1000);
    const days = Math.ceil((endDate - startDate) / (1000 * 86400));
    
    const resolution = days > 1 ? '1D' : '60';
    const bars = await this.getBars(pairAddress, from, to, resolution);
    
    if (!bars || bars.length === 0) {
      return { volumeUSD: 0, txns: 0, uniqueBuyers: 0, uniqueSellers: 0 };
    }

    let totalVolume = 0;
    let totalTxns = 0;
    let totalBuyers = 0;
    let totalSellers = 0;
    
    for (const bar of bars) {
      totalVolume += parseFloat(bar.volume || 0);
      totalTxns += parseInt(bar.txns || 0);
      totalBuyers += parseInt(bar.uniqueBuyers || 0);
      totalSellers += parseInt(bar.uniqueSellers || 0);
    }

    return { 
      volumeUSD: totalVolume, 
      txns: totalTxns,
      uniqueBuyers: totalBuyers,
      uniqueSellers: totalSellers,
      bars: bars 
    };
  }

  /**
   * Get wallet stats from Codex API using detailedWalletStats
   */
  async getWalletStats(walletAddress, networkId = CODEX_CONFIG.NETWORK_ID) {
    const query = `
      query GetWalletStats($input: DetailedWalletStatsInput!) {
        detailedWalletStats(input: $input) {
          walletAddress
          statsDay30 {
            statsUsd {
              volumeUsd
              volumeUsdAll
              realizedProfitUsd
              realizedProfitPercentage
            }
            statsNonCurrency {
              swaps
              uniqueTokens
              wins
              losses
            }
          }
          statsDay1 {
            statsUsd {
              volumeUsd
            }
            statsNonCurrency {
              swaps
            }
          }
          statsWeek1 {
            statsUsd {
              volumeUsd
            }
            statsNonCurrency {
              swaps
            }
          }
        }
      }
    `;
    
    const data = await this.query(query, { 
      input: { 
        walletAddress: walletAddress,
        networkId: networkId,
        includeNetworkBreakdown: true
      } 
    });
    
    return data?.detailedWalletStats || null;
  }

  /**
   * Get pair metadata with volume info
   */
  async getPairMetadata(pairAddress) {
    const query = `
      query GetPairMetadata($pairAddress: String!, $networkId: Int!) {
        pair(pairAddress: $pairAddress, networkId: $networkId) {
          id
          address
          volume24h: volume24
          volume7d: volume7d
          volume30d: volume30d
          liquidity
          token0 {
            address
            symbol
            name
            price
          }
          token1 {
            address
            symbol
            name
            price
          }
          exchange {
            name
            address
          }
        }
      }
    `;

    const data = await this.query(query, { 
      pairAddress, 
      networkId: CODEX_CONFIG.NETWORK_ID 
    });
    
    return data?.pair;
  }
}

// Global Codex client
let codexClient = null;

// Initialize Codex - try default key first, then saved key
function initCodex() {
  // Priority: 1. Saved user key, 2. Default/demo key
  const savedKey = localStorage.getItem('codex_api_key');
  const apiKey = savedKey || CODEX_CONFIG.API_KEY;
  
  if (apiKey) {
    CODEX_CONFIG.API_KEY = apiKey;
    CODEX_CONFIG.ENABLED = true;
    codexClient = new CodexClient(apiKey);
    console.log('🔮 Codex API initialized (endpoint: graph.codex.io)');
    return true;
  }
  return false;
}

// Default FOGO price (will be updated)
let fogoPrice = 0.025; 

// DOM Elements
const walletInput = document.getElementById('wallet-address');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const rpcInput = document.getElementById('rpc-url');
const fetchBtn = document.getElementById('fetch-btn');
const resultsSection = document.getElementById('results');
const errorDiv = document.getElementById('error');
const spinner = document.querySelector('.spinner');
const btnText = document.querySelector('.btn-text');

let currentData = null;
let abortController = null;
let currentWalletAddress = '';

// Log Panel Functions
// Batch log updates for performance
let logBuffer = [];
let logUpdateTimeout = null;

// Add CSS animation class helper
function animateElement(element, animationClass) {
  element.classList.add(animationClass);
  element.addEventListener('animationend', () => {
    element.classList.remove(animationClass);
  }, { once: true });
}

function flushLogBuffer() {
  const logContent = document.getElementById('log-content');
  const logCounter = document.getElementById('log-counter');
  
  if (!logContent || logBuffer.length === 0) return;
  
  // Remove empty state if present
  const emptyState = logContent.querySelector('.log-empty');
  if (emptyState) emptyState.remove();
  
  // Create fragment for batch insert
  const fragment = document.createDocumentFragment();
  
  logBuffer.forEach(({ type, data }) => {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    if (type === 'tx' && data) {
      const time = data.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const sigShort = data.signature.slice(0, 10) + '...';
      
      // Determine direction label
      const dirLabel = data.direction === 'AtoB' 
        ? `<span style="color: var(--accent-danger)">SELL ${data.tokenA}</span>` 
        : `<span style="color: var(--accent-primary)">BUY ${data.tokenA}</span>`;
      
      const input = data.direction === 'AtoB' 
        ? `${data.amountA.toFixed(1)} ${data.tokenA}` 
        : `${data.amountB.toFixed(1)} ${data.tokenB}`;
      const output = data.direction === 'AtoB' 
        ? `${data.amountB.toFixed(1)} ${data.tokenB}` 
        : `${data.amountA.toFixed(1)} ${data.tokenA}`;
      
      entry.innerHTML = `
        <div class="log-time">${time} | ${dirLabel}</div>
        <div class="log-tx">
          <span class="log-sig" onclick="window.open('https://explorer.fogo.io/tx/${data.signature}', '_blank')">${sigShort}</span>
          <span class="log-pool">${data.pool}</span>
        </div>
        <div class="log-amounts">
          <span class="log-amount negative">-${input}</span>
          <span>→</span>
          <span class="log-amount">+${output}</span>
        </div>
      `;
    } else if (type === 'info') {
      entry.innerHTML = `<div class="log-time">${new Date().toLocaleTimeString()}</div><div>${data}</div>`;
      entry.className = 'log-entry info';
    } else if (type === 'error') {
      entry.innerHTML = `<div class="log-time">${new Date().toLocaleTimeString()}</div><div style="color: var(--accent-danger)">${data}</div>`;
      entry.className = 'log-entry error';
    }
    
    fragment.appendChild(entry);
  });
  
  logContent.appendChild(fragment);
  logContent.scrollTop = logContent.scrollHeight;
  
  // Limit log entries to prevent memory issues (keep last 100)
  while (logContent.children.length > 100) {
    logContent.removeChild(logContent.firstChild);
  }
  
  // Update counter - show actual total from currentData if available, not just visible entries
  let count = logContent.querySelectorAll('.log-entry.tx').length;
  if (currentData && currentData.totalSwaps > count) {
    count = currentData.totalSwaps;
  }
  if (logCounter) logCounter.textContent = `${count} txs`;
  
  logBuffer = [];
}

function addLogEntry(type, data) {
  logBuffer.push({ type, data });
  
  // Flush immediately for first entry, then batch
  if (logBuffer.length >= 5 || type === 'info') {
    flushLogBuffer();
  } else if (!logUpdateTimeout) {
    logUpdateTimeout = setTimeout(() => {
      flushLogBuffer();
      logUpdateTimeout = null;
    }, 100);
  }
}

// Throttle log stats updates
let lastLogStatsUpdate = 0;
let currentOnlyValidPools = true; // Track if only valid pools (FOGO-iFOGO, FOGO-USDC) are being traded

function updateLogStats(found, fogoNet, ifogoNet, onlyValidPools = true) {
  const now = Date.now();
  if (now - lastLogStatsUpdate < 200) return; // Max 5 updates per second
  lastLogStatsUpdate = now;
  currentOnlyValidPools = onlyValidPools;
  
  const foundEl = document.getElementById('log-found');
  const fogoEl = document.getElementById('log-fogo');
  const lossEl = document.getElementById('log-loss');
  
  if (foundEl) foundEl.textContent = found;
  
  // Only show FOGO Net and iFOGO Net if only valid pools (FOGO-iFOGO, FOGO-USDC) are used
  if (onlyValidPools) {
    // Hiển thị với dấu +/-
    if (fogoEl) {
      const fogoSign = fogoNet > 0 ? '+' : '';
      fogoEl.textContent = fogoSign + fogoNet.toFixed(1);
    }
    if (lossEl) {
      const ifogoSign = ifogoNet > 0 ? '+' : '';
      lossEl.textContent = ifogoSign + ifogoNet.toFixed(1);
    }
  } else {
    // Show message if other pools are involved
    if (fogoEl) {
      fogoEl.textContent = 'check only with fogo-ifogo';
      fogoEl.style.fontSize = '9px';
    }
    if (lossEl) {
      lossEl.textContent = 'check only with fogo-ifogo';
      lossEl.style.fontSize = '9px';
    }
  }
}

function clearLog() {
  logBuffer = []; // Clear buffer
  const logContent = document.getElementById('log-content');
  if (logContent) {
    logContent.innerHTML = '<div class="log-empty">Click "Fetch Volume Data" to start...</div>';
  }
  const logCounter = document.getElementById('log-counter');
  if (logCounter) logCounter.textContent = '0 txs';
  updateLogStats(0, 0, 0, true);
  
  // Clear old P&L cards
  const oldPnL = document.querySelector('.pnl-summary');
  if (oldPnL) oldPnL.remove();
}

function init() {
  // Check if required elements exist
  if (!walletInput || !fetchBtn) {
    console.error('Required DOM elements not found');
    return;
  }
  
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000); // 7 days default
  endDateInput.value = formatDateTimeLocal(now);
  startDateInput.value = formatDateTimeLocal(weekAgo);
  
  fetchBtn.addEventListener('click', fetchVolumeData);
  document.getElementById('export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('export-json')?.addEventListener('click', exportJSON);
  
  // Initialize Codex if API key exists
  initCodex();
  setupCodexUI(); // Setup UI for Codex
  
  // Ensure counter starts at 0
  clearLog();
  
  console.log('✅ Valiant Volume Tracker initialized');
}

function formatDateTimeLocal(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  resultsSection.classList.add('hidden');
}

function hideError() {
  errorDiv.classList.add('hidden');
}

function setLoading(loading, text = 'Fetching...') {
  fetchBtn.disabled = loading;
  spinner.classList.toggle('hidden', !loading);
  btnText.textContent = loading ? text : '📊 Fetch Volume Data';
}

function updateProgress(checked, found, total) {
  // Only update if still loading
  if (!fetchBtn.disabled) return;
  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
  btnText.textContent = `⚡ ${percent}% | ${checked} checked | ${found} swaps found`;
}

// Fetch FOGO price from Valiant via DexScreener
async function fetchFOGOPrice(rpcUrl) {
  // Try DexScreener for Valiant pool price
  try {
    const FOGO_USDC_POOL = 'J7mxBLSz51Tcbog3XsiJTAXS64N46KqbpRGQmd3dQMKp';
    
    const response = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/pairs/fogo/${FOGO_USDC_POOL}`,
      {},
      10000
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('DexScreener pairs response:', data);
      if (data.pair && data.pair.priceUsd) {
        const price = parseFloat(data.pair.priceUsd);
        console.log('FOGO Price from Valiant/DexScreener:', price);
        addLogEntry('info', `💰 FOGO Price: $${price.toFixed(4)} USDC (Valiant)`);
        // Update input to show the fetched price
        const priceInput = document.getElementById('fogo-price-input');
        if (priceInput) priceInput.value = price.toFixed(4);
        return price;
      }
    }
  } catch (err) {
    console.log('DexScreener API failed:', err.message);
  }
  
  // Check if user provided a custom price
  const priceInput = document.getElementById('fogo-price-input');
  if (priceInput) {
    const userPrice = parseFloat(priceInput.value);
    if (!isNaN(userPrice) && userPrice > 0) {
      console.log('Using user FOGO price:', userPrice);
      addLogEntry('info', `💰 FOGO Price: $${userPrice.toFixed(4)} USDC (user)`);
      return userPrice;
    }
  }
  
  // Fallback price
  console.log('Using fallback FOGO price: 0.027');
  addLogEntry('info', '💰 FOGO Price: $0.027 USDC (default)');
  return 0.027;
}

async function fetchVolumeData() {
  const walletAddress = walletInput.value.trim();
  if (!walletAddress) {
    showError('Please enter a wallet address');
    return;
  }
  
  currentWalletAddress = walletAddress;
  
  if (abortController) abortController.abort();
  abortController = new AbortController();
  
  hideError();
  setLoading(true, '⚡ Fetching data...');
  clearLog();
  addLogEntry('info', '🚀 Starting fetch...');
  
  try {
    // Show results section immediately so user can see progress
    resultsSection.classList.remove('hidden');
    
    const startTime = new Date(startDateInput.value).getTime() / 1000;
    const endTime = new Date(endDateInput.value).getTime() / 1000;
    const rpcUrl = rpcInput.value.trim() || 'https://mainnet.fogo.io/';
    
    // Fetch price with loading indicator
    setLoading(true, '⚡ Fetching FOGO price...');
    fogoPrice = await fetchFOGOPrice(rpcUrl);
    console.log('Using FOGO price:', fogoPrice, 'USDC');
    addLogEntry('info', `💰 FOGO Price: $${fogoPrice.toFixed(4)} USDC`);
    
    // Update price display
    const priceDisplay = document.getElementById('fogo-price-display');
    if (priceDisplay) priceDisplay.textContent = `$${fogoPrice.toFixed(4)}`;
    
    const startPerf = performance.now();
    
    // Fetch RPC data and Codex data in parallel (if enabled)
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    const rpcPromise = fetchAllTransactions(walletAddress, startTime, endTime, rpcUrl);
    const codexPromise = CODEX_CONFIG.ENABLED && codexClient 
      ? fetchCodexVolume(walletAddress, startDate, endDate) 
      : Promise.resolve(null);
    
    const [data, codexData] = await Promise.all([rpcPromise, codexPromise]);
    const endPerf = performance.now();
    
    // Flush any remaining log entries
    flushLogBuffer();
    
    console.log(`✅ Completed in ${((endPerf - startPerf) / 1000).toFixed(2)}s`);
    console.log('Swaps found:', data.totalSwaps);
    addLogEntry('info', `✅ Done! Found ${data.totalSwaps} swaps in ${((endPerf - startPerf) / 1000).toFixed(1)}s`);
    flushLogBuffer(); // Ensure info is shown
    
    // Store Codex data for comparison
    data.codexData = codexData;
    
    currentData = data;
    displayResults(data);
    
    // Display Codex comparison (always show section, even if no data)
    displayCodexComparison(data, codexData);
    
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error:', err);
      showError(`Error: ${err.message}`);
    }
  } finally {
    setLoading(false);
    abortController = null;
  }
}

async function fetchAllTransactions(walletAddress, startTime, endTime, rpcUrl) {
  const allSwaps = [];
  const poolVolumes = {};
  let before = null;
  let batchCount = 0;
  let totalChecked = 0;
  
  setLoading(true, '⚡ Fetching signatures...');
  const allSignatures = [];
  
  // Fetch signatures with safety limits
  while (batchCount < CONFIG.MAX_BATCHES) {
    batchCount++;
    const sigs = await fetchSignaturesBatch(walletAddress, before, rpcUrl);
    if (!sigs || sigs.length === 0) {
      console.log(`📋 No more signatures after ${batchCount} batches`);
      break;
    }
    
    // Filter signatures within date range
    const validSigs = sigs.filter(s => s.blockTime >= startTime && s.blockTime <= endTime);
    console.log(`  Batch ${batchCount}: ${sigs.length} sigs, ${validSigs.length} in range. Time: ${new Date(sigs[0].blockTime*1000).toISOString()} to ${new Date(sigs[sigs.length-1].blockTime*1000).toISOString()}`);
    console.log(`  Range needed: ${new Date(startTime*1000).toISOString()} to ${new Date(endTime*1000).toISOString()}`);
    allSignatures.push(...validSigs);
    
    // Safety limit check
    if (allSignatures.length >= CONFIG.MAX_TX_TO_PROCESS) {
      console.log(`📋 Reached max tx limit: ${CONFIG.MAX_TX_TO_PROCESS}`);
      break;
    }
    
    // Check if oldest signature is before start time - we can stop
    // BUT only if we found some signatures in range, otherwise keep fetching
    const oldestSig = sigs[sigs.length - 1];
    if (oldestSig.blockTime < startTime && allSignatures.length > 0) {
      console.log(`📋 Reached transactions before start time at batch ${batchCount}, have ${allSignatures.length} in range`);
      break;
    }
    
    // Continue to next batch
    before = oldestSig.signature;
    
    // Update progress
    if (batchCount % 2 === 0) {
      setLoading(true, `⚡ Fetched ${allSignatures.length} signatures...`);
    }
  }
  
  // Continue fetching until we pass the start date or run out of signatures
  if (allSignatures.length === 0) {
    console.log('📋 No signatures in initial batches, fetching full history...');
    // If before is null, start fresh (will get most recent signatures)
    // Then paginate backwards
    console.log('📋 Starting from before:', before ? before.slice(0, 30) : 'null (getting recent first)');
    let reachedStartDate = false;
    let extraBatches = 0;
    while (!reachedStartDate && extraBatches < 100) {
      extraBatches++;
      batchCount++;
      console.log(`📋 Fetching extra batch ${extraBatches} with before=${before ? before.slice(0, 20) : 'null'}`);
      const sigs = await fetchSignaturesBatch(walletAddress, before, rpcUrl);
      if (!sigs || sigs.length === 0) {
        console.log('📋 No more signatures to fetch');
        break;
      }
      console.log(`📋 Got ${sigs.length} signatures, time range: ${new Date(sigs[0].blockTime * 1000).toISOString()} to ${new Date(sigs[sigs.length - 1].blockTime * 1000).toISOString()}`);
      
      // Check for signatures within date range
      const validSigs = sigs.filter(s => s.blockTime >= startTime && s.blockTime <= endTime);
      if (validSigs.length > 0) {
        allSignatures.push(...validSigs);
        console.log(`📋 Found ${validSigs.length} signatures in range`);
      }
      
      before = sigs[sigs.length - 1].signature;
      
      // Check if we've gone past the start date
      const oldestInBatch = sigs[sigs.length - 1].blockTime;
      if (oldestInBatch < startTime) {
        reachedStartDate = true;
        console.log('📋 Reached start date, stopping fetch');
      }
      
      if (batchCount % 10 === 0) {
        setLoading(true, `⚡ Fetched ${batchCount} batches, checking history...`);
      }
    }
  }
  
  // DEBUG: Check wallet activity range
  console.log('DEBUG: Checking wallet activity range...');
  const allSigsNoFilter = [];
  let beforeDebug = before || null;
  for (let i = 0; i < 5; i++) {
    const sigs = await fetchSignaturesBatch(walletAddress, beforeDebug, rpcUrl);
    if (!sigs || sigs.length === 0) break;
    allSigsNoFilter.push(...sigs);
    beforeDebug = sigs[sigs.length - 1].signature;
  }
  
  console.log(`📋 Found ${allSignatures.length} signatures in date range`);
  console.log('Date range:', { startTime: new Date(startTime * 1000).toISOString(), endTime: new Date(endTime * 1000).toISOString() });
  if (allSignatures.length > 0) {
    console.log('First sig time:', new Date(allSignatures[0].blockTime * 1000).toISOString());
    console.log('Last sig time:', new Date(allSignatures[allSignatures.length - 1].blockTime * 1000).toISOString());
  } else if (allSigsNoFilter.length > 0) {
    // No signatures in date range, but found some without filter
    const oldestTime = new Date(allSigsNoFilter[allSigsNoFilter.length - 1].blockTime * 1000);
    const newestTime = new Date(allSigsNoFilter[0].blockTime * 1000);
    console.log('⚠️ No signatures in selected date range!');
    console.log(`Wallet activity: ${oldestTime.toLocaleDateString()} → ${newestTime.toLocaleDateString()}`);
    addLogEntry('info', `⚠️ No activity in selected range. Wallet active: ${oldestTime.toLocaleDateString()} → ${newestTime.toLocaleDateString()}`);
    
    // DEBUG: Try to fetch the specific transaction directly
    // This tx should be: wke5e7Ts5wwmwtP5fJbxgRAmBgxSTp9UR8Ym9NpjLzFQPRQDqnCWizLxqmn59yn9SKAWtqTBaBR9xXppQnjGL5S
    // According to fogoscan, it's on Feb 22, 2026
    const targetSig = 'wke5e7Ts5wwmwtP5fJbxgRAmBgxSTp9UR8Ym9NpjLzFQPRQDqnCWizLxqmn59yn9SKAWtqTBaBR9xXppQnjGL5S';
    console.log('DEBUG: Checking specific tx from Feb 22...');
    console.log('DEBUG Wallet address being checked:', walletAddress);
    try {
      const txResponse = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignatureStatuses',
          params: [[targetSig], { searchTransactionHistory: true }]
        })
      }, 5000);
      
      if (txResponse.ok) {
        const txData = await txResponse.json();
        console.log('DEBUG Specific tx status:', txData);
        if (txData.result?.value?.[0]) {
          const slot = txData.result.value[0].slot;
          const blockTime = txData.result.value[0].blockTime;
          console.log(`DEBUG Target tx: slot=${slot}, time=${blockTime ? new Date(blockTime * 1000).toISOString() : 'unknown'}`);
          if (blockTime) {
            console.log(`DEBUG Target tx time check: ${blockTime} vs range ${startTime}-${endTime}`);
            console.log(`DEBUG In range? ${blockTime >= startTime && blockTime <= endTime}`);
          }
        } else {
          console.log('DEBUG Target tx NOT FOUND - does not belong to this wallet!');
        }
      }
    } catch (e) {
      console.log('DEBUG Error checking specific tx:', e.message);
    }
  }
  addLogEntry('info', `📋 Found ${allSignatures.length} signatures to check`);
  console.log(`DEBUG: Wallet has ${allSigsNoFilter.length} total signatures`);
  if (allSigsNoFilter.length > 0) {
    const oldestTime = new Date(allSigsNoFilter[allSigsNoFilter.length - 1].blockTime * 1000);
    const newestTime = new Date(allSigsNoFilter[0].blockTime * 1000);
    console.log('DEBUG Wallet activity:', { oldest: oldestTime.toISOString(), newest: newestTime.toISOString() });
    
    // Check if specific tx is in the list
    const targetSig = 'wke5e7Ts5wwmwtP5fJbxgRAmBgxSTp9UR8Ym9NpjLzFQPRQDqnCWizLxqmn59yn9SKAWtqTBaBR9xXppQnjGL5S';
    const foundTx = allSigsNoFilter.find(s => s.signature === targetSig);
    if (foundTx) {
      console.log('DEBUG Found target tx:', { sig: foundTx.signature.slice(0, 30), time: new Date(foundTx.blockTime * 1000).toISOString() });
    } else {
      console.log('DEBUG Target tx NOT in first 1000 signatures');
      console.log('DEBUG Sample sigs:', allSigsNoFilter.slice(0, 5).map(s => ({ sig: s.signature.slice(0, 30), time: new Date(s.blockTime * 1000).toISOString() })));
    }
    
    // Show warning if no signatures in date range
    if (allSignatures.length === 0) {
      addLogEntry('info', `⚠️ No transactions in ${new Date(startTime * 1000).toLocaleDateString()} - ${new Date(endTime * 1000).toLocaleDateString()}`);
      addLogEntry('info', `📅 Wallet active: ${oldestTime.toLocaleDateString()} → ${newestTime.toLocaleDateString()}`);
    }
  }
  
  if (allSignatures.length === 0) {
    return { totalSwaps: 0, totalFogoVolume: 0, totalUsdVolume: 0, poolVolumes: {}, transactions: [] };
  }
  
  setLoading(true, `⚡ Processing ${allSignatures.length} transactions...`);
  
  // Process transactions
  const chunks = [];
  for (let i = 0; i < allSignatures.length; i += CONFIG.TX_BATCH_SIZE) {
    chunks.push(allSignatures.slice(i, i + CONFIG.TX_BATCH_SIZE));
  }
  
  for (let i = 0; i < chunks.length; i += CONFIG.TX_CONCURRENT) {
    const batchChunks = chunks.slice(i, i + CONFIG.TX_CONCURRENT);
    
    await Promise.all(batchChunks.map(async (chunk) => {
      for (const sig of chunk) {
        if (abortController?.signal.aborted) throw new Error('Aborted');
        
        const tx = await fetchTransactionDetails(sig.signature, sig.blockTime, rpcUrl);
        if (tx) {
          allSwaps.push(tx);
          
          // Add to log panel (batched)
          addLogEntry('tx', tx);
          
          // Update pool volumes
          if (!poolVolumes[tx.pool]) {
            poolVolumes[tx.pool] = { swaps: 0, volumeFogo: 0, volumeUsd: 0, tokenA: tx.tokenA, tokenB: tx.tokenB };
          }
          poolVolumes[tx.pool].swaps++;
          poolVolumes[tx.pool].volumeFogo += tx.fogoVolume || 0;
          poolVolumes[tx.pool].volumeUsd += tx.usdVolume || 0;
        }
        totalChecked++;
      }
    }));
    
    // Update progress and log stats after each batch
    updateProgress(totalChecked, allSwaps.length, allSignatures.length);
    console.log(`Batch ${batchCount}: Checked ${totalChecked}, Found ${allSwaps.length} Valiant swaps`);
    
    // Calculate running net positions
    let fogoNet = 0, ifogoNet = 0;
    for (const tx of allSwaps) {
      // FOGO as tokenA
      if (tx.tokenA === 'FOGO' || tx.tokenA === 'wFOGO') {
        if (tx.direction === 'BtoA') fogoNet += tx.amountA; // Bought FOGO
        else fogoNet -= tx.amountA; // Sold FOGO
      }
      // FOGO as tokenB
      if (tx.tokenB === 'FOGO' || tx.tokenB === 'wFOGO') {
        if (tx.direction === 'AtoB') fogoNet += tx.amountB; // Bought FOGO
        else fogoNet -= tx.amountB; // Sold FOGO
      }
      // iFOGO tracking
      if (tx.tokenA === 'iFOGO') {
        if (tx.direction === 'BtoA') ifogoNet += tx.amountA; // Bought iFOGO
        else ifogoNet -= tx.amountA; // Sold iFOGO
      }
      if (tx.tokenB === 'iFOGO') {
        if (tx.direction === 'AtoB') ifogoNet += tx.amountB; // Bought iFOGO
        else ifogoNet -= tx.amountB; // Sold iFOGO
      }
    }
    // Check if only valid pools (FOGO-iFOGO, FOGO-USDC) are used so far
    const currentPools = [...new Set(allSwaps.map(tx => tx.pool))];
    const validStatsPools = ['FOGO-iFOGO', 'FOGO-USDC'];
    const onlyValidPoolsSoFar = currentPools.every(p => validStatsPools.includes(p));
    updateLogStats(allSwaps.length, fogoNet, ifogoNet, onlyValidPoolsSoFar);
  }
  
  let totalFogoVolume = 0;
  let totalUsdVolume = 0;
  let totalFogoLoss = 0;  // Total FOGO loss from pool fees
  
  // Calculate FOGO Net position
  let fogoNetPosition = 0;
  let totalBought = 0, totalSold = 0;
  console.log('=== FOGO NET CALCULATION ===');
  console.log('Logic: AtoB = bán A mua B | BtoA = bán B mua A');
  console.log('TX count:', allSwaps.length);
  
  // Show first 10 transactions
  const txSamples = allSwaps.slice(0, 10).map(tx => ({
    pool: tx.pool, 
    dir: tx.direction, 
    tokenA: tx.tokenA, 
    amountA: tx.amountA.toFixed(2), 
    tokenB: tx.tokenB, 
    amountB: tx.amountB.toFixed(2)
  }));
  console.log('First 10 TX:', txSamples);
  
  for (const tx of allSwaps) {
    let txChange = 0;
    let action = '';
    
    // FOGO as tokenA
    if (tx.tokenA === 'FOGO' || tx.tokenA === 'wFOGO') {
      if (tx.direction === 'AtoB') {
        // AtoB: bán A (FOGO), mua B
        fogoNetPosition -= tx.amountA;
        txChange -= tx.amountA;
        totalSold += tx.amountA;
        action = `Sell ${tx.amountA.toFixed(4)} FOGO`;
      } else {
        // BtoA: mua A (FOGO), bán B
        fogoNetPosition += tx.amountA;
        txChange += tx.amountA;
        totalBought += tx.amountA;
        action = `Buy ${tx.amountA.toFixed(4)} FOGO`;
      }
    }
    // FOGO as tokenB
    else if (tx.tokenB === 'FOGO' || tx.tokenB === 'wFOGO') {
      if (tx.direction === 'BtoA') {
        // BtoA: bán B (FOGO), mua A
        fogoNetPosition -= tx.amountB;
        txChange -= tx.amountB;
        totalSold += tx.amountB;
        action = `Sell ${tx.amountB.toFixed(4)} FOGO`;
      } else {
        // AtoB: mua B (FOGO), bán A
        fogoNetPosition += tx.amountB;
        txChange += tx.amountB;
        totalBought += tx.amountB;
        action = `Buy ${tx.amountB.toFixed(4)} FOGO`;
      }
    }
    
    if (txChange !== 0) {
      console.log(`${tx.pool} ${tx.direction}: ${action} | Net=${fogoNetPosition.toFixed(4)}`);
    }
  }
  
  console.log(`=== SUMMARY ===`);
  console.log(`Total Bought: ${totalBought.toFixed(4)} FOGO`);
  console.log(`Total Sold: ${totalSold.toFixed(4)} FOGO`);
  console.log(`Net Position: ${fogoNetPosition.toFixed(4)} FOGO (positive=profit, negative=loss)`);
  
  // Count BUY vs SELL
  let buyTx = 0, sellTx = 0;
  for (const tx of allSwaps) {
    const isTokenA_FOGO = tx.tokenA === 'FOGO' || tx.tokenA === 'wFOGO';
    const isTokenB_FOGO = tx.tokenB === 'FOGO' || tx.tokenB === 'wFOGO';
    if ((isTokenA_FOGO && tx.direction === 'BtoA') || (isTokenB_FOGO && tx.direction === 'AtoB')) {
      buyTx++;
    } else if ((isTokenA_FOGO && tx.direction === 'AtoB') || (isTokenB_FOGO && tx.direction === 'BtoA')) {
      sellTx++;
    }
  }
  console.log(`BUY FOGO tx: ${buyTx}, SELL FOGO tx: ${sellTx}`);
  
  for (const swap of allSwaps) {
    totalFogoVolume += swap.fogoVolume || 0;
    totalUsdVolume += swap.usdVolume || 0;
  }
  
  // Total FOGO Lost = Net position (keep sign to know profit/loss)
  // Negative = FOGO loss, Positive = FOGO profit
  const totalFogoLost = fogoNetPosition;
  
  // Check if only FOGO-iFOGO or FOGO-USDC pools are used (both are valid for stats)
  const uniquePools = [...new Set(allSwaps.map(tx => tx.pool))];
  const validStatsPools = ['FOGO-iFOGO', 'FOGO-USDC'];
  const onlyValidPools = uniquePools.every(p => validStatsPools.includes(p));
  
  return {
    totalSwaps: allSwaps.length,
    totalFogoVolume,
    totalUsdVolume,
    totalFogoLoss: totalFogoLost,  // Now includes both fees and net position
    fogoNetPosition,
    poolVolumes,
    transactions: allSwaps.sort((a, b) => b.timestamp - a.timestamp),
    onlyValidPools,  // Flag to indicate if only valid pools (FOGO-iFOGO, FOGO-USDC) were traded
    poolsUsed: uniquePools  // List of all pools used
  };
}

async function fetchWithTimeout(url, options, timeout = CONFIG.RPC_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchSignaturesBatch(walletAddress, before, rpcUrl) {
  // Use Fogo RPC directly - it works as proven by test-rpc.html
  try {
    console.log(`Fetching signatures with before=${before ? before.slice(0,20) : 'null'}...`);
    const response = await fetchWithTimeout(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [walletAddress, { limit: CONFIG.SIG_BATCH_SIZE, before }]
      })
    });
    
    if (!response.ok) {
      console.log('RPC failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.log('RPC error:', data.error);
      return [];
    }
    
    const result = data.result || [];
    console.log(`Got ${result.length} signatures`);
    return result;
    
  } catch (err) {
    console.log('Fetch error:', err.message);
    return [];
  }
}

async function fetchTransactionDetails(signature, blockTime, rpcUrl) {
  try {
    const response = await fetchWithTimeout(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
      })
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.result) return null;
    
    return parseValiantSwap(data.result, signature, blockTime);
  } catch (err) {
    return null;
  }
}

function getAccountAddresses(transaction) {
  const tx = transaction.transaction;
  if (!tx?.message) return [];
  
  const msg = tx.message;
  if (msg.accountKeys) {
    return msg.accountKeys.map(k => typeof k === 'string' ? k : (k.pubkey || String(k)));
  }
  if (msg.staticAccountKeys) {
    return msg.staticAccountKeys.map(k => String(k));
  }
  return [];
}

// Parse swap from inner instructions (most reliable method)
function parseValiantSwap(transaction, signature, blockTime, userWallet) {
  const { meta } = transaction;
  if (!meta?.innerInstructions) return null;
  
  const accountAddresses = getAccountAddresses(transaction);
  
  // Get signer if userWallet not provided
  const signer = userWallet || accountAddresses[0];
  
  // Find all token transfers in inner instructions
  const transfers = [];
  
  for (const inner of meta.innerInstructions) {
    for (const inst of inner.instructions) {
      if (inst.parsed?.type === 'transfer') {
        const info = inst.parsed.info;
        const amount = parseFloat(info.amount || '0');
        if (amount > 0) {
          transfers.push({
            amount,
            source: info.source,
            destination: info.destination,
            authority: info.authority || info.multisigAuthority,
          });
        }
      }
    }
  }
  
  if (transfers.length < 2) return null;
  
  // Build account -> mint mapping from token balances
  const accountToMint = {};
  for (const tb of [...(meta.preTokenBalances || []), ...(meta.postTokenBalances || [])]) {
    const addr = accountAddresses[tb.accountIndex];
    if (addr) {
      accountToMint[addr] = tb.mint;
    }
  }
  
  // Find the swap pair using known pool vaults or pool address in accounts
  let poolInfo = null;
  let poolAddress = null;
  let vaultATransfer = null;  // Transfer into vaultA (user sends tokenA)
  let vaultBTransfer = null;  // Transfer out of vaultB (user receives tokenB)
  
  // First check if any account in transaction is a known pool
  // DEBUG: Log first few accounts for wFOGO swaps
  const isWFogoTx = signature && (signature.includes('wke5e7T') || signature.includes('uuRdnK'));
  if (isWFogoTx) {
    console.log('DEBUG accounts:', accountAddresses.slice(0, 15));
    console.log('DEBUG VALIANT_POOLS keys:', Object.keys(VALIANT_POOLS));
  }
  
  for (const addr of accountAddresses) {
    if (VALIANT_POOLS[addr]) {
      poolInfo = VALIANT_POOLS[addr];
      poolAddress = addr;
      if (isWFogoTx) console.log('DEBUG Found pool:', addr, poolInfo.name);
      break;
    }
  }
  
  for (const transfer of transfers) {
    // Check if destination is a pool vault (user sending to pool)
    const dstPool = VAULT_TO_POOL[transfer.destination];
    if (dstPool && !vaultATransfer) {
      if (!poolInfo) {
        poolInfo = dstPool;
        poolAddress = dstPool.poolAddr;
      }
      vaultATransfer = transfer;
    }
    
    // Check if source is a pool vault (pool sending to user)
    const srcPool = VAULT_TO_POOL[transfer.source];
    if (srcPool && !vaultBTransfer) {
      if (!poolInfo) {
        poolInfo = srcPool;
        poolAddress = srcPool.poolAddr;
      }
      vaultBTransfer = transfer;
    }
  }
  
  // For pools without vault mapping, determine by token mint and direction (using signer)
  if (poolInfo && !poolInfo.vaultA && !vaultATransfer && transfers.length >= 2) {
    // Find mints for tokenA and tokenB
    const mintA = Object.keys(TOKEN_INFO).find(k => TOKEN_INFO[k].name === poolInfo.tokenA);
    const mintB = Object.keys(TOKEN_INFO).find(k => TOKEN_INFO[k].name === poolInfo.tokenB);
    
    // For each transfer, determine:
    // - Which token (A or B)
    // - Direction: sent (from signer) or received (to signer)
    let tokenATransfer = null;  // Transfer involving tokenA
    let tokenBTransfer = null;  // Transfer involving tokenB
    
    for (const transfer of transfers) {
      const sourceMint = accountToMint[transfer.source];
      const destMint = accountToMint[transfer.destination];
      const isFromUser = transfer.source === signer;
      const isToUser = transfer.destination === signer;
      
      if (sourceMint === mintA || destMint === mintA) {
        tokenATransfer = {...transfer, isFromUser, isToUser, token: 'A'};
      } else if (sourceMint === mintB || destMint === mintB) {
        tokenBTransfer = {...transfer, isFromUser, isToUser, token: 'B'};
      }
    }
    
    // vaultATransfer = user sent tokenA (if selling A) or received tokenA (if buying A)
    // We need to determine which is input and which is output based on direction
    if (tokenATransfer && tokenBTransfer) {
      if (tokenATransfer.isFromUser) {
        // User sent tokenA, received tokenB (AtoB)
        vaultATransfer = tokenATransfer;  // Input: tokenA sent
        vaultBTransfer = tokenBTransfer;  // Output: tokenB received
      } else if (tokenBTransfer.isFromUser) {
        // User sent tokenB, received tokenA (BtoA)
        vaultATransfer = tokenATransfer;  // Output: tokenA received
        vaultBTransfer = tokenBTransfer;  // Input: tokenB sent
      } else {
        // Fallback - can't determine direction
        vaultATransfer = tokenATransfer;
        vaultBTransfer = tokenBTransfer;
      }
    }
    
    if (poolInfo.name === 'FOGO-CHASE') {
      console.log('DEBUG FOGO-CHASE no-vault:', {
        signer: signer.slice(0, 20),
        tokenA: tokenATransfer ? {amt: tokenATransfer.amount, isFromUser: tokenATransfer.isFromUser, isToUser: tokenATransfer.isToUser} : null,
        tokenB: tokenBTransfer ? {amt: tokenBTransfer.amount, isFromUser: tokenBTransfer.isFromUser, isToUser: tokenBTransfer.isToUser} : null,
        determinedDir: tokenATransfer?.isFromUser ? 'AtoB (sell A)' : (tokenBTransfer?.isFromUser ? 'BtoA (sell B)' : 'unknown')
      });
    }
  }
  
  // If we found both sides of the swap
  if (poolInfo && vaultATransfer && vaultBTransfer) {
    // DEBUG for FOGO-CHASE
    if (poolInfo.name === 'FOGO-CHASE') {
      console.log('DEBUG FOGO-CHASE:', {
        vaultA: poolInfo.vaultA,
        vaultB: poolInfo.vaultB,
        vaultATransferDst: vaultATransfer.destination,
        vaultBTransferSrc: vaultBTransfer.source,
        vaultATransferAmt: vaultATransfer.amount,
        vaultBTransferAmt: vaultBTransfer.amount
      });
    }
    
    // Determine which vault is A and which is B
    const isDstVaultA = poolInfo.vaultA && poolInfo.vaultA === vaultATransfer.destination;
    
    // Get mints from pool info
    const mintA = Object.keys(TOKEN_INFO).find(k => TOKEN_INFO[k].name === poolInfo.tokenA);
    const mintB = Object.keys(TOKEN_INFO).find(k => TOKEN_INFO[k].name === poolInfo.tokenB);
    
    if (!mintA || !mintB) return null;
    
    let amountA, amountB, direction;
    
    if (isDstVaultA) {
      // User sent tokenA to vaultA, received tokenB from vaultB
      // vaultATransfer: user -> vaultA (tokenA)
      // vaultBTransfer: vaultB -> user (tokenB)
      amountA = vaultATransfer.amount / 10 ** TOKEN_INFO[mintA].decimals;
      amountB = vaultBTransfer.amount / 10 ** TOKEN_INFO[mintB].decimals;
      direction = 'AtoB';  // A -> B means user sold A, bought B
    } else {
      // User sent tokenB to vaultB, received tokenA from vaultA
      amountA = vaultBTransfer.amount / 10 ** TOKEN_INFO[mintA].decimals;
      amountB = vaultATransfer.amount / 10 ** TOKEN_INFO[mintB].decimals;
      direction = 'BtoA';  // B -> A means user sold B, bought A
    }
    
    // Calculate volumes and FOGO loss
    let fogoVolume = 0, usdVolume = 0, fogoLoss = 0;
    
    const hasUSDC = poolInfo.tokenA === 'USDC' || poolInfo.tokenB === 'USDC';
    const hasFOGO = poolInfo.tokenA === 'FOGO' || poolInfo.tokenA === 'wFOGO' || 
                    poolInfo.tokenB === 'FOGO' || poolInfo.tokenB === 'wFOGO';
    
    if (hasFOGO && hasUSDC) {
      // FOGO-USDC pool: Only count INPUT side to avoid double counting
      // Input is the token user sends TO the pool
      let inputUsdValue = 0;
      
      if (direction === 'AtoB') {
        // User sold A, bought B
        const inputAmount = (poolInfo.tokenA === 'FOGO' || poolInfo.tokenA === 'wFOGO') ? 
          amountA * fogoPrice : amountA; // FOGO*price or USDC
        inputUsdValue = inputAmount;
      } else {
        // User sold B, bought A  
        const inputAmount = (poolInfo.tokenB === 'FOGO' || poolInfo.tokenB === 'wFOGO') ?
          amountB * fogoPrice : amountB; // FOGO*price or USDC
        inputUsdValue = inputAmount;
      }
      
      usdVolume = inputUsdValue;
      fogoVolume = inputUsdValue / fogoPrice;
      fogoLoss = 0;
      
    } else if (hasFOGO) {
      // FOGO-other pool (e.g., FOGO-iFOGO): Only count INPUT side
      let inputFogoValue = 0;
      
      if (direction === 'AtoB') {
        // User sold A (input), bought B
        inputFogoValue = (poolInfo.tokenA === 'FOGO' || poolInfo.tokenA === 'wFOGO') ? 
          amountA : amountA; // If A is FOGO, count A. If A is other, count A (1:1 assumed)
      } else {
        // User sold B (input), bought A
        inputFogoValue = (poolInfo.tokenB === 'FOGO' || poolInfo.tokenB === 'wFOGO') ?
          amountB : amountB; // If B is FOGO, count B. If B is other, count B (1:1 assumed)
      }
      
      fogoVolume = inputFogoValue;
      usdVolume = fogoVolume * fogoPrice;
      // Can't calculate loss without reference price
      fogoLoss = 0;
      
    } else if (hasUSDC) {
      // Non-FOGO pool with USDC (e.g., USDC-FISH): Only count INPUT (USDC side)
      const usdcAmount = (poolInfo.tokenA === 'USDC') ? amountA : amountB;
      usdVolume = usdcAmount;
      fogoVolume = usdcAmount / fogoPrice;
      fogoLoss = 0;
    } else {
      // Neither FOGO nor USDC: Count INPUT side only
      const inputAmount = direction === 'AtoB' ? amountA : amountB;
      fogoVolume = inputAmount;
      usdVolume = inputAmount * fogoPrice;
      fogoLoss = 0;
    }
    
    return {
      signature,
      timestamp: new Date(blockTime * 1000),
      pool: poolInfo.name,
      poolAddress,
      tokenA: poolInfo.tokenA,
      tokenB: poolInfo.tokenB,
      amountA,
      amountB,
      direction,
      fogoVolume,
      usdVolume,
      fogoLoss,  // New: FOGO slippage/loss
      isValiant: true
    };
  }
  
  // Skip failed parses silently for speed
  return null;
}

function displayResults(data) {
  if (!data) {
    showError('No data returned');
    return;
  }
  
  // Ensure elements exist
  const totalSwapsEl = document.getElementById('total-swaps');
  if (!totalSwapsEl) {
    console.error('Results elements not found');
    return;
  }
  
  totalSwapsEl.textContent = data.totalSwaps || 0;
  
  // Safely update all stat elements
  const totalUsdEl = document.getElementById('total-volume-usd');
  const fogoVolEl = document.getElementById('fogo-sell-volume');
  const avgSwapEl = document.getElementById('ifogo-buy-volume');
  const lossEl = document.getElementById('fogo-loss');
  
  console.log('=== RESULTS ===');
  console.log('Total USD Volume:', data.totalUsdVolume);
  console.log('Total FOGO Volume:', data.totalFogoVolume);
  
  // Verify: Calculate sum of pool USD volumes
  let poolUsdSum = 0;
  if (data.poolVolumes) {
    for (const [pool, info] of Object.entries(data.poolVolumes)) {
      poolUsdSum += info.volumeUsd || 0;
      console.log(`Pool ${pool}: USD=${info.volumeUsd?.toFixed(2)}, FOGO=${info.volumeFogo?.toFixed(4)}`);
    }
  }
  console.log('Sum of pool USD volumes:', poolUsdSum.toFixed(2));
  console.log('Total USD Volume from data:', data.totalUsdVolume?.toFixed(2));
  console.log('Match:', Math.abs(poolUsdSum - data.totalUsdVolume) < 0.01 ? 'YES' : 'NO');
  console.log('Total Swaps:', data.totalSwaps);
  console.log('FOGO Net Position:', data.fogoNetPosition);
  console.log('FOGO Net (with sign):', data.totalFogoLoss);
  console.log('Pools used:', data.poolsUsed);
  console.log('Number of pools:', data.poolsUsed?.length);
  console.log('Only valid pools (FOGO-iFOGO, FOGO-USDC):', data.onlyValidPools);
  
  // Debug: Show all pool volumes
  if (data.poolVolumes) {
    console.log('=== POOL VOLUMES ===');
    for (const [pool, info] of Object.entries(data.poolVolumes)) {
      console.log(`${pool}: ${info.swaps} swaps, ${info.volumeFogo?.toFixed(2)} FOGO, $${info.volumeUsd?.toFixed(2)} USD`);
    }
  }
  
  // Display Total FOGO Lost - show value if only FOGO-iFOGO/FOGO-USDC, otherwise show message
  if (lossEl) {
    if (data.onlyValidPools) {
      const sign = data.totalFogoLoss > 0 ? '+' : '';
      lossEl.textContent = `${sign}${(data.totalFogoLoss || 0).toFixed(4)}`;
      // Change color based on profit/loss
      lossEl.style.color = data.totalFogoLoss > 0 ? 'var(--accent-primary)' : (data.totalFogoLoss < 0 ? 'var(--accent-danger)' : '');
    } else {
      lossEl.textContent = 'check only with fogo-ifogo';
      lossEl.style.color = 'var(--text-secondary)';
      lossEl.style.fontSize = '9px';
      lossEl.style.whiteSpace = 'normal';
    }
  }
  if (data.transactions && data.transactions.length > 0) {
    console.log('=== TX SAMPLE 1 ===');
    const t1 = data.transactions[0];
    console.log(`Pool: ${t1.pool}, Dir: ${t1.direction}`);
    console.log(`TokenA: ${t1.amountA} ${t1.tokenA}`);
    console.log(`TokenB: ${t1.amountB} ${t1.tokenB}`);
    console.log(`FOGO Volume: ${t1.fogoVolume}`);
  }
  if (totalUsdEl) totalUsdEl.textContent = `$${(data.totalUsdVolume || 0).toFixed(2)}`;
  if (fogoVolEl) fogoVolEl.textContent = (data.totalFogoVolume || 0).toFixed(4);
  if (avgSwapEl) avgSwapEl.textContent = data.totalSwaps > 0 ? (data.totalFogoVolume / data.totalSwaps).toFixed(4) : '0.0000';
  // Note: lossEl is already updated above with the onlyFogoIfofo check
  
  // Price info is now in the HTML banner, just ensure it's visible
  const priceDisplay = document.getElementById('fogo-price-display');
  if (priceDisplay) priceDisplay.textContent = `$${fogoPrice.toFixed(4)}`;
  
  // Pool breakdown
  const poolBreakdownContainer = document.getElementById('pool-breakdown');
  if (poolBreakdownContainer && data.poolVolumes && Object.keys(data.poolVolumes).length > 0) {
    poolBreakdownContainer.innerHTML = `
      <table>
        <thead><tr><th>Pool</th><th>Swaps</th><th>FOGO Vol</th><th>USD Vol</th><th>FOGO Loss</th></tr></thead>
        <tbody>
          ${Object.entries(data.poolVolumes).map(([pool, info]) => {
            // Only show loss for FOGO-iFOGO pool (not FOGO-USDC as requested)
            const isFogoUsdc = pool === 'FOGO-USDC' || pool.includes('USDC');
            const poolLoss = isFogoUsdc ? 0 : data.transactions.filter(t => t.pool === pool).reduce((sum, t) => sum + (t.fogoLoss || 0), 0);
            return `<tr><td>${pool}</td><td>${info.swaps}</td><td>${info.volumeFogo.toFixed(4)}</td><td>$${info.volumeUsd.toFixed(2)}</td><td>${poolLoss > 0.001 ? poolLoss.toFixed(4) : '-'}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }
  
  // Update Pool Active tags dynamically
  const poolsGrid = document.getElementById('pools-grid');
  if (poolsGrid && data.poolVolumes) {
    poolsGrid.innerHTML = ''; // Clear existing
    
    // Only show pools with swaps, sorted by swap count
    const activePools = Object.entries(data.poolVolumes)
      .filter(([_, info]) => info.swaps > 0)
      .sort((a, b) => b[1].swaps - a[1].swaps);
    
    for (const [poolName, info] of activePools) {
      const tag = document.createElement('div');
      tag.className = 'pool-tag active';
      tag.textContent = `${poolName} (${info.swaps})`;
      poolsGrid.appendChild(tag);
    }
    
    if (activePools.length === 0) {
      poolsGrid.innerHTML = '<div class="pool-tag">No active pools</div>';
    }
  }
  
  // Transaction table
  const tbody = document.getElementById('tx-tbody');
  if (!tbody) return; // Exit if table not found
  
  tbody.innerHTML = '';
  
  if (!data.transactions?.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:2rem;">No Valiant swap transactions found</td></tr>';
  } else {
    const fragment = document.createDocumentFragment();
    
    // Display all transactions (or limit to 500 for performance if too many)
    const displayLimit = Math.min(data.transactions.length, 500);
    for (let i = 0; i < displayLimit; i++) {
      const tx = data.transactions[i];
      const row = document.createElement('tr');
      const timeStr = tx.timestamp.toLocaleString();
      const input = tx.direction === 'AtoB' 
        ? `${tx.amountA.toFixed(4)} ${tx.tokenA}` 
        : `${tx.amountB.toFixed(4)} ${tx.tokenB}`;
      const output = tx.direction === 'AtoB' 
        ? `${tx.amountB.toFixed(4)} ${tx.tokenB}` 
        : `${tx.amountA.toFixed(4)} ${tx.tokenA}`;
      // Hide loss for FOGO-USDC transactions
      const isFogoUsdcTx = tx.pool === 'FOGO-USDC' || tx.pool.includes('USDC');
      const lossDisplay = (!isFogoUsdcTx && tx.fogoLoss > 0.001) ? tx.fogoLoss.toFixed(4) : '-';
      
      row.innerHTML = `
        <td>${timeStr}</td>
        <td>${tx.pool}</td>
        <td>${input}</td>
        <td>${output}</td>
        <td>$${tx.usdVolume.toFixed(2)}</td>
        <td>${lossDisplay}</td>
        <td><a href="https://explorer.fogo.io/tx/${tx.signature}" target="_blank">${tx.signature.slice(0, 16)}...</a></td>
      `;
      fragment.appendChild(row);
    }
    
    tbody.appendChild(fragment);
    
    // Show message if transactions were truncated
    if (data.transactions.length > 500) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="7" style="text-align:center;color:var(--text-secondary);padding:1rem;">... và ${data.transactions.length - 500} transactions khác (export CSV để xem đầy đủ)</td>`;
      tbody.appendChild(row);
    }
  }
  
  // Calculate and display P&L for ALL tokens
  const pnlStats = calculatePnL(data.transactions);
  if (Object.keys(pnlStats).length > 0) {
    // Add P&L summary card
    const existingPnLCard = document.querySelector('.pnl-summary');
    if (existingPnLCard) existingPnLCard.remove();
    
    const pnlCard = document.createElement('div');
    pnlCard.className = 'card pnl-summary';
    pnlCard.innerHTML = `
      <div class="card-header">
        <h2>📊 P&L by Token</h2>
      </div>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Total Bought</th>
              <th>Total Sold</th>
              <th>Net Position</th>
              <th>P&L (if closed)</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(pnlStats).map(([token, stats]) => {
              const pnl = stats.net < 0 ? 'Holding' : (stats.sold > stats.bought ? 'Profit' : 'Loss');
              const pnlColor = stats.net > 0 ? 'var(--accent-primary)' : (stats.net < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)');
              return `
                <tr>
                  <td><strong>${token}</strong></td>
                  <td>${stats.bought.toFixed(4)}</td>
                  <td>${stats.sold.toFixed(4)}</td>
                  <td style="color: ${pnlColor}">${stats.net > 0 ? '+' : ''}${stats.net.toFixed(4)}</td>
                  <td>${stats.net === 0 ? '✅ Closed' : (stats.net > 0 ? '📈 Holding' : '📉 Short')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 0.375rem; font-size: 0.85rem;">
        <strong>💡 Giải thích:</strong>
        <ul style="margin: 0.5rem 0 0 1rem; padding: 0;">
          <li><strong>Net Position</strong> > 0: Bạn đang nắm giữ token này</li>
          <li><strong>Net Position</strong> < 0: Bạn đã bán nhiều hơn mua (short)</li>
          <li><strong>Net Position</strong> = 0: Vị thế đã đóng (bằng nhau)</li>
        </ul>
      </div>
    `;
    
    // Insert before results section
    const mainPanel = document.querySelector('.main-panel main');
    if (mainPanel) {
      mainPanel.insertBefore(pnlCard, resultsSection);
    }
  }
  
  // Show results with animation
  resultsSection.classList.remove('hidden');
  resultsSection.style.opacity = '0';
  resultsSection.style.transform = 'translateY(20px)';
  resultsSection.style.transition = 'all 0.5s ease';
  
  setTimeout(() => {
    resultsSection.style.opacity = '1';
    resultsSection.style.transform = 'translateY(0)';
  }, 50);
}

function exportCSV() {
  if (!currentData) return;
  
  let csv = 'Time,Pool,Direction,Input,Output,FOGO Volume,USD Volume,FOGO Loss,Signature\n';
  for (const tx of currentData.transactions) {
    const input = tx.direction === 'AtoB' ? `${tx.amountA} ${tx.tokenA}` : `${tx.amountB} ${tx.tokenB}`;
    const output = tx.direction === 'AtoB' ? `${tx.amountB} ${tx.tokenB}` : `${tx.amountA} ${tx.tokenA}`;
    csv += `${tx.timestamp.toISOString()},${tx.pool},${tx.direction},${input},${output},${tx.fogoVolume},${tx.usdVolume},${tx.fogoLoss || 0},${tx.signature}\n`;
  }
  
  downloadFile(csv, 'valiant-volume.csv', 'text/csv');
}

function exportJSON() {
  if (!currentData) return;
  downloadFile(JSON.stringify(currentData, null, 2), 'valiant-volume.json', 'application/json');
}

// Calculate P&L for each token type
function calculatePnL(transactions) {
  // Track token balances and P&L
  const tokenStats = {};
  
  for (const tx of transactions) {
    const tokenA = tx.tokenA;
    const tokenB = tx.tokenB;
    
    // Initialize stats for both tokens
    if (!tokenStats[tokenA]) {
      tokenStats[tokenA] = { bought: 0, sold: 0, net: 0 };
    }
    if (!tokenStats[tokenB]) {
      tokenStats[tokenB] = { bought: 0, sold: 0, net: 0 };
    }
    
    if (tx.direction === 'AtoB') {
      // Sold A, bought B
      tokenStats[tokenA].sold += tx.amountA;
      tokenStats[tokenA].net -= tx.amountA;
      tokenStats[tokenB].bought += tx.amountB;
      tokenStats[tokenB].net += tx.amountB;
    } else {
      // Sold B, bought A
      tokenStats[tokenB].sold += tx.amountB;
      tokenStats[tokenB].net -= tx.amountB;
      tokenStats[tokenA].bought += tx.amountA;
      tokenStats[tokenA].net += tx.amountA;
    }
  }
  
  return tokenStats;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// CODEX API FUNCTIONS
// ============================================

async function fetchCodexVolume(walletAddress, startDate, endDate) {
  if (!codexClient) return null;
  
  try {
    addLogEntry('info', '🔮 Fetching Codex wallet stats...');
    
    // Get wallet stats from Codex API
    const walletStats = await codexClient.getWalletStats(walletAddress);
    
    if (!walletStats) {
      addLogEntry('warning', '⚠️ No Codex data for this wallet');
      return null;
    }
    
    console.log('🔮 Codex wallet stats:', walletStats);
    
    // Extract stats
    const stats30d = walletStats.statsDay30 || {};
    const statsUsd = stats30d.statsUsd || {};
    const statsNonCurrency = stats30d.statsNonCurrency || {};
    
    const results = {
      wallet: {
        address: walletStats.walletAddress,
        volumeUSD: parseFloat(statsUsd.volumeUsd || 0),
        volumeUSDAll: parseFloat(statsUsd.volumeUsdAll || 0),
        profitUSD: parseFloat(statsUsd.realizedProfitUsd || 0),
        profitPercentage: parseFloat(statsUsd.realizedProfitPercentage || 0),
        swaps: parseInt(statsNonCurrency.swaps || 0),
        uniqueTokens: parseInt(statsNonCurrency.uniqueTokens || 0),
        wins: parseInt(statsNonCurrency.wins || 0),
        losses: parseInt(statsNonCurrency.losses || 0),
      },
      totalVolume: parseFloat(statsUsd.volumeUsd || 0),
      totalTxns: parseInt(statsNonCurrency.swaps || 0),
      hasErrors: false
    };
    
    addLogEntry('info', `🔮 Codex: $${results.wallet.volumeUSD.toFixed(2)} volume, ${results.wallet.swaps} swaps`);
    
    return results;
  } catch (err) {
    console.error('🔮 Error fetching Codex wallet stats:', err);
    addLogEntry('warning', `⚠️ Codex API error: ${err.message}`);
    return null;
  }
}

function displayCodexComparison(rpcData, codexData) {
  console.log('🔮 displayCodexComparison called');
  const comparisonEl = document.getElementById('codex-comparison');
  const tbody = document.getElementById('codex-comparison-body');
  
  console.log('🔮 Elements:', { comparisonEl: !!comparisonEl, tbody: !!tbody });
  
  if (!comparisonEl || !tbody) {
    console.error('🔮 Missing elements!');
    return;
  }
  
  // Always show comparison section
  comparisonEl.classList.remove('hidden');
  console.log('🔮 Section shown');
  
  // If no Codex data, show message
  if (!codexData || !codexData.wallet) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          🔮 Codex data unavailable<br>
          <span style="font-size: 0.8rem;">RPC-calculated volume shown above</span>
        </td>
      </tr>
    `;
    return;
  }
  
  const wallet = codexData.wallet;
  const rpcTotal = rpcData.totalUsdVolume || 0;
  const codexTotal = wallet.volumeUSD || 0;
  const totalDiff = codexTotal - rpcTotal;
  const totalDiffPercent = rpcTotal > 0 ? ((totalDiff / rpcTotal) * 100).toFixed(1) : 'N/A';
  const totalDiffColor = totalDiff > 0 ? 'var(--accent-primary)' : (totalDiff < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)');
  
  // Build comparison table
  const rows = `
    <tr>
      <td><strong>Total Volume (30d)</strong></td>
      <td>$${rpcTotal.toFixed(2)}</td>
      <td>$${codexTotal.toFixed(2)}</td>
      <td style="color: ${totalDiffColor}">${totalDiff > 0 ? '+' : ''}${totalDiffPercent}%</td>
      <td><span class="method-tag">RPC vs Codex</span></td>
    </tr>
    <tr>
      <td><strong>Total Swaps</strong></td>
      <td>${rpcData.totalSwaps || 0}</td>
      <td>${wallet.swaps || 0}</td>
      <td>-</td>
      <td><span class="method-tag">Transaction Count</span></td>
    </tr>
    <tr>
      <td><strong>Realized Profit</strong></td>
      <td>-</td>
      <td>$${wallet.profitUSD.toFixed(2)}</td>
      <td style="color: ${wallet.profitUSD > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${wallet.profitPercentage.toFixed(1)}%</td>
      <td><span class="method-tag">Codex Data</span></td>
    </tr>
    <tr>
      <td><strong>Win Rate</strong></td>
      <td>-</td>
      <td>${wallet.wins}/${wallet.losses}</td>
      <td>${wallet.wins + wallet.losses > 0 ? ((wallet.wins / (wallet.wins + wallet.losses)) * 100).toFixed(1) : 0}%</td>
      <td><span class="method-tag">W/L Ratio</span></td>
    </tr>
    <tr>
      <td><strong>Unique Tokens</strong></td>
      <td>-</td>
      <td>${wallet.uniqueTokens || 0}</td>
      <td>-</td>
      <td><span class="method-tag">Codex Data</span></td>
    </tr>
  `;
  
  tbody.innerHTML = rows;
  addLogEntry('info', `🔮 Codex wallet stats displayed`);
}

// Codex UI handlers - setup only, don't init here (init happens in init())
function setupCodexUI() {
  const saveBtn = document.getElementById('save-codex-key');
  const toggleBtn = document.getElementById('toggle-codex');
  const apiKeyInput = document.getElementById('codex-api-key');
  const statusEl = document.getElementById('codex-status');
  
  // Update UI based on current state
  if (apiKeyInput) {
    const savedKey = localStorage.getItem('codex_api_key');
    if (savedKey) {
      apiKeyInput.value = '••••••••••••••••';
      if (statusEl) statusEl.textContent = '✅ Using your API key';
    } else {
      if (statusEl) statusEl.textContent = '📡 Using default connection';
    }
  }
  
  if (toggleBtn) {
    toggleBtn.textContent = CODEX_CONFIG.ENABLED ? 'Disable' : 'Enable';
  }
  
  saveBtn?.addEventListener('click', () => {
    const key = apiKeyInput?.value?.trim();
    if (key && key !== '••••••••••••••••') {
      localStorage.setItem('codex_api_key', key);
      CODEX_CONFIG.API_KEY = key;
      CODEX_CONFIG.ENABLED = true;
      codexClient = new CodexClient(key);
      if (statusEl) statusEl.textContent = '✅ API key saved and enabled';
      if (toggleBtn) toggleBtn.textContent = 'Disable';
      addLogEntry('success', '🔮 Codex API key saved');
    }
  });
  
  toggleBtn?.addEventListener('click', () => {
    CODEX_CONFIG.ENABLED = !CODEX_CONFIG.ENABLED;
    if (CODEX_CONFIG.ENABLED) {
      if (CODEX_CONFIG.API_KEY) {
        codexClient = new CodexClient(CODEX_CONFIG.API_KEY);
        if (statusEl) statusEl.textContent = '✅ Codex API enabled';
        toggleBtn.textContent = 'Disable';
        addLogEntry('info', '🔮 Codex API enabled');
      } else {
        CODEX_CONFIG.ENABLED = false;
        if (statusEl) statusEl.textContent = '❌ No API key saved';
      }
    } else {
      codexClient = null;
      if (statusEl) statusEl.textContent = '⏸️ Codex API disabled';
      toggleBtn.textContent = 'Enable';
      addLogEntry('info', '🔮 Codex API disabled');
    }
  });
}

// Call setup after DOM is ready
document.addEventListener('DOMContentLoaded', setupCodexUI);

init();

// Force redeploy - 02/26/2026 06:58:00
