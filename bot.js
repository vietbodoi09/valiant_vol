/**
 * ============================================
 *  Valiant DEX Swap Bot (Fogo Blockchain)
 * ============================================
 * 
 * Multi-wallet PARALLEL mode - Chạy song song nhiều ví
 */

import "dotenv/config";
import fs from "fs";
import {
  swapInstructionsWithAmounts,
  prepareTickArrayAddressesForSwap,
  setVortexConfig,
} from "@valiant-trade/vortex";
import { fetchVortex } from "@valiant-trade/vortex-client";
import { createSolanaRpc } from "@solana/rpc";
import { address } from "@solana/addresses";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { buildAndSendTransaction, setRpc } from "@valiant-trade/tx-sender";
import readline from "readline";

// ============================================
// Configuration
// ============================================
const CONFIG = {
  rpcUrl: process.env.FOGO_RPC_URL || "https://mainnet.fogo.io/",
  network: process.env.FOGO_NETWORK || "fogoMainnet",
  walletsFile: process.env.WALLETS_FILE || "./wallets.txt",
  reportFile: process.env.REPORT_FILE || "./report.txt",
  
  // Pool selection: will be set by selectPool() interactive menu
  swapPair: "IFOGO", // Default, will be overwritten by selectPool()
  
  gasReserve: BigInt(process.env.GAS_RESERVE || "10000000"),
  slippageBps: parseInt(process.env.SLIPPAGE_BPS || "50"),
  delayMs: parseInt(process.env.SWAP_DELAY_MS || "2000"),
  cycleDelayMs: parseInt(process.env.CYCLE_DELAY_MS || "3000"), // Delay giữa các cycle
  cycles: parseInt(process.env.CYCLES || "50"),
  parallel: process.env.PARALLEL === "true", // Chế độ song song
  batchSize: parseInt(process.env.BATCH_SIZE || "5"), // Số ví chạy song song
  dryRun: process.env.DRY_RUN === "true",
  
  // Random SELL amount configuration (FOGO)
  randomSellMin: BigInt((process.env.RANDOM_SELL_MIN || "10") + "000000000"), // FOGO to lamports
  randomSellMax: BigInt((process.env.RANDOM_SELL_MAX || "20") + "000000000"), // FOGO to lamports
};

// Pool configuration based on selection
const POOL_CONFIG = {
  IFOGO: {
    address: "HULdR8aMSxJAiNJmrTBcfKN4Zq6FgG33AHbQ3nDD8P5E",
    tokenA: "FOGO",
    tokenB: "iFOGO",
    buyLabel: "→ BUY (iFOGO→FOGO)",
    sellLabel: "← SELL (FOGO→iFOGO)",
  },
  USDC: {
    address: "J7mxBLSz51Tcbog3XsiJTAXS64N46KqbpRGQmd3dQMKp",
    tokenA: "FOGO",
    tokenB: "USDC",
    buyLabel: "→ BUY (USDC→FOGO)",
    sellLabel: "← SELL (FOGO→USDC)",
  },
  STFOGO: {
    address: "Be2eoA9g1Yp8WKqMM14tXjSHuYCudaPpaudLTmC4gizp",
    tokenA: "FOGO",
    tokenB: "stFOGO",
    buyLabel: "→ BUY (stFOGO→FOGO)",
    sellLabel: "← SELL (FOGO→stFOGO)",
  },
};

const TOKEN_MINTS = {
  FOGO: "So11111111111111111111111111111111111111112",
  iFOGO: "iFoGoY5nMWpuMJogR7xjUAWDJtygHDF17zREeP4MKuD",
  USDC: "uSd2czE61Evaf76RNbq4KPpXnkiL3irdzgLFUMe3NoG",
  stFOGO: "Brasa3xzkSC9XqMBEcN9v53x4oMkpb1nQwfaGMyJE88b",
};

// ============================================
// Interactive Pool Selection
// ============================================
async function selectPool() {
  // Check command line argument first: node bot.js --pool USDC
  const args = process.argv.slice(2);
  const poolArg = args.find(arg => arg.startsWith('--pool=') || arg.startsWith('--pair='));
  if (poolArg) {
    const selected = poolArg.split('=')[1].toUpperCase();
    if (POOL_CONFIG[selected]) {
      console.log(`✅ Using pool from command line: ${selected}`);
      return selected;
    }
  }
  
  // Check env variable
  if (process.env.SWAP_PAIR && POOL_CONFIG[process.env.SWAP_PAIR.toUpperCase()]) {
    console.log(`✅ Using pool from .env: ${process.env.SWAP_PAIR}`);
    return process.env.SWAP_PAIR.toUpperCase();
  }
  
  // Interactive menu
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log("\n" + "=".repeat(50));
  console.log("🎯 SELECT TRADING PAIR");
  console.log("=".repeat(50));
  console.log("1. FOGO-iFOGO (HULdR8aMSx...DD8P5E)");
  console.log("2. FOGO-USDC  (J7mxBLSz51...d3dQMKp)");
  console.log("=".repeat(50));
  
  const answer = await new Promise(resolve => {
    rl.question("Enter choice (1 or 2): ", resolve);
  });
  
  rl.close();
  
  const choice = answer.trim();
  if (choice === "1" || choice.toUpperCase() === "IFOGO") {
    console.log("✅ Selected: FOGO-iFOGO\n");
    return "IFOGO";
  } else if (choice === "2" || choice.toUpperCase() === "USDC") {
    console.log("✅ Selected: FOGO-USDC\n");
    return "USDC";
  } else {
    console.log("⚠️  Invalid choice, defaulting to FOGO-iFOGO\n");
    return "IFOGO";
  }
}

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = BigInt(58);

function base58Decode(str) {
  for (const char of str) {
    if (!ALPHABET.includes(char)) {
      throw new Error(`Invalid character in base58 string: ${char}`);
    }
  }
  let num = BigInt(0);
  for (const char of str) {
    num = num * BASE + BigInt(ALPHABET.indexOf(char));
  }
  let leadingZeros = 0;
  for (const char of str) {
    if (char === '1') leadingZeros++;
    else break;
  }
  const bytes = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }
  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(bytes, leadingZeros);
  return result;
}

// Mutex lock cho report
class AsyncReportGenerator {
  constructor(filename) {
    this.filename = filename;
    this.wallets = [];
    this.startTime = new Date();
    this.lock = Promise.resolve();
    this.counter = 0;
  }

  async addWallet(address, initialFogo, initialIfofo) {
    const unlock = await this.acquireLock();
    let walletId;
    try {
      this.counter++;
      walletId = this.counter;
      this.wallets.push({
        id: walletId,
        index: walletId,
        address,
        initialFogo,
        initialIfofo,
        finalFogo: null,
        finalIfofo: null,
        stats: null,
        volume: { sell: 0n, buy: 0n }, // Theo dõi volume
      });
    } finally {
      unlock();
    }
    return walletId;
  }

  async updateWalletFinal(walletId, finalFogo, finalIfofo, stats, volume) {
    const unlock = await this.acquireLock();
    try {
      const wallet = this.wallets.find(w => w.id === walletId);
      if (wallet) {
        wallet.finalFogo = finalFogo;
        wallet.finalIfofo = finalIfofo;
        wallet.stats = stats;
        if (volume) {
          wallet.volume = volume;
        }
      }
    } finally {
      unlock();
    }
  }

  async addVolume(walletId, direction, amount) {
    const unlock = await this.acquireLock();
    try {
      const wallet = this.wallets.find(w => w.id === walletId);
      if (wallet) {
        if (direction === 'sell') {
          wallet.volume.sell += amount;
        } else {
          wallet.volume.buy += amount;
        }
      }
    } finally {
      unlock();
    }
  }

  acquireLock() {
    let release;
    const newLock = new Promise(resolve => {
      release = () => resolve();
    });
    const oldLock = this.lock;
    this.lock = oldLock.then(() => newLock);
    return oldLock.then(() => release);
  }

  formatFogo(lamports) {
    return (Number(lamports) / 1e9).toFixed(9);
  }

  generate() {
    const endTime = new Date();
    const duration = ((endTime - this.startTime) / 1000 / 60).toFixed(2);
    
    // Sắp xếp wallets theo id
    const sortedWallets = [...this.wallets].sort((a, b) => a.id - b.id);
    
    // Tính tổng
    let totalLoss = 0;
    let totalSwaps = 0;
    let totalSellVolume = 0n;
    let totalBuyVolume = 0n;
    
    for (const wallet of sortedWallets) {
      const diff = wallet.finalFogo !== null && wallet.initialFogo !== null
        ? Number(wallet.finalFogo - wallet.initialFogo) / 1e9
        : 0;
      totalLoss += diff;
      if (wallet.stats) {
        totalSwaps += wallet.stats.total;
      }
      if (wallet.volume) {
        totalSellVolume += wallet.volume.sell;
        totalBuyVolume += wallet.volume.buy;
      }
    }

    let report = [];
    report.push("=".repeat(100));
    report.push("                           FOGO SWAP BOT - TRANSACTION REPORT");
    report.push("=".repeat(100));
    report.push("");
    report.push(`  Report Date:    ${this.startTime.toISOString()}`);
    report.push(`  Completion:     ${endTime.toISOString()}`);
    report.push(`  Duration:       ${duration} minutes`);
    report.push(`  Total Wallets:  ${this.wallets.length}`);
    report.push(`  Cycles/Wallet:  ${CONFIG.cycles}`);
    report.push(`  Mode:           ${CONFIG.parallel ? 'PARALLEL' : 'SEQUENTIAL'}`);
    report.push(`  Batch Size:     ${CONFIG.batchSize}`);
    report.push(`  Network:        ${CONFIG.network}`);
    report.push(`  Pool:           FOGO-iFOGO (0.05% fee)`);
    report.push(`  Trading Mode:   ${CONFIG.dryRun ? 'DRY RUN (Simulation)' : 'LIVE TRADING'}`);
    report.push("");
    
    // TABLE HEADER
    report.push("-".repeat(100));
    report.push(" WALLET DETAILS TABLE");
    report.push("-".repeat(100));
    report.push("");
    
    // Table columns: # | Address | Swaps | Success | Failed | FOGO Volume | iFOGO Volume | P&L
    const colWidth = {
      id: 4,
      addr: 16,
      swaps: 7,
      success: 7,
      failed: 6,
      sellVol: 14,
      buyVol: 14,
      pnl: 14
    };
    
    // Header row
    const header = [
      "#".padStart(colWidth.id),
      "Address".padEnd(colWidth.addr),
      "Swaps".padStart(colWidth.swaps),
      "✓".padStart(colWidth.success),
      "✗".padStart(colWidth.failed),
      "FOGO Vol".padStart(colWidth.sellVol),
      "iFOGO Vol".padStart(colWidth.buyVol),
      "P&L (FOGO)".padStart(colWidth.pnl)
    ].join(" | ");
    
    report.push(header);
    report.push("-".repeat(100));
    
    // Data rows
    for (const wallet of sortedWallets) {
      const diff = wallet.finalFogo !== null && wallet.initialFogo !== null
        ? Number(wallet.finalFogo - wallet.initialFogo) / 1e9
        : 0;
      
      const shortAddr = wallet.address.slice(0, 8) + "..." + wallet.address.slice(-4);
      const stats = wallet.stats || { total: 0, success: 0, failed: 0 };
      const sellVol = wallet.volume ? Number(wallet.volume.sell) / 1e9 : 0;
      const buyVol = wallet.volume ? Number(wallet.volume.buy) / 1e9 : 0;
      
      const row = [
        String(wallet.index).padStart(colWidth.id),
        shortAddr.padEnd(colWidth.addr),
        String(stats.total).padStart(colWidth.swaps),
        String(stats.success).padStart(colWidth.success),
        String(stats.failed).padStart(colWidth.failed),
        sellVol.toFixed(4).padStart(colWidth.sellVol),
        buyVol.toFixed(4).padStart(colWidth.buyVol),
        (diff >= 0 ? "+" : "").padStart(colWidth.pnl - 1) + diff.toFixed(4)
      ].join(" | ");
      
      report.push(row);
    }
    
    report.push("-".repeat(100));
    
    // Total row
    const totalRow = [
      "TOTAL".padStart(colWidth.id),
      `${sortedWallets.length} wallets`.padEnd(colWidth.addr),
      String(totalSwaps).padStart(colWidth.swaps),
      "-".padStart(colWidth.success),
      "-".padStart(colWidth.failed),
      (Number(totalSellVolume) / 1e9).toFixed(4).padStart(colWidth.sellVol),
      (Number(totalBuyVolume) / 1e9).toFixed(4).padStart(colWidth.buyVol),
      (totalLoss >= 0 ? "+" : "").padStart(colWidth.pnl - 1) + totalLoss.toFixed(4)
    ].join(" | ");
    
    report.push(totalRow);
    report.push("");
    
    // Detailed breakdown per wallet
    report.push("=".repeat(100));
    report.push("                           DETAILED BREAKDOWN");
    report.push("=".repeat(100));
    report.push("");
    
    for (const wallet of sortedWallets) {
      const diff = wallet.finalFogo !== null && wallet.initialFogo !== null
        ? Number(wallet.finalFogo - wallet.initialFogo) / 1e9
        : 0;
      
      report.push(`Wallet ${wallet.index}: ${wallet.address}`);
      report.push("─".repeat(100));
      report.push(`  Initial:  ${this.formatFogo(wallet.initialFogo)} FOGO  |  ${this.formatFogo(wallet.initialIfofo)} iFOGO`);
      report.push(`  Final:    ${this.formatFogo(wallet.finalFogo)} FOGO  |  ${this.formatFogo(wallet.finalIfofo)} iFOGO`);
      report.push(`  P&L:      ${diff >= 0 ? '+' : ''}${diff.toFixed(9)} FOGO`);
      
      if (wallet.volume) {
        report.push(`  Volume:   FOGO ${(Number(wallet.volume.sell) / 1e9).toFixed(4)} SELL  |  iFOGO ${(Number(wallet.volume.buy) / 1e9).toFixed(4)} BUY`);
      }
      
      if (wallet.stats) {
        report.push(`  Stats:    ${wallet.stats.total} swaps | ✅ ${wallet.stats.success} | ❌ ${wallet.stats.failed}`);
      }
      report.push("");
    }
    
    report.push("=".repeat(100));
    report.push("                                SUMMARY");
    report.push("=".repeat(100));
    report.push("");
    report.push(`  Total Wallets:       ${sortedWallets.length}`);
    report.push(`  Total Swaps:         ${totalSwaps}`);
    report.push(`  Total FOGO Volume:   ${(Number(totalSellVolume) / 1e9).toFixed(4)} FOGO`);
    report.push(`  Total iFOGO Volume:  ${(Number(totalBuyVolume) / 1e9).toFixed(4)} iFOGO`);
    report.push(`  Total P&L:           ${totalLoss >= 0 ? '+' : ''}${totalLoss.toFixed(9)} FOGO`);
    report.push("");
    report.push("  P&L Explanation:");
    report.push(`    • NEGATIVE (-) = Normal loss from fees (0.05%) + slippage`);
    report.push(`    • POSITIVE (+) = iFOGO price increased vs FOGO during swaps`);
    report.push(`                     OR arbitrage opportunity captured`);
    report.push(`    • Your P&L: ${totalLoss >= 0 ? 'POSITIVE (iFOGO appreciated)' : 'NEGATIVE (normal trading loss)'}`);
    report.push("");
    report.push("=".repeat(100));
    report.push("                              END OF REPORT");
    report.push("=".repeat(100));

    return report.join("\n");
  }

  generateJSON() {
    const endTime = new Date();
    const duration = ((endTime - this.startTime) / 1000 / 60).toFixed(2);
    
    const sortedWallets = [...this.wallets].sort((a, b) => a.id - b.id);
    
    let totalLoss = 0;
    let totalSwaps = 0;
    let totalSellVolume = 0n;
    let totalBuyVolume = 0n;
    
    const walletData = sortedWallets.map(wallet => {
      const diff = wallet.finalFogo !== null && wallet.initialFogo !== null
        ? Number(wallet.finalFogo - wallet.initialFogo) / 1e9
        : 0;
      totalLoss += diff;
      if (wallet.stats) {
        totalSwaps += wallet.stats.total;
      }
      if (wallet.volume) {
        totalSellVolume += wallet.volume.sell;
        totalBuyVolume += wallet.volume.buy;
      }
      
      return {
        index: wallet.index,
        address: wallet.address,
        initialFogo: this.formatFogo(wallet.initialFogo),
        initialIfofo: this.formatFogo(wallet.initialIfofo),
        finalFogo: this.formatFogo(wallet.finalFogo),
        finalIfofo: this.formatFogo(wallet.finalIfofo),
        pnl: diff.toFixed(9),
        stats: wallet.stats || { total: 0, success: 0, failed: 0 },
        volume: {
          sell: wallet.volume ? (Number(wallet.volume.sell) / 1e9).toFixed(4) : "0.0000",
          buy: wallet.volume ? (Number(wallet.volume.buy) / 1e9).toFixed(4) : "0.0000"
        }
      };
    });
    
    return {
      meta: {
        startTime: this.startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: parseFloat(duration),
        totalWallets: this.wallets.length,
        cycles: CONFIG.cycles,
        mode: CONFIG.parallel ? 'PARALLEL' : 'SEQUENTIAL',
        batchSize: CONFIG.batchSize,
        network: CONFIG.network,
        pool: 'FOGO-iFOGO (0.05% fee)',
        dryRun: CONFIG.dryRun
      },
      summary: {
        totalWallets: sortedWallets.length,
        totalSwaps: totalSwaps,
        totalSellVolume: (Number(totalSellVolume) / 1e9).toFixed(4),
        totalBuyVolume: (Number(totalBuyVolume) / 1e9).toFixed(4),
        totalPnl: totalLoss.toFixed(9)
      },
      wallets: walletData
    };
  }

  save() {
    // Save text report
    const content = this.generate();
    fs.writeFileSync(this.filename, content, "utf8");
    
    // Save JSON report for UI
    const jsonContent = JSON.stringify(this.generateJSON(), null, 2);
    const jsonFilename = this.filename.replace('.txt', '.json');
    fs.writeFileSync(jsonFilename, jsonContent, "utf8");
  }
}

// Logger với prefix
function createLogger(walletIndex) {
  const prefix = `[W${walletIndex}]`;
  return {
    log: (msg, type = "INFO") => {
      const icons = { INFO: "ℹ️", SWAP: "🔄", OK: "✅", ERR: "❌", WARN: "⚠️", STAT: "📊", BAL: "💰", WALL: "👛" };
      const time = new Date().toISOString().replace("T", " ").slice(0, 19);
      console.log(`[${time}] ${icons[type] || "•"} ${prefix} ${msg}`);
    }
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatFogo(lamports) {
  return (Number(lamports) / 1e9).toFixed(9);
}

// ============================================
// Load wallets from file
// ============================================

function loadPrivateKeys(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Wallets file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split('\n');
  
  const privateKeys = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.includes('...')) continue;
    privateKeys.push(trimmed);
  }
  
  return privateKeys;
}

async function loadWalletFromPrivateKey(base58PrivateKey) {
  const keypairBytes = base58Decode(base58PrivateKey);
  const signer = await createKeyPairSignerFromBytes(keypairBytes);
  return {
    signer,
    address: signer.address,
  };
}

// ============================================
// Retry helper for RPC calls
// ============================================

async function withTimeout(promise, timeoutMs = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await withTimeout(fn(), 30000); // 30 second timeout
    } catch (err) {
      lastError = err;
      const isRetryable = err.message?.includes('520') || 
                          err.message?.includes('timeout') ||
                          err.message?.includes('ECONNRESET') ||
                          err.message?.includes('Timeout') ||
                          err.statusCode >= 500;
      
      if (!isRetryable) throw err;
      
      if (i < maxRetries - 1) {
        console.log(`  ⚠️ RPC error (attempt ${i + 1}/${maxRetries}), retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

// ============================================
// Check balances
// ============================================

async function getBalances(rpc, walletAddress, walletLabel = '?') {
  console.log(`    [W${walletLabel}] Getting balances...`);
  
  const fogoBalance = await withRetry(() => rpc.getBalance(walletAddress).send());
  const fogoLamports = fogoBalance.value;
  console.log(`    [W${walletLabel}] FOGO balance: ${Number(fogoLamports)/1e9}`);
  
  // Get iFOGO balance
  const ifogoTokenAccounts = await withRetry(() => rpc.getTokenAccountsByOwner(
    walletAddress,
    { mint: address(TOKEN_MINTS.iFOGO) },
    { encoding: "jsonParsed" }
  ).send());
  
  let ifogoLamports = 0n;
  if (ifogoTokenAccounts.value.length > 0) {
    const accountInfo = ifogoTokenAccounts.value[0].account.data.parsed.info;
    ifogoLamports = BigInt(accountInfo.tokenAmount.amount);
  }
  console.log(`    [W${walletLabel}] iFOGO balance: ${Number(ifogoLamports)/1e9}`);
  
  // Get USDC balance (only check if using USDC pair)
  let usdcLamports = 0n;
  if (CONFIG.swapPair === "USDC") {
    const usdcTokenAccounts = await withRetry(() => rpc.getTokenAccountsByOwner(
      walletAddress,
      { mint: address(TOKEN_MINTS.USDC) },
      { encoding: "jsonParsed" }
    ).send());
    
    if (usdcTokenAccounts.value.length > 0) {
      const accountInfo = usdcTokenAccounts.value[0].account.data.parsed.info;
      usdcLamports = BigInt(accountInfo.tokenAmount.amount);
    }
    console.log(`    [W${walletLabel}] USDC balance: ${Number(usdcLamports)/1e6}`); // USDC has 6 decimals
  }
  
  return { fogo: fogoLamports, ifogo: ifogoLamports, usdc: usdcLamports };
}

// ============================================
// Swap executor
// ============================================

async function executeSwap(rpc, wallet, poolData, poolAddr, amount, direction, logger) {
  const poolCfg = POOL_CONFIG[CONFIG.swapPair];
  const dirLabel = direction === "buy" ? poolCfg.buyLabel : poolCfg.sellLabel;
  logger.log(`${dirLabel} | Amount: ${formatFogo(amount)} FOGO`, "SWAP");

  if (amount <= 0n) {
    logger.log("Amount is 0, skipping swap", "WARN");
    return { success: false, error: "Zero amount" };
  }

  try {
    const tickArrayAddresses = await prepareTickArrayAddressesForSwap(
      poolData.tickSpacing,
      poolData.tickCurrentIndex,
      address(poolAddr)
    );

    const tokenProgramAddresses = [
      address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    ];

    const aForB = direction === "sell";

    const sessionSigner = {
      address: wallet.address,
      signer: wallet.signer
    };

    const result = await swapInstructionsWithAmounts(
      rpc,
      {
        inputAmount: amount,
        outputAmount: 0n,
        aForB: aForB,
        isExactIn: true,
      },
      poolData,
      address(poolAddr),
      tickArrayAddresses,
      tokenProgramAddresses,
      sessionSigner,
      false,
      wallet.signer,
      false
    );

    if (CONFIG.dryRun) {
      logger.log(`[DRY RUN] Would execute swap`, "WARN");
      return { success: true, dryRun: true };
    }

    const signature = await withRetry(() => buildAndSendTransaction(
      result.instructions,
      wallet.signer,
      [],
      "confirmed"
    ), 3, 2000);
    
    logger.log(`TX confirmed: ${signature.slice(0, 20)}...`, "OK");
    return { success: true, signature };

  } catch (err) {
    logger.log(`Swap failed: ${err.message}`, "ERR");
    return { success: false, error: err.message };
  }
}

// ============================================
// Process single wallet
// ============================================

async function processWallet(rpc, poolData, privateKey, walletIndex, totalWallets, report) {
  // Staggered delay for parallel mode to avoid RPC overload
  if (CONFIG.parallel) {
    const staggerDelay = (walletIndex - 1) * 500; // 500ms between each wallet
    console.log(`[W${walletIndex}] Waiting ${staggerDelay}ms stagger delay...`);
    await sleep(staggerDelay);
  }
  
  const logger = createLogger(walletIndex);
  
  console.log(`[W${walletIndex}] ============================================ START`);
  logger.log(`════════════════════════════════════════════════════════════`, "WALL");
  logger.log(`Processing Wallet ${walletIndex}/${totalWallets}`, "WALL");
  logger.log(`════════════════════════════════════════════════════════════`, "WALL");
  
  let wallet;
  try {
    wallet = await loadWalletFromPrivateKey(privateKey);
    logger.log(`Wallet loaded: ${wallet.address.slice(0, 20)}...`, "WALL");
  } catch (err) {
    logger.log(`Failed to load wallet: ${err.message}`, "ERR");
    return { success: false, error: err.message, index: walletIndex };
  }
  
  // Show initial balances
  const initialBalances = await getBalances(rpc, wallet.address, walletIndex);
  logger.log(`Initial: FOGO=${formatFogo(initialBalances.fogo)}, iFOGO=${formatFogo(initialBalances.ifogo)}`, "BAL");
  
  // Add to report và nhận về walletId
  const walletId = await report.addWallet(wallet.address, initialBalances.fogo, initialBalances.ifogo);
  
  // Stats for this wallet
  const stats = { total: 0, success: 0, failed: 0 };
  const volume = { sell: 0n, buy: 0n }; // Theo dõi volume
  let cycleCount = 0;
  
  const poolCfg = POOL_CONFIG[CONFIG.swapPair];
  
  // Main loop - each cycle: SELL then BUY
  while (cycleCount < CONFIG.cycles) {
    logger.log(`--- Starting Cycle ${cycleCount + 1}/${CONFIG.cycles} ---`, "INFO");
    
    // === STEP 1: SELL (FOGO → TokenB) - Random SELL amount ===
    const balancesBeforeSell = await getBalances(rpc, wallet.address, walletIndex);
    
    // Random số FOGO từ CONFIG.randomSellMin đến CONFIG.randomSellMax
    const minSell = CONFIG.randomSellMin;
    const maxSell = CONFIG.randomSellMax;
    const range = maxSell - minSell;
    const randomSell = minSell + BigInt(Math.floor(Math.random() * Number(range)));
    
    // Lấy min(randomSell, available balance)
    const availableForSell = balancesBeforeSell.fogo > CONFIG.gasReserve 
      ? balancesBeforeSell.fogo - CONFIG.gasReserve 
      : 0n;
    
    const sellAmount = randomSell < availableForSell ? randomSell : availableForSell;
    
    logger.log(`Random SELL amount: ${formatFogo(randomSell)} FOGO (available: ${formatFogo(availableForSell)} FOGO)`, "INFO");
    
    if (sellAmount <= 0n) {
      logger.log("Not enough FOGO to SELL, skipping this cycle", "WARN");
      break;
    }
    
    const sellResult = await executeSwap(
      rpc, wallet, poolData, POOL_CONFIG[CONFIG.swapPair].address,
      sellAmount, "sell", logger
    );
    
    stats.total++;
    if (sellResult.success) {
      stats.success++;
      volume.sell += sellAmount; // Cộng volume SELL
    }
    else stats.failed++;
    
    if (!sellResult.success) {
      logger.log("SELL failed, skipping to next cycle", "ERR");
      await sleep(CONFIG.delayMs);
      continue;
    }
    
    await sleep(CONFIG.delayMs);
    
    // === STEP 2: BUY (TokenB → FOGO) - Max (full balance) ===
    const balancesBeforeBuy = await getBalances(rpc, wallet.address, walletIndex);
    
    // For BUY, use TokenB balance (iFOGO or USDC)
    const buyAmount = CONFIG.swapPair === "USDC" ? balancesBeforeBuy.usdc : balancesBeforeBuy.ifogo;
    const buyTokenName = CONFIG.swapPair === "USDC" ? "USDC" : "iFOGO";
    
    logger.log(`Max BUY amount: ${formatFogo(buyAmount)} ${buyTokenName} (full balance)`, "INFO");
    
    if (buyAmount <= 0n) {
      logger.log("No iFOGO to BUY, cycle incomplete", "WARN");
      await sleep(CONFIG.delayMs);
      continue;
    }
    
    const buyResult = await executeSwap(
      rpc, wallet, poolData, POOL_CONFIG[CONFIG.swapPair].address,
      buyAmount, "buy", logger
    );
    
    stats.total++;
    if (buyResult.success) {
      stats.success++;
      volume.buy += buyAmount; // Cộng volume BUY
    }
    else stats.failed++;
    
    if (!buyResult.success) {
      logger.log("BUY failed, cycle incomplete", "ERR");
    } else {
      cycleCount++;
      logger.log(`Cycle ${cycleCount}/${CONFIG.cycles} COMPLETED! ✅`, "OK");
    }
    
    if (cycleCount < CONFIG.cycles) {
      logger.log(`Waiting ${CONFIG.cycleDelayMs}ms before next cycle...`, "INFO");
      await sleep(CONFIG.cycleDelayMs);
    }
  }
  
  // Show final balances
  const finalBalances = await getBalances(rpc, wallet.address, walletIndex);
  logger.log(`Final: FOGO=${formatFogo(finalBalances.fogo)}, iFOGO=${formatFogo(finalBalances.ifogo)}`, "BAL");
  
  // Update report dùng walletId thay vì walletIndex
  await report.updateWalletFinal(walletId, finalBalances.fogo, finalBalances.ifogo, stats, volume);
  
  // Calculate and show difference
  const diff = Number(finalBalances.fogo - initialBalances.fogo) / 1e9;
  logger.log(`Change: ${diff >= 0 ? '+' : ''}${diff.toFixed(9)} FOGO`, diff < 0 ? "WARN" : "OK");
  
  logger.log(`Stats: ${stats.total} swaps | ✅${stats.success} | ❌${stats.failed}`, "STAT");
  logger.log(`Wallet ${walletIndex} completed`, "WALL");
  console.log(`[W${walletIndex}] ============================================ DONE`);
  
  return { success: true, stats, index: walletIndex };
}

// ============================================
// Main
// ============================================

async function main() {
  // Select pool first
  const selectedPool = await selectPool();
  CONFIG.swapPair = selectedPool;
  
  const poolCfg = POOL_CONFIG[selectedPool];
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🔥 Valiant DEX Swap Bot (Fogo)  🔥                  ║
║         ${CONFIG.parallel ? 'PARALLEL MODE' : 'SEQUENTIAL MODE'} - Multi-Wallet          ║
╚══════════════════════════════════════════════════════════════╝
  `);

  console.log(`Network:    ${CONFIG.network}`);
  console.log(`RPC:        ${CONFIG.rpcUrl}`);
  console.log(`Pool:       ${poolCfg.tokenA}-${poolCfg.tokenB} (0.05% fee)`);
  console.log(`Address:    ${poolCfg.address}`);
  console.log(`Gas Reserve: ${formatFogo(CONFIG.gasReserve)} FOGO`);
  console.log(`Slippage:   ${CONFIG.slippageBps} bps`);
  console.log(`Swap Delay: ${CONFIG.delayMs}ms`);
  console.log(`Cycle Delay:${CONFIG.cycleDelayMs}ms`);
  console.log(`Cycles:     ${CONFIG.cycles} mỗi ví`);
  console.log(`SELL:       Random 10-20 ${poolCfg.tokenA} → ${poolCfg.tokenB}`);
  console.log(`BUY:        Max ${poolCfg.tokenB} → ${poolCfg.tokenA}`);
  console.log(`Mode:       ${CONFIG.parallel ? `PARALLEL (${CONFIG.batchSize} ví/cùng lúc)` : 'SEQUENTIAL (1 ví/lần)'}`);
  console.log(`Wallets:    ${CONFIG.walletsFile}`);
  console.log(`Report:     ${CONFIG.reportFile}`);
  console.log(`Dry run:    ${CONFIG.dryRun}`);
  console.log("─".repeat(60));
  
  // Initialize report
  const report = new AsyncReportGenerator(CONFIG.reportFile);
  
  // Load private keys
  let privateKeys;
  try {
    privateKeys = loadPrivateKeys(CONFIG.walletsFile);
    console.log(`Loaded ${privateKeys.length} wallets from ${CONFIG.walletsFile}`);
  } catch (err) {
    console.error(`Error loading wallets: ${err.message}`);
    process.exit(1);
  }
  
  if (privateKeys.length === 0) {
    console.error("No wallets found! Please add private keys to wallets.txt");
    process.exit(1);
  }
  
  console.log("Initializing Vortex SDK...");
  await setVortexConfig(CONFIG.network);
  
  console.log("Connecting to Fogo RPC...");
  const rpc = createSolanaRpc(CONFIG.rpcUrl);
  
  console.log("Initializing tx-sender...");
  await setRpc(CONFIG.rpcUrl);
  
  console.log("Fetching pool data...");
  let pool;
  try {
    pool = await withRetry(() => fetchVortex(rpc, address(POOL_CONFIG[CONFIG.swapPair].address)), 5, 2000);
    console.log(`Pool tick: ${pool.data.tickCurrentIndex}, liquidity: ${pool.data.liquidity}`);
  } catch (err) {
    console.error(`❌ Failed to fetch pool data after retries: ${err.message}`);
    console.error("The Fogo RPC may be temporarily unavailable. Please try again later.");
    process.exit(1);
  }
  
  console.log("─".repeat(60));
  console.log(`🚀 Starting to process ${privateKeys.length} wallets...`);
  console.log(`   Pattern: ${CONFIG.cycles} chu kỳ/ví`);
  console.log(`   Wallets: ${privateKeys.map((_, i) => `W${i+1}`).join(', ')}\n`);

  // Process wallets
  if (CONFIG.parallel) {
    // PARALLEL MODE - Chạy song song theo batch
    for (let i = 0; i < privateKeys.length; i += CONFIG.batchSize) {
      const batch = privateKeys.slice(i, i + CONFIG.batchSize);
      const batchIndices = batch.map((_, idx) => i + idx + 1);
      
      console.log(`\n>>> Launching batch ${Math.floor(i/CONFIG.batchSize) + 1}: Wallets ${batchIndices.join(', ')}`);
      
      const promises = batch.map((pk, idx) => {
        const walletIndex = i + idx + 1;
        console.log(`  [Batch] Starting W${walletIndex}...`);
        return processWallet(rpc, pool.data, pk, walletIndex, privateKeys.length, report)
          .catch(err => {
            console.error(`  [Batch] W${walletIndex} FAILED: ${err.message}`);
            return { success: false, error: err.message, index: walletIndex };
          });
      });
      
      await Promise.all(promises);
      console.log(`  [Batch] All wallets in batch completed`);
      
      if (i + CONFIG.batchSize < privateKeys.length) {
        console.log(`\n>>> Batch completed. Waiting 5s before next batch...`);
        await sleep(5000);
      }
    }
  } else {
    // SEQUENTIAL MODE - Chạy tuần tự
    for (let i = 0; i < privateKeys.length; i++) {
      await processWallet(rpc, pool.data, privateKeys[i], i + 1, privateKeys.length, report);
      
      if (i < privateKeys.length - 1) {
        await sleep(5000);
      }
    }
  }
  
  // Generate and save report
  report.save();
  
  console.log("\n" + "═".repeat(60));
  console.log("🏁 ALL WALLETS COMPLETED!");
  console.log(`Report saved to: ${CONFIG.reportFile}`);
  console.log("═".repeat(60));
  
  // Force exit with multiple attempts to prevent hanging
  setTimeout(() => {
    console.log("Force exiting...");
    process.exit(0);
  }, 1000);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

// Ensure exit on beforeExit
process.on('beforeExit', () => {
  console.log('Before exit event, forcing exit...');
  process.exit(0);
});