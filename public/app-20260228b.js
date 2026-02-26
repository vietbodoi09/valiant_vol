// Valiant DEX Volume Tracker
// Primary: Fogoscan Public API (api.fogoscan.com/v1) — no key needed
// Fallback: Fogo RPC (mainnet.fogo.io)
// GitHub: https://github.com/vietbodoi09/valiant_vol

const FOGOSCAN_API  = '/api/fogoscan'; // Proxy through Vercel to bypass CORS
const VALIANT_APP_ID = 'valiant';

// Pool registry
const VALIANT_POOLS = {
  'HULdR8aMSxJAiNJmrTBcfKN4Zq6FgG33AHbQ3nDD8P5E': {
    name: 'FOGO-iFOGO', tokenA: 'FOGO', tokenB: 'iFOGO',
    vaultA: '3iKBqsoRF6rkAVAhvf46BUBEse51HTvQPSaiLFrC1TkQ',
    vaultB: 'EHvGQWaGX1TThxSJXufwzqDaKcdXStRHBcs2VMtNg56q',
  },
  'J7mxBLSz51Tcbog3XsiJTAXS64N46KqbpRGQmd3dQMKp': {
    name: 'FOGO-USDC', tokenA: 'FOGO', tokenB: 'USDC',
    vaultA: '5Hi57na7wCbQ2b7D3QXRPAy9b4tsT1S5WWeXJ7WcDga7',
    vaultB: 'Dfyuf7jjpZ1xSKSBTYLc8i6HGBnrEn8429b9ziDDgNBo',
  },
  'Be2eoA9g1Yp8WKqMM14tXjSHuYCudaPpaudLTmC4gizp': { name: 'FOGO-stFOGO',     tokenA: 'FOGO',  tokenB: 'stFOGO' },
  'DjM47hJzwQmsXwRRhsEWsjRVt4vXfEmZTDAP1zhM6XKF': { name: 'USDC-FISH',       tokenA: 'USDC',  tokenB: 'FISH'   },
  '2exTq4dyaUa1mwXytfMSZ9r5BAcZ98L2zawBQDMfaU9o': { name: 'USDC-wSOL',       tokenA: 'USDC',  tokenB: 'wSOL'   },
  '2zKEnSqCVwPUgR6UkNDr6U5PYGpfwXFrV1pT9LRxQCtk': { name: 'FOGO-CHASE',      tokenA: 'FOGO',  tokenB: 'CHASE'  },
  'HEv4767Y7NwPm367bHuunuhcjbsgVpsybT7etovqc9KR': { name: 'FOGO-FISH Classic',tokenA: 'FOGO',  tokenB: 'FISH Classic' },
  'vnt1u7PzorND5JjweFWmDawKe2hLWoTwHU6QKz6XX98': { name: 'wFOGO-iFOGO',     tokenA: 'wFOGO', tokenB: 'iFOGO'  },
};

// Token mint → info
const TOKEN_INFO = {
  'So11111111111111111111111111111111111111112': { name: 'FOGO',  decimals: 9 },
  'So11111111111111111111111111111111111111111': { name: 'FOGO',  decimals: 9 }, // native FOGO
  'HLc5qava5deWKeoVkN9nsu9RrqqD8PoHaGsvQzPFNbxR': { name: 'wFOGO', decimals: 9 },
  'uSd2czE61Evaf76RNbq4KPpXnkiL3irdzgLFUMe3NoG': { name: 'USDC',  decimals: 6 },
  'Brasa3xzkSC9XqMBEcN9v53x4oMkpb1nQwfaGMyJE88b': { name: 'stFOGO',decimals: 9 },
  'iFoGoY5nMWpuMJogR7xjUAWDJtygHDF17zREeP4MKuD': { name: 'iFOGO', decimals: 9 },
  'F1SHsk3rbKUJp28MQyyqtmfoJqnrkVUuZYK5ymGW4ZAr': { name: 'FISH',  decimals: 9 },
  'F1SHuJ3sFF2wJoYbUJxK4iZ6CYg6MakFj8q6QHACFd4s': { name: 'FISH Classic', decimals: 9 },
  'GPK7grvKT8kQPMYsgAN8N537XUNdJLs3WsnXkUNfpump': { name: 'CHASE', decimals: 6 },
};

const VAULT_TO_POOL = {};
for (const [addr, pool] of Object.entries(VALIANT_POOLS)) {
  if (pool.vaultA) VAULT_TO_POOL[pool.vaultA] = { poolAddr: addr, ...pool };
  if (pool.vaultB) VAULT_TO_POOL[pool.vaultB] = { poolAddr: addr, ...pool };
}

const CONFIG = {
  SIG_BATCH_SIZE:       200,
  TX_BATCH_SIZE:         80,
  TX_CONCURRENT:         10,
  MAX_BATCHES:         2000,
  MAX_TX_TO_PROCESS:  50000,
  RPC_TIMEOUT:         8000,
  FOGOSCAN_PAGE_SIZE:   100,
  FOGOSCAN_MAX_PAGES:   500,
};

// Runtime state
let fogoPrice  = 0.027;
let ifogoPrice = 0.030; // updated from metadata
let currentData = null;
let abortController = null;

// DOM refs
const walletInput    = document.getElementById('wallet-address');
const startDateInput = document.getElementById('start-date');
const endDateInput   = document.getElementById('end-date');
const rpcInput       = document.getElementById('rpc-url');
const fetchBtn       = document.getElementById('fetch-btn');
const resultsSection = document.getElementById('results');
const errorDiv       = document.getElementById('error');
const spinner        = document.querySelector('.spinner');
const btnText        = document.querySelector('.btn-text');

// ============================================
// LOG PANEL
// ============================================
let logBuffer = [];
let logUpdateTimeout = null;

function flushLogBuffer() {
  const logContent = document.getElementById('log-content');
  const logCounter = document.getElementById('log-counter');
  if (!logContent || !logBuffer.length) return;

  document.querySelector('.log-empty')?.remove();
  const frag = document.createDocumentFragment();

  for (const { type, data } of logBuffer) {
    const el = document.createElement('div');
    el.className = `log-entry ${type}`;

    if (type === 'tx' && data) {
      const time = data.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const sigShort = data.signature.slice(0, 10) + '...';
      const dirLabel = data.direction === 'AtoB'
        ? `<span style="color:var(--accent-danger)">SELL ${data.tokenA}</span>`
        : `<span style="color:var(--accent-primary)">BUY ${data.tokenA}</span>`;
      const input  = data.direction === 'AtoB'
        ? `${data.amountA.toFixed(2)} ${data.tokenA}`
        : `${data.amountB.toFixed(2)} ${data.tokenB}`;
      const output = data.direction === 'AtoB'
        ? `${data.amountB.toFixed(2)} ${data.tokenB}`
        : `${data.amountA.toFixed(2)} ${data.tokenA}`;
      el.innerHTML = `
        <div class="log-time">${time} | ${dirLabel}</div>
        <div class="log-tx">
          <span class="log-sig"
            onclick="window.open('https://explorer.fogo.io/tx/${data.signature}','_blank')"
          >${sigShort}</span>
          <span class="log-pool">${data.pool}</span>
          <span style="font-size:.7em;margin-left:.25rem">${data.source==='fogoscan'?'🔵':'🟡'}</span>
        </div>
        <div class="log-amounts">
          <span class="log-amount negative">-${input}</span>
          <span>→</span>
          <span class="log-amount">+${output}</span>
          <span style="color:var(--text-secondary);font-size:.8em;margin-left:.5rem">$${data.usdVolume.toFixed(2)}</span>
        </div>`;
    } else {
      const colors = { info: '', error: 'var(--accent-danger)', success: 'var(--accent-primary)', warning: '#f59e0b' };
      el.innerHTML = `
        <div class="log-time">${new Date().toLocaleTimeString()}</div>
        <div style="color:${colors[type]||''}">${data}</div>`;
    }
    frag.appendChild(el);
  }

  logContent.appendChild(frag);
  logContent.scrollTop = logContent.scrollHeight;
  while (logContent.children.length > 100) logContent.removeChild(logContent.firstChild);

  let count = logContent.querySelectorAll('.log-entry.tx').length;
  if (currentData?.totalSwaps > count) count = currentData.totalSwaps;
  if (logCounter) logCounter.textContent = `${count} txs`;
  logBuffer = [];
}

function addLogEntry(type, data) {
  logBuffer.push({ type, data });
  if (logBuffer.length >= 5 || type !== 'tx') flushLogBuffer();
  else if (!logUpdateTimeout) {
    logUpdateTimeout = setTimeout(() => { flushLogBuffer(); logUpdateTimeout = null; }, 100);
  }
}

let _lastStatsUpdate = 0;
function updateLogStats(found, fogoNet, ifogoNet, onlyValidPools = true) {
  if (Date.now() - _lastStatsUpdate < 200) return;
  _lastStatsUpdate = Date.now();
  const foundEl = document.getElementById('log-found');
  const fogoEl  = document.getElementById('log-fogo');
  const lossEl  = document.getElementById('log-loss');
  if (foundEl) foundEl.textContent = found;
  if (onlyValidPools) {
    if (fogoEl) fogoEl.textContent  = (fogoNet  > 0 ? '+' : '') + fogoNet.toFixed(1);
    if (lossEl) lossEl.textContent  = (ifogoNet > 0 ? '+' : '') + ifogoNet.toFixed(1);
  } else {
    if (fogoEl) { fogoEl.textContent = 'mixed pools'; fogoEl.style.fontSize = '9px'; }
    if (lossEl) { lossEl.textContent = 'mixed pools'; lossEl.style.fontSize = '9px'; }
  }
}

function clearLog() {
  logBuffer = [];
  const lc = document.getElementById('log-content');
  if (lc) lc.innerHTML = '<div class="log-empty">Click "Fetch Volume Data" to start...</div>';
  const ct = document.getElementById('log-counter');
  if (ct) ct.textContent = '0 txs';
  updateLogStats(0, 0, 0, true);
  document.querySelector('.pnl-summary')?.remove();
}

// ============================================
// INIT
// ============================================
function init() {
  if (!walletInput || !fetchBtn) return;
  const now = new Date();
  endDateInput.value   = formatDateTimeLocal(now);
  startDateInput.value = formatDateTimeLocal(new Date(now - 7 * 24 * 60 * 60 * 1000));
  fetchBtn.addEventListener('click', fetchVolumeData);
  document.getElementById('export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('export-json')?.addEventListener('click', exportJSON);
  clearLog();
  console.log('✅ Valiant Volume Tracker ready');
}

function formatDateTimeLocal(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.remove('hidden');
  resultsSection.classList.add('hidden');
}
function hideError() { errorDiv.classList.add('hidden'); }
function setLoading(on, text = 'Fetching...') {
  fetchBtn.disabled = on;
  spinner.classList.toggle('hidden', !on);
  btnText.textContent = on ? text : '📊 Fetch Volume Data';
}
function updateProgress(checked, found, total) {
  if (!fetchBtn.disabled) return;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  btnText.textContent = `⚡ ${pct}% | ${checked} checked | ${found} swaps`;
}

// ============================================
// FOGOSCAN PUBLIC API — exact field mapping
// ============================================

/**
 * Fetch one page of activities.
 * GET /v1/defi/amm/activity?app_id=valiant&page=N&page_size=100
 *
 * Response shape (confirmed from real data):
 * {
 *   success: true,
 *   data: [{
 *     trans_id, block_time, from_address,
 *     amount_info: { token1, token1_decimals, amount1, token2, token2_decimals, amount2 },
 *     value   // USD value of the swap
 *   }],
 *   metadata: { tokens: { [mint]: { token_symbol, price_usdt, token_decimals } } }
 * }
 */
async function fetchFogoscanPage(page, pageSize = CONFIG.FOGOSCAN_PAGE_SIZE, walletAddress = null) {
  try {
    let url;
    if (walletAddress) {
      // Try wallet-specific endpoint first (if supported by Fogoscan)
      url = `${FOGOSCAN_API}/defi/amm/activity?app_id=${VALIANT_APP_ID}&wallet_address=${walletAddress}&page=${page}&page_size=${pageSize}`;
    } else {
      url = `${FOGOSCAN_API}/defi/amm/activity?app_id=${VALIANT_APP_ID}&page=${page}&page_size=${pageSize}`;
    }
    const res = await fetchWithTimeout(url, {}, 12000);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

// Fetch wallet data using 'from' filter (much faster!)
async function fetchFogoscanWalletDirect(walletAddress, startTime, endTime) {
  try {
    const PAGE_SIZE = 100; // API limit
    let allData = [];
    let page = 1;
    let hasMore = true;
    let metaTokens = {};
    
    addLogEntry('info', `🔵 Fetching wallet data directly...`);
    
    while (hasMore && page <= 100) { // Max 100 pages = 10k txs
      const url = `${FOGOSCAN_API}/defi/amm/activity?app_id=${VALIANT_APP_ID}&from=${walletAddress}&page=${page}&page_size=${PAGE_SIZE}`;
      const res = await fetchWithTimeout(url, {}, 15000);
      
      if (!res.ok) break;
      const json = await res.json();
      
      if (!json.success || !json.data?.length) break;
      
      if (json.metadata?.tokens) {
        Object.assign(metaTokens, json.metadata.tokens);
      }
      
      // Filter by time only (wallet already filtered by API)
      const filtered = json.data.filter(item => {
        if (item.block_time < startTime || item.block_time > endTime) return false;
        return true;
      });
      
      allData.push(...filtered);
      
      // Check if we've gone past startTime
      const oldestInBatch = Math.min(...json.data.map(d => d.block_time));
      if (oldestInBatch < startTime) hasMore = false;
      
      // Check if we got less than page size (no more data)
      if (json.data.length < PAGE_SIZE) hasMore = false;
      
      page++;
      
      // Update progress every 5 pages
      if (page % 5 === 0 || !hasMore) {
        setLoading(true, `🔵 Fogoscan page ${page}... (${allData.length} matches)`);
      }
    }
    
    return { data: allData, metaTokens, totalPages: page - 1 };
  } catch (e) {
    console.error('Direct fetch failed:', e);
    return null;
  }
}

async function fetchFogoscanTotal() {
  try {
    const res = await fetchWithTimeout(
      `${FOGOSCAN_API}/defi/amm/activity/total?app_id=${VALIANT_APP_ID}`, {}, 8000
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (e) { return null; }
}

/**
 * Parse a single Fogoscan activity item into standard tx format.
 * Uses confirmed field names from real API response.
 */
function parseFogoscanItem(item, metaTokens = {}) {
  const sig       = item.trans_id;
  const blockTime = item.block_time;
  const signer    = item.from_address;
  if (!sig || !blockTime || !signer) return null;

  const ai = item.amount_info;
  if (!ai) return null;

  // Raw amounts → human readable
  const amt1 = ai.amount1 / Math.pow(10, ai.token1_decimals);
  const amt2 = ai.amount2 / Math.pow(10, ai.token2_decimals);

  // Resolve token symbols
  const t1Info = TOKEN_INFO[ai.token1] || metaTokens[ai.token1];
  const t2Info = TOKEN_INFO[ai.token2] || metaTokens[ai.token2];
  const sym1 = t1Info?.name || t1Info?.token_symbol || ai.token1.slice(0, 6);
  const sym2 = t2Info?.name || t2Info?.token_symbol || ai.token2.slice(0, 6);

  // Update live prices from metadata
  if (metaTokens[ai.token1]?.price_usdt) {
    const p = parseFloat(metaTokens[ai.token1].price_usdt);
    if (sym1 === 'FOGO' || sym1 === 'wFOGO') fogoPrice  = p;
    if (sym1 === 'iFOGO')                     ifogoPrice = p;
  }
  if (metaTokens[ai.token2]?.price_usdt) {
    const p = parseFloat(metaTokens[ai.token2].price_usdt);
    if (sym2 === 'FOGO' || sym2 === 'wFOGO') fogoPrice  = p;
    if (sym2 === 'iFOGO')                     ifogoPrice = p;
  }

  // USD value is directly provided by Fogoscan ✅
  const usdVolume = parseFloat(item.value || 0);

  // Determine pool name from token pair
  const poolName = resolvePoolName(sym1, sym2);

  // Direction: token1 is always "sold" by from_address (input token)
  // AtoB = sold token1, bought token2
  return {
    signature:  sig,
    timestamp:  new Date(blockTime * 1000),
    pool:       poolName,
    poolAddress: '',
    tokenA:     sym1,
    tokenB:     sym2,
    amountA:    amt1,
    amountB:    amt2,
    direction:  'AtoB',
    fogoVolume: usdVolume / fogoPrice,
    usdVolume,
    signer,
    source:     'fogoscan',
    isValiant:  true,
  };
}

function resolvePoolName(sym1, sym2) {
  const pair = `${sym1}-${sym2}`;
  const pairRev = `${sym2}-${sym1}`;
  for (const pool of Object.values(VALIANT_POOLS)) {
    const p = `${pool.tokenA}-${pool.tokenB}`;
    if (p === pair || p === pairRev) return pool.name;
  }
  return pair; // fallback: show actual pair
}

/**
 * Main Fogoscan fetch — paginate until we pass startTime or reach wallet match count.
 * NOTE: API returns ALL Valiant swaps ordered newest-first.
 *       We filter client-side by from_address + date range.
 */
async function fetchFogoscanWalletData(walletAddress, startTime, endTime) {
  addLogEntry('info', '🔵 Connecting to Fogoscan API...');
  
  // Use direct wallet fetch with 'from' filter (much faster!)
  const directResult = await fetchFogoscanWalletDirect(walletAddress, startTime, endTime);
  
  if (!directResult || !directResult.data.length) {
    addLogEntry('info', '🔵 No Fogoscan data for this wallet');
    return { totalSwaps: 0, totalFogoVolume: 0, totalUsdVolume: 0, poolVolumes: {}, transactions: [], source: 'fogoscan', checkedCount: 0 };
  }
  
  const { data: allData, metaTokens, totalPages } = directResult;
  addLogEntry('info', `🔵 Fetched ${allData.length} txs from ${totalPages} pages`);

  const allSwaps = [];
  const poolVolumes = {};
  let checkedCount = allData.length;

  for (const item of allData) {
    const tx = parseFogoscanItem(item, metaTokens);
    if (!tx) continue;

    allSwaps.push(tx);
    addLogEntry('tx', tx);

    if (!poolVolumes[tx.pool]) {
      poolVolumes[tx.pool] = { swaps: 0, volumeFogo: 0, volumeUsd: 0, tokenA: tx.tokenA, tokenB: tx.tokenB };
    }
    poolVolumes[tx.pool].swaps++;
    poolVolumes[tx.pool].volumeFogo += tx.fogoVolume || 0;
    poolVolumes[tx.pool].volumeUsd += tx.usdVolume || 0;
  }
  
  updateLogStats(allSwaps.length, 0, 0, true);

  flushLogBuffer();
  updateLogStats(allSwaps.length, 0, 0, true);

  // Update price display with live Fogoscan data
  const priceDisplay = document.getElementById('fogo-price-display');
  if (priceDisplay) priceDisplay.textContent = `$${fogoPrice.toFixed(4)}`;
  const priceInput = document.getElementById('fogo-price-input');
  if (priceInput) priceInput.value = fogoPrice.toFixed(4);

  const totalUsd  = allSwaps.reduce((s, t) => s + (t.usdVolume  || 0), 0);
  const totalFogo = allSwaps.reduce((s, t) => s + (t.fogoVolume || 0), 0);

  addLogEntry('info', `🔵 Checked ${checkedCount} txs, found ${allSwaps.length} matches`);

  return {
    totalSwaps: allSwaps.length,
    totalFogoVolume: totalFogo,
    totalUsdVolume:  totalUsd,
    totalFogoLoss:   0,
    fogoNetPosition: 0,
    poolVolumes,
    transactions: allSwaps, // already newest-first
    onlyValidPools: true,
    poolsUsed: [...new Set(allSwaps.map(t => t.pool))],
    source: 'fogoscan',
    checkedCount,
  };
}

// ============================================
// FOGO PRICE (from Fogoscan metadata or fallbacks)
// ============================================
async function fetchFOGOPrice(rpcUrl) {
  // Try Fogoscan activity endpoint — metadata has live price
  try {
    const res = await fetchWithTimeout(
      `${FOGOSCAN_API}/defi/amm/activity?app_id=${VALIANT_APP_ID}&page=1&page_size=10`, {}, 8000
    );
    if (res.ok) {
      const json = await res.json();
      const tokens = json.metadata?.tokens || {};
      // Find FOGO price (token1 = So111...2 = wFOGO with price)
      for (const [mint, info] of Object.entries(tokens)) {
        const sym = info.token_symbol || '';
        if ((sym === 'FOGO' || sym === 'wFOGO') && info.price_usdt) {
          const price = parseFloat(info.price_usdt);
          if (price > 0) {
            addLogEntry('info', `💰 FOGO: $${price.toFixed(4)} (Fogoscan live)`);
            const el = document.getElementById('fogo-price-input');
            if (el) el.value = price.toFixed(4);
            return price;
          }
        }
      }
    }
  } catch (e) {}

  // DexScreener fallback
  try {
    const res = await fetchWithTimeout(
      'https://api.dexscreener.com/latest/dex/pairs/fogo/J7mxBLSz51Tcbog3XsiJTAXS64N46KqbpRGQmd3dQMKp',
      {}, 8000
    );
    if (res.ok) {
      const data = await res.json();
      if (data.pair?.priceUsd) {
        const price = parseFloat(data.pair.priceUsd);
        addLogEntry('info', `💰 FOGO: $${price.toFixed(4)} (DexScreener)`);
        const el = document.getElementById('fogo-price-input');
        if (el) el.value = price.toFixed(4);
        return price;
      }
    }
  } catch (e) {}

  // User manual
  const el = document.getElementById('fogo-price-input');
  if (el) {
    const p = parseFloat(el.value);
    if (!isNaN(p) && p > 0) { addLogEntry('info', `💰 FOGO: $${p.toFixed(4)} (manual)`); return p; }
  }

  addLogEntry('info', '💰 FOGO: $0.027 (default)');
  return 0.027;
}

// ============================================
// MAIN FETCH ORCHESTRATOR
// ============================================
async function fetchVolumeData() {
  const walletAddress = walletInput.value.trim();
  if (!walletAddress) { showError('Please enter a wallet address'); return; }

  if (abortController) abortController.abort();
  abortController = new AbortController();

  hideError();
  setLoading(true, '⚡ Starting...');
  clearLog();
  addLogEntry('info', '🚀 Starting Valiant Volume Tracker...');

  try {
    resultsSection.classList.remove('hidden');
    const startTime = new Date(startDateInput.value).getTime() / 1000;
    const endTime   = new Date(endDateInput.value).getTime()   / 1000;
    const rpcUrl    = rpcInput?.value?.trim() || 'https://mainnet.fogo.io/';

    setLoading(true, '⚡ Fetching FOGO price...');
    fogoPrice = await fetchFOGOPrice(rpcUrl);
    const priceDisplay = document.getElementById('fogo-price-display');
    if (priceDisplay) priceDisplay.textContent = `$${fogoPrice.toFixed(4)}`;

    const t0 = performance.now();
    let fogoscanData = null;
    let rpcData = null;

    // ① Try Fogoscan API (for recent data with USD values)
    try {
      fogoscanData = await fetchFogoscanWalletData(walletAddress, startTime, endTime);
      if (fogoscanData && fogoscanData.totalSwaps > 0) {
        addLogEntry('success', `✅ Fogoscan: ${fogoscanData.totalSwaps} swaps (checked ${fogoscanData.checkedCount || '?'})`);
      } else {
        addLogEntry('warning', '⚠️ Fogoscan: 0 matches (Fogoscan only stores recent data)');
      }
    } catch (e) {
      addLogEntry('warning', `⚠️ Fogoscan error: ${e.message}`);
    }

    // ② Always fetch RPC for complete history (Fogoscan may miss old data)
    addLogEntry('info', '🟡 Fetching via Fogo RPC for complete history...');
    rpcData = await fetchAllTransactionsRPC(walletAddress, startTime, endTime, rpcUrl);

    // ③ Merge data: Fogoscan (with USD) + RPC (complete)
    let data = mergeDataSources(fogoscanData, rpcData, startTime, endTime);

    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    flushLogBuffer();
    const sourceLabels = {
  'fogoscan': '🔵 Fogoscan API',
  'rpc': '🟡 Fogo RPC', 
  'merged': '🟢 Merged (Fogoscan + RPC)',
  'none': '⚪ No data'
};
const badge = sourceLabels[data.source] || '🟡 Fogo RPC';
    addLogEntry('success', `✅ ${data.totalSwaps} swaps · $${data.totalUsdVolume.toFixed(2)} · ${elapsed}s · ${badge}`);
    flushLogBuffer();

    currentData = data;
    displayResults(data);

  } catch (err) {
    if (err.name !== 'AbortError') { console.error(err); showError(`Error: ${err.message}`); }
  } finally {
    setLoading(false);
    abortController = null;
  }
}

// ============================================
// MERGE FOGOSCAN + RPC DATA
// ============================================
function mergeDataSources(fogoscanData, rpcData, startTime, endTime) {
  // If only one source has data, return it
  if (!fogoscanData?.totalSwaps && !rpcData?.totalSwaps) {
    return {
      totalSwaps: 0, totalFogoVolume: 0, totalUsdVolume: 0,
      poolVolumes: {}, transactions: [], source: 'none'
    };
  }
  if (!fogoscanData?.totalSwaps) return { ...rpcData, source: 'rpc' };
  if (!rpcData?.totalSwaps) return { ...fogoscanData, source: 'fogoscan' };

  // Build a map of transactions by signature for deduplication
  const txMap = new Map();
  
  // Add RPC data first (complete but without USD)
  for (const tx of rpcData.transactions || []) {
    txMap.set(tx.signature, { ...tx, source: 'rpc', usdVolume: tx.usdVolume || 0 });
  }
  
  // Overlay with Fogoscan data (has accurate USD values)
  let fogoscanOverlayCount = 0;
  for (const tx of fogoscanData.transactions || []) {
    const existing = txMap.get(tx.signature);
    if (existing) {
      // Update with Fogoscan USD value
      existing.usdVolume = tx.usdVolume;
      existing.source = 'fogoscan';
      existing.fogoVolume = tx.fogoVolume;
      fogoscanOverlayCount++;
    } else {
      // Add Fogoscan-only transaction
      txMap.set(tx.signature, { ...tx, source: 'fogoscan' });
    }
  }
  
  // Convert map back to array and sort by timestamp
  const mergedTransactions = [...txMap.values()].sort((a, b) => b.timestamp - a.timestamp);
  
  // Recalculate totals
  const totalUsd = mergedTransactions.reduce((s, t) => s + (t.usdVolume || 0), 0);
  const totalFogo = mergedTransactions.reduce((s, t) => s + (t.fogoVolume || 0), 0);
  
  // Merge pool volumes
  const poolVolumes = {};
  for (const tx of mergedTransactions) {
    if (!poolVolumes[tx.pool]) {
      poolVolumes[tx.pool] = { swaps: 0, volumeFogo: 0, volumeUsd: 0, tokenA: tx.tokenA, tokenB: tx.tokenB };
    }
    poolVolumes[tx.pool].swaps++;
    poolVolumes[tx.pool].volumeFogo += tx.fogoVolume || 0;
    poolVolumes[tx.pool].volumeUsd += tx.usdVolume || 0;
  }
  
  addLogEntry('info', `🔵 Merged: ${fogoscanData.totalSwaps} from Fogoscan + ${rpcData.totalSwaps} from RPC = ${mergedTransactions.length} unique`);
  
  return {
    totalSwaps: mergedTransactions.length,
    totalFogoVolume: totalFogo,
    totalUsdVolume: totalUsd,
    totalFogoLoss: rpcData.totalFogoLoss || 0,
    fogoNetPosition: rpcData.fogoNetPosition || 0,
    poolVolumes,
    transactions: mergedTransactions,
    onlyValidPools: rpcData.onlyValidPools,
    poolsUsed: [...new Set(mergedTransactions.map(t => t.pool))],
    source: 'merged',
    fogoscanOverlayCount,
  };
}

// ============================================
// RPC FALLBACK (unchanged from working version)
// ============================================
async function fetchAllTransactionsRPC(walletAddress, startTime, endTime, rpcUrl) {
  const allSwaps = [], poolVolumes = {};
  let before = null, batchCount = 0, totalChecked = 0;
  setLoading(true, '🟡 Fetching signatures...');
  const allSigs = [];

  while (batchCount < CONFIG.MAX_BATCHES) {
    batchCount++;
    const sigs = await fetchSignaturesBatch(walletAddress, before, rpcUrl);
    if (!sigs?.length) break;
    allSigs.push(...sigs.filter(s => s.blockTime >= startTime && s.blockTime <= endTime));
    if (allSigs.length >= CONFIG.MAX_TX_TO_PROCESS) break;
    const oldest = sigs[sigs.length - 1];
    if (oldest.blockTime < startTime && allSigs.length > 0) break;
    before = oldest.signature;
    if (batchCount % 5 === 0) setLoading(true, `🟡 Found ${allSigs.length} sigs...`);
  }

  if (!allSigs.length) {
    let extra = 0;
    while (extra < 100) {
      extra++;
      const sigs = await fetchSignaturesBatch(walletAddress, before, rpcUrl);
      if (!sigs?.length) break;
      allSigs.push(...sigs.filter(s => s.blockTime >= startTime && s.blockTime <= endTime));
      before = sigs[sigs.length - 1].signature;
      if (sigs[sigs.length - 1].blockTime < startTime) break;
      if (extra % 10 === 0) setLoading(true, `🟡 Deep scan ${extra}...`);
    }
  }

  addLogEntry('info', `📋 ${allSigs.length} transactions in range`);
  if (!allSigs.length) {
    return { totalSwaps: 0, totalFogoVolume: 0, totalUsdVolume: 0, poolVolumes: {}, transactions: [], source: 'rpc' };
  }

  setLoading(true, `🟡 Processing ${allSigs.length} transactions...`);
  const chunks = [];
  for (let i = 0; i < allSigs.length; i += CONFIG.TX_BATCH_SIZE) chunks.push(allSigs.slice(i, i + CONFIG.TX_BATCH_SIZE));

  for (let i = 0; i < chunks.length; i += CONFIG.TX_CONCURRENT) {
    await Promise.all(chunks.slice(i, i + CONFIG.TX_CONCURRENT).map(async (chunk) => {
      for (const sig of chunk) {
        if (abortController?.signal.aborted) throw new Error('Aborted');
        const tx = await fetchTransactionDetails(sig.signature, sig.blockTime, rpcUrl);
        if (tx) {
          allSwaps.push(tx);
          addLogEntry('tx', tx);
          if (!poolVolumes[tx.pool]) poolVolumes[tx.pool] = { swaps: 0, volumeFogo: 0, volumeUsd: 0, tokenA: tx.tokenA, tokenB: tx.tokenB };
          poolVolumes[tx.pool].swaps++;
          poolVolumes[tx.pool].volumeFogo += tx.fogoVolume || 0;
          poolVolumes[tx.pool].volumeUsd  += tx.usdVolume  || 0;
        }
        totalChecked++;
      }
    }));
    updateProgress(totalChecked, allSwaps.length, allSigs.length);
  }

  let totalFogo = 0, totalUsd = 0, fogoNet = 0;
  for (const s of allSwaps) { totalFogo += s.fogoVolume || 0; totalUsd += s.usdVolume || 0; }
  for (const tx of allSwaps) {
    if (['FOGO','wFOGO'].includes(tx.tokenA)) fogoNet += tx.direction === 'AtoB' ? -tx.amountA : tx.amountA;
    else if (['FOGO','wFOGO'].includes(tx.tokenB)) fogoNet += tx.direction === 'BtoA' ? -tx.amountB : tx.amountB;
  }

  return {
    totalSwaps: allSwaps.length, totalFogoVolume: totalFogo, totalUsdVolume: totalUsd,
    totalFogoLoss: fogoNet, fogoNetPosition: fogoNet, poolVolumes,
    transactions: allSwaps.sort((a, b) => b.timestamp - a.timestamp),
    onlyValidPools: true, poolsUsed: [...new Set(allSwaps.map(t => t.pool))],
    source: 'rpc',
  };
}

// ============================================
// RPC HELPERS
// ============================================
async function fetchWithTimeout(url, options, timeout = CONFIG.RPC_TIMEOUT) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try { const res = await fetch(url, { ...options, signal: ctrl.signal }); clearTimeout(id); return res; }
  catch (e) { clearTimeout(id); throw e; }
}

async function fetchSignaturesBatch(wallet, before, rpcUrl) {
  try {
    const res = await fetchWithTimeout(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'getSignaturesForAddress', params:[wallet,{limit:CONFIG.SIG_BATCH_SIZE,before}] })
    });
    if (!res.ok) return [];
    return (await res.json()).result || [];
  } catch (e) { return []; }
}

async function fetchTransactionDetails(sig, blockTime, rpcUrl) {
  try {
    const res = await fetchWithTimeout(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'getTransaction', params:[sig,{encoding:'jsonParsed',maxSupportedTransactionVersion:0}] })
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.result ? parseValiantSwap(d.result, sig, blockTime) : null;
  } catch (e) { return null; }
}

function getAccountAddresses(tx) {
  const msg = tx?.transaction?.message;
  if (!msg) return [];
  if (msg.accountKeys) return msg.accountKeys.map(k => typeof k==='string' ? k : (k.pubkey||String(k)));
  if (msg.staticAccountKeys) return msg.staticAccountKeys.map(k => String(k));
  return [];
}

function parseValiantSwap(transaction, sig, blockTime) {
  const { meta } = transaction;
  if (!meta?.innerInstructions) return null;
  const accounts = getAccountAddresses(transaction);
  const signer = accounts[0];
  const transfers = [];
  for (const inner of meta.innerInstructions)
    for (const inst of inner.instructions)
      if (inst.parsed?.type === 'transfer') {
        const { amount, source, destination } = inst.parsed.info;
        const amt = parseFloat(amount || 0);
        if (amt > 0) transfers.push({ amount: amt, source, destination });
      }
  if (transfers.length < 2) return null;

  const a2m = {};
  for (const tb of [...(meta.preTokenBalances||[]),...(meta.postTokenBalances||[])]) {
    const addr = accounts[tb.accountIndex]; if (addr) a2m[addr] = tb.mint;
  }

  let poolInfo=null, poolAddress=null, vA=null, vB=null;
  for (const addr of accounts) if (VALIANT_POOLS[addr]) { poolInfo=VALIANT_POOLS[addr]; poolAddress=addr; break; }
  for (const t of transfers) {
    const dp=VAULT_TO_POOL[t.destination]; if(dp&&!vA){if(!poolInfo){poolInfo=dp;poolAddress=dp.poolAddr;}vA=t;}
    const sp=VAULT_TO_POOL[t.source];      if(sp&&!vB){if(!poolInfo){poolInfo=sp;poolAddress=sp.poolAddr;}vB=t;}
  }
  if (poolInfo&&!poolInfo.vaultA&&!vA&&transfers.length>=2) {
    const mA=Object.keys(TOKEN_INFO).find(k=>TOKEN_INFO[k].name===poolInfo.tokenA);
    const mB=Object.keys(TOKEN_INFO).find(k=>TOKEN_INFO[k].name===poolInfo.tokenB);
    let tA=null,tB=null;
    for (const t of transfers) {
      const sm=a2m[t.source],dm=a2m[t.destination];
      if(sm===mA||dm===mA) tA={...t,isFromUser:t.source===signer};
      else if(sm===mB||dm===mB) tB={...t,isFromUser:t.source===signer};
    }
    if(tA&&tB){vA=tA;vB=tB;}
  }
  if (!poolInfo||!vA||!vB) return null;

  const mA=Object.keys(TOKEN_INFO).find(k=>TOKEN_INFO[k].name===poolInfo.tokenA);
  const mB=Object.keys(TOKEN_INFO).find(k=>TOKEN_INFO[k].name===poolInfo.tokenB);
  if(!mA||!mB) return null;

  const isDstVaultA = poolInfo.vaultA && poolInfo.vaultA===vA.destination;
  let amountA, amountB, direction;
  if(isDstVaultA){
    amountA=vA.amount/10**TOKEN_INFO[mA].decimals; amountB=vB.amount/10**TOKEN_INFO[mB].decimals; direction='AtoB';
  } else {
    amountA=vB.amount/10**TOKEN_INFO[mA].decimals; amountB=vA.amount/10**TOKEN_INFO[mB].decimals; direction='BtoA';
  }

  const hasUSDC=['USDC'].includes(poolInfo.tokenA)||['USDC'].includes(poolInfo.tokenB);
  const hasFOGO=['FOGO','wFOGO'].includes(poolInfo.tokenA)||['FOGO','wFOGO'].includes(poolInfo.tokenB);
  let fogoVolume=0, usdVolume=0;
  if(hasFOGO&&hasUSDC){
    const isFogoA=['FOGO','wFOGO'].includes(poolInfo.tokenA);
    usdVolume=direction==='AtoB'?(isFogoA?amountA*fogoPrice:amountA):(isFogoA?amountB:amountB*fogoPrice);
    fogoVolume=usdVolume/fogoPrice;
  } else if(hasFOGO){
    fogoVolume=direction==='AtoB'?amountA:amountB; usdVolume=fogoVolume*fogoPrice;
  } else if(hasUSDC){
    usdVolume=poolInfo.tokenA==='USDC'?amountA:amountB; fogoVolume=usdVolume/fogoPrice;
  } else {
    fogoVolume=direction==='AtoB'?amountA:amountB; usdVolume=fogoVolume*fogoPrice;
  }

  return {
    signature:sig, timestamp:new Date(blockTime*1000),
    pool:poolInfo.name, poolAddress,
    tokenA:poolInfo.tokenA, tokenB:poolInfo.tokenB,
    amountA, amountB, direction, fogoVolume, usdVolume, fogoLoss:0,
    signer, source:'rpc', isValiant:true,
  };
}

// ============================================
// DISPLAY RESULTS
// ============================================
function displayResults(data) {
  if (!data) { showError('No data returned'); return; }
  const totalSwapsEl = document.getElementById('total-swaps');
  if (!totalSwapsEl) return;

  totalSwapsEl.textContent = data.totalSwaps || 0;

  const totalUsdEl = document.getElementById('total-volume-usd');
  const fogoVolEl  = document.getElementById('fogo-sell-volume');
  const avgSwapEl  = document.getElementById('ifogo-buy-volume');
  const lossEl     = document.getElementById('fogo-loss');

  if (totalUsdEl) totalUsdEl.textContent = `$${(data.totalUsdVolume||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  if (fogoVolEl)  fogoVolEl.textContent  = `${(data.totalFogoVolume||0).toFixed(2)} FOGO`;
  if (avgSwapEl)  avgSwapEl.textContent  = `$${(data.totalSwaps>0 ? data.totalUsdVolume/data.totalSwaps : 0).toFixed(2)}`;
  if (lossEl) {
    const net = data.fogoNetPosition || 0;
    lossEl.textContent = (net>0?'+':'')+net.toFixed(2)+' FOGO';
    lossEl.style.color = net>0?'var(--accent-primary)':net<0?'var(--accent-danger)':'';
  }

  // Source badge
  const src = document.getElementById('data-source-badge');
  if (src) { src.textContent = data.source==='fogoscan'?'🔵 Fogoscan API':'🟡 Fogo RPC'; src.style.display='inline-block'; }

  // Pool tags
  const poolsGrid = document.getElementById('pools-breakdown');
  if (poolsGrid) {
    poolsGrid.innerHTML = '';
    const active = Object.entries(data.poolVolumes||{}).filter(([,v])=>v.swaps>0);
    for (const [name,info] of active) {
      const tag = document.createElement('div');
      tag.className = 'pool-tag active';
      tag.textContent = `${name} (${info.swaps}) — $${(info.volumeUsd||0).toFixed(0)}`;
      poolsGrid.appendChild(tag);
    }
    if (!active.length) poolsGrid.innerHTML = '<div class="pool-tag">No active pools</div>';
  }

  // P&L
  const pnlStats = calculatePnL(data.transactions);
  if (Object.keys(pnlStats).length) {
    document.querySelector('.pnl-summary')?.remove();
    const card = document.createElement('div');
    card.className = 'card pnl-summary';
    card.innerHTML = `
      <div class="card-header"><h2>📊 P&L by Token</h2></div>
      <div class="table-container">
        <table>
          <thead><tr><th>Token</th><th>Bought</th><th>Sold</th><th>Net</th><th>Status</th></tr></thead>
          <tbody>${Object.entries(pnlStats).map(([tok,s])=>`
            <tr>
              <td><strong>${tok}</strong></td>
              <td>${s.bought.toFixed(4)}</td>
              <td>${s.sold.toFixed(4)}</td>
              <td style="color:${s.net>0?'var(--accent-primary)':s.net<0?'var(--accent-danger)':''}">${s.net>0?'+':''}${s.net.toFixed(4)}</td>
              <td>${s.net===0?'✅ Closed':s.net>0?'📈 Holding':'📉 Short'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    document.querySelector('.main-panel main')?.insertBefore(card, resultsSection);
  }

  resultsSection.classList.remove('hidden');
  Object.assign(resultsSection.style, {opacity:'0',transform:'translateY(20px)',transition:'all .5s ease'});
  setTimeout(()=>{ resultsSection.style.opacity='1'; resultsSection.style.transform='translateY(0)'; }, 50);
}

// ============================================
// EXPORT & UTILS
// ============================================
function exportCSV() {
  if (!currentData) return;
  let csv = 'Time,Pool,Direction,Input,Output,FOGO Volume,USD Volume,Source,Signature\n';
  for (const tx of currentData.transactions) {
    const input  = tx.direction==='AtoB' ? `${tx.amountA} ${tx.tokenA}` : `${tx.amountB} ${tx.tokenB}`;
    const output = tx.direction==='AtoB' ? `${tx.amountB} ${tx.tokenB}` : `${tx.amountA} ${tx.tokenA}`;
    csv += `${tx.timestamp.toISOString()},${tx.pool},${tx.direction},"${input}","${output}",${tx.fogoVolume},${tx.usdVolume},${tx.source||'rpc'},${tx.signature}\n`;
  }
  downloadFile(csv, 'valiant-volume.csv', 'text/csv');
}

function exportJSON() {
  if (!currentData) return;
  downloadFile(JSON.stringify(currentData, null, 2), 'valiant-volume.json', 'application/json');
}

function calculatePnL(transactions) {
  const stats = {};
  for (const tx of transactions) {
    if (!stats[tx.tokenA]) stats[tx.tokenA] = { bought:0, sold:0, net:0 };
    if (!stats[tx.tokenB]) stats[tx.tokenB] = { bought:0, sold:0, net:0 };
    if (tx.direction==='AtoB') {
      stats[tx.tokenA].sold+=tx.amountA; stats[tx.tokenA].net-=tx.amountA;
      stats[tx.tokenB].bought+=tx.amountB; stats[tx.tokenB].net+=tx.amountB;
    } else {
      stats[tx.tokenB].sold+=tx.amountB; stats[tx.tokenB].net-=tx.amountB;
      stats[tx.tokenA].bought+=tx.amountA; stats[tx.tokenA].net+=tx.amountA;
    }
  }
  return stats;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:url, download:filename }).click();
  URL.revokeObjectURL(url);
}

init();
