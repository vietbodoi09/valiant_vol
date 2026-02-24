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
  MAX_BATCHES: 200,       // Max 100 batches = 10k signatures
  MAX_TX_TO_PROCESS: 8000, // Max 5k transactions
  RPC_TIMEOUT: 5000       // 5 second timeout
};

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
  
  // Update counter
  const count = logContent.querySelectorAll('.log-entry.tx').length;
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
function updateLogStats(found, fogoNet, ifogoNet) {
  const now = Date.now();
  if (now - lastLogStatsUpdate < 200) return; // Max 5 updates per second
  lastLogStatsUpdate = now;
  
  const foundEl = document.getElementById('log-found');
  const fogoEl = document.getElementById('log-fogo');
  const lossEl = document.getElementById('log-loss');
  
  if (foundEl) foundEl.textContent = found;
  if (fogoEl) fogoEl.textContent = fogoNet.toFixed(1);
  if (lossEl) lossEl.textContent = ifogoNet.toFixed(1);
}

function clearLog() {
  logBuffer = []; // Clear buffer
  const logContent = document.getElementById('log-content');
  if (logContent) {
    logContent.innerHTML = '<div class="log-empty">Click "Fetch Volume Data" to start...</div>';
  }
  const logCounter = document.getElementById('log-counter');
  if (logCounter) logCounter.textContent = '0 txs';
  updateLogStats(0, 0, 0);
  
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
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  endDateInput.value = formatDateTimeLocal(now);
  startDateInput.value = formatDateTimeLocal(weekAgo);
  
  fetchBtn.addEventListener('click', fetchVolumeData);
  document.getElementById('export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('export-json')?.addEventListener('click', exportJSON);
  
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

// Fetch FOGO price from on-chain pool data
async function fetchFOGOPrice(rpcUrl) {
  try {
    const FOGO_USDC_POOL = 'J7mxBLSz51Tcbog3XsiJTAXS64N46KqbpRGQmd3dQMKp';
    
    const response = await fetchWithTimeout(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [FOGO_USDC_POOL, { encoding: 'base64' }]
      })
    }, 3000); // 3 second timeout for price fetch
    
    if (!response.ok) {
      console.log('Failed to fetch pool data, using fallback price');
      return 0.027;
    }
    
    const data = await response.json();
    console.log('Pool data response:', data);
    if (!data.result?.value?.data?.[0]) {
      console.log('No pool data, using fallback price');
      addLogEntry('info', '⚠️ No pool data, using fallback price $0.027');
      return 0.027;
    }
    
    // Parse Vortex pool data
    const base64Data = data.result.value.data[0];
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    console.log('Pool data length:', bytes.length, 'bytes');
    console.log('First 64 bytes (hex):', Array.from(bytes.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Try multiple offsets to find sqrt_price_x64
    // Try both little-endian and big-endian
    const offsets = [136, 144, 152, 156, 160, 168];
    let priceInUsd = 0.027;
    let foundValidPrice = false;
    
    for (const offset of offsets) {
      if (offset + 16 > bytes.length) continue;
      
      // Read as little-endian u128
      let sqrtPriceX64_LE = 0n;
      for (let i = 0; i < 16; i++) {
        sqrtPriceX64_LE |= BigInt(bytes[offset + i]) << BigInt(i * 8);
      }
      
      // Read as big-endian u128
      let sqrtPriceX64_BE = 0n;
      for (let i = 0; i < 16; i++) {
        sqrtPriceX64_BE |= BigInt(bytes[offset + i]) << BigInt((15 - i) * 8);
      }
      
      // Skip if all zeros
      if (sqrtPriceX64_LE === 0n && sqrtPriceX64_BE === 0n) continue;
      
      // Test little-endian
      if (sqrtPriceX64_LE > 0n) {
        const sqrtPrice = Number(sqrtPriceX64_LE) / (2 ** 64);
        const rawPrice = sqrtPrice * sqrtPrice;
        const testPrice = rawPrice * 1000;
        if (testPrice > 0.001 && testPrice < 10 && !foundValidPrice) {
          priceInUsd = testPrice;
          foundValidPrice = true;
          console.log(`✅ LE Offset ${offset}: price=$${testPrice.toFixed(6)}`);
        }
      }
      
      // Test big-endian
      if (sqrtPriceX64_BE > 0n && !foundValidPrice) {
        const sqrtPrice = Number(sqrtPriceX64_BE) / (2 ** 64);
        const rawPrice = sqrtPrice * sqrtPrice;
        const testPrice = rawPrice * 1000;
        if (testPrice > 0.001 && testPrice < 10 && !foundValidPrice) {
          priceInUsd = testPrice;
          foundValidPrice = true;
          console.log(`✅ BE Offset ${offset}: price=$${testPrice.toFixed(6)}`);
        }
      }
    }
    
    if (!foundValidPrice) {
      console.log('No valid price found, using fallback $0.027');
      addLogEntry('info', '⚠️ Cannot parse pool price, using fallback $0.027');
      return 0.027;
    }
    
    console.log('FOGO Price fetched:', priceInUsd.toFixed(6), 'USDC');
    
    // Validate price is reasonable (between $0.001 and $10)
    if (priceInUsd > 0.001 && priceInUsd < 10) {
      return priceInUsd;
    }
    
    console.log('Price seems invalid, using fallback');
    return 0.027;
    
  } catch (err) {
    console.error('Error fetching FOGO price:', err);
    addLogEntry('error', `⚠️ Price fetch failed: ${err.message}. Using fallback $0.027`);
    return 0.027; // Fallback price
  }
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
    const data = await fetchAllTransactions(walletAddress, startTime, endTime, rpcUrl);
    const endPerf = performance.now();
    
    // Flush any remaining log entries
    flushLogBuffer();
    
    console.log(`✅ Completed in ${((endPerf - startPerf) / 1000).toFixed(2)}s`);
    console.log('Swaps found:', data.totalSwaps);
    addLogEntry('info', `✅ Done! Found ${data.totalSwaps} swaps in ${((endPerf - startPerf) / 1000).toFixed(1)}s`);
    flushLogBuffer(); // Ensure info is shown
    
    currentData = data;
    displayResults(data);
    
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
    allSignatures.push(...validSigs);
    
    // Safety limit check
    if (allSignatures.length >= CONFIG.MAX_TX_TO_PROCESS) {
      console.log(`📋 Reached max tx limit: ${CONFIG.MAX_TX_TO_PROCESS}`);
      break;
    }
    
    // Check if oldest signature is before start time - we can stop
    const oldestSig = sigs[sigs.length - 1];
    if (oldestSig.blockTime < startTime) {
      console.log(`📋 Reached transactions before start time at batch ${batchCount}`);
      break;
    }
    
    // Continue to next batch
    before = oldestSig.signature;
    
    // Update progress
    if (batchCount % 2 === 0) {
      setLoading(true, `⚡ Fetched ${allSignatures.length} signatures...`);
    }
  }
  
  console.log(`📋 Found ${allSignatures.length} signatures`);
  
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
    
    // Calculate running net positions
    let fogoNet = 0, ifogoNet = 0;
    for (const tx of allSwaps) {
      if (tx.tokenA === 'FOGO' || tx.tokenA === 'wFOGO') {
        if (tx.direction === 'BtoA') fogoNet += tx.amountA; // Bought FOGO
        else fogoNet -= tx.amountA; // Sold FOGO
      }
      if (tx.tokenB === 'iFOGO') {
        if (tx.direction === 'AtoB') ifogoNet += tx.amountB; // Bought iFOGO
        else ifogoNet -= tx.amountB; // Sold iFOGO
      }
    }
    updateLogStats(allSwaps.length, fogoNet, ifogoNet);
  }
  
  let totalFogoVolume = 0;
  let totalUsdVolume = 0;
  let totalFogoLoss = 0;  // Total FOGO loss from pool fees
  
  // Calculate FOGO Net position (for Total FOGO Lost calculation)
  let fogoNetPosition = 0;
  for (const tx of allSwaps) {
    if (tx.tokenA === 'FOGO' || tx.tokenA === 'wFOGO') {
      if (tx.direction === 'BtoA') fogoNetPosition += tx.amountA; // Bought FOGO
      else fogoNetPosition -= tx.amountA; // Sold FOGO
    }
  }
  
  for (const swap of allSwaps) {
    totalFogoVolume += swap.fogoVolume || 0;
    totalUsdVolume += swap.usdVolume || 0;
    totalFogoLoss += swap.fogoLoss || 0;
  }
  
  // Total FOGO Lost = Pool fees + Net position loss (if negative)
  const totalFogoLost = totalFogoLoss + Math.abs(fogoNetPosition);
  
  return {
    totalSwaps: allSwaps.length,
    totalFogoVolume,
    totalUsdVolume,
    totalFogoLoss: totalFogoLost,  // Now includes both fees and net position
    poolVolumes,
    transactions: allSwaps.sort((a, b) => b.timestamp - a.timestamp)
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
  try {
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
    
    if (!response.ok) return [];
    const data = await response.json();
    return data.result || [];
  } catch (err) {
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
function parseValiantSwap(transaction, signature, blockTime) {
  const { meta } = transaction;
  if (!meta?.innerInstructions) return null;
  
  const accountAddresses = getAccountAddresses(transaction);
  
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
  
  // Find the swap pair using known pool vaults
  let poolInfo = null;
  let poolAddress = null;
  let vaultATransfer = null;  // Transfer into vaultA (user sends tokenA)
  let vaultBTransfer = null;  // Transfer out of vaultB (user receives tokenB)
  
  for (const transfer of transfers) {
    // Check if destination is a pool vault (user sending to pool)
    const dstPool = VAULT_TO_POOL[transfer.destination];
    if (dstPool && !vaultATransfer) {
      poolInfo = dstPool;
      poolAddress = dstPool.poolAddr;
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
  
  // If we found both sides of the swap
  if (poolInfo && vaultATransfer && vaultBTransfer) {
    // Determine which vault is A and which is B
    const isDstVaultA = poolInfo.vaultA === vaultATransfer.destination;
    
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
      // FOGO-USDC pool: Calculate exact FOGO loss
      const fogoAmount = (poolInfo.tokenA === 'FOGO' || poolInfo.tokenA === 'wFOGO') ? amountA : amountB;
      const usdcAmount = (poolInfo.tokenA === 'USDC') ? amountA : amountB;
      
      fogoVolume = fogoAmount;
      usdVolume = usdcAmount;
      
      // FOGO Loss = |FOGO_in - (USDC_out / price)|
      // If swapping FOGO->USDC: FOGO_in vs USDC_out/price
      // If swapping USDC->FOGO: USDC_in/price vs FOGO_out
      const fogoFromUsdc = usdcAmount / fogoPrice;
      fogoLoss = Math.abs(fogoAmount - fogoFromUsdc);
      
    } else if (hasFOGO) {
      // FOGO-other pool (no USDC for reference)
      const fogoAmount = (poolInfo.tokenA === 'FOGO' || poolInfo.tokenA === 'wFOGO') ? amountA : amountB;
      fogoVolume = fogoAmount;
      usdVolume = fogoVolume * fogoPrice;
      // Can't calculate loss without reference price
      fogoLoss = 0;
      
    } else if (hasUSDC) {
      // Non-FOGO pool with USDC
      const usdcAmount = (poolInfo.tokenA === 'USDC') ? amountA : amountB;
      usdVolume = usdcAmount;
      fogoVolume = usdVolume / fogoPrice;
      fogoLoss = 0;
    } else {
      // Neither FOGO nor USDC
      fogoVolume = Math.max(amountA, amountB);
      usdVolume = fogoVolume * fogoPrice;
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
  
  console.log('Display Results:', {totalUsd: data.totalUsdVolume, fogoVol: data.totalFogoVolume, swaps: data.totalSwaps, loss: data.totalFogoLoss});
  if (totalUsdEl) totalUsdEl.textContent = `$${(data.totalUsdVolume || 0).toFixed(2)}`;
  if (fogoVolEl) fogoVolEl.textContent = (data.totalFogoVolume || 0).toFixed(4);
  if (avgSwapEl) avgSwapEl.textContent = data.totalSwaps > 0 ? (data.totalFogoVolume / data.totalSwaps).toFixed(4) : '0.0000';
  if (lossEl) lossEl.textContent = (data.totalFogoLoss || 0).toFixed(4);
  
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
            // Calculate loss for this pool
            const poolSwaps = data.transactions.filter(t => t.pool === pool);
            const poolLoss = poolSwaps.reduce((sum, t) => sum + (t.fogoLoss || 0), 0);
            return `<tr><td>${pool}</td><td>${info.swaps}</td><td>${info.volumeFogo.toFixed(4)}</td><td>$${info.volumeUsd.toFixed(2)}</td><td>${poolLoss > 0.001 ? poolLoss.toFixed(4) : '-'}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
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
      const lossDisplay = tx.fogoLoss > 0.001 ? tx.fogoLoss.toFixed(4) : '-';
      
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

init();

// Force redeploy - 02/25/2026 03:58:18
