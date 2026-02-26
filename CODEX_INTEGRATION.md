# Codex API Integration for Volume Tracker

## Overview

Volume tracker tự động so sánh **RPC-calculated volume** vs **Codex API data** để xác định phương pháp tính nào khớp với **Fogoscan/Fuul leaderboard**.

## Tính năng Auto-Enabled 🔮

**Không cần setup!** Mọi ngườí dùng đều tự động thấy comparison khi fetch volume.

## Why Use Codex?

Leaderboard hiển thị các phương pháp tính volume khác nhau:
- **Fogoscan value (1-side)**: $68.63K
- **Stablecoin side USD**: $68.02K  
- **Both sides USD (recommended)**: $131.88K ← Leaderboard dùng cái này
- **wFOGO side only**: $63.86K

**Note**: Fogoscan chỉ capture AMM swaps, không bao gồm CLOB (order book) trades.

## Cách sử dụng

### 1. Fetch Volume như bình thường
1. Nhập wallet address
2. Chọn date range
3. Click "📊 Fetch Volume Data"

### 2. Xem Comparison
Scroll xuống section "🔮 Volume Comparison" để thấy:
- RPC Calculated (cách tính hiện tại)
- Codex API (dữ liệu từ Codex)
- Difference (% chênh lệch)
- Method label (One side / Both sides)

## Understanding the Comparison

### Method Labels

| Label | Meaning | Leaderboard Match |
|-------|---------|-------------------|
| **Both sides (2x)** | Codex volume ≈ 2x RPC volume | ✅ Matches "Both sides USD" |
| **One side** | Codex volume ≈ 1x RPC volume | ✅ Matches "1-side" methods |
| **Mixed** | Ratio between 1.2x-1.8x | ⚠️ Partial match |
| **Other** | Outside expected range | ❌ Check data |
| **Codex only** | RPC shows 0, Codex has data | ⚠️ Check wallet transactions |
| **RPC only** | Codex shows 0, RPC has data | ⚠️ Codex may not index this pool |

### Example Comparison Table

| Pool | RPC Calculated | Codex API | Difference | Method |
|------|---------------|-----------|------------|--------|
| FOGO-iFOGO | $1,000 | $2,000 | +100% | Both sides (2x) |
| FOGO-USDC | $500 | $500 | 0% | One side |
| **TOTAL** | **$1,500** | **$2,500** | **+67%** | - |

## Constants Used

From [fogo-agent-kit](../fogo-agent-kit/) SDK:

### Network
- **Network ID**: 150601 (Fogo in Codex)
- **RPC**: https://mainnet.fogo.io/

### Token Addresses
| Token | Address |
|-------|---------|
| FOGO | `So11111111111111111111111111111111111111112` |
| USDC | `uSd2czE61Evaf76RNbq4KPpXnkiL3irdzgLFUMe3NoG` |
| iFOGO | `iFoGoY5nMWpuMJogR7xjUAWDJtygHDF17zREeP4MKuD` |
| stFOGO | `Brasa3xzkSC9XqMBEcN9v53x4oMkpb1nQwfaGMyJE88b` |
| wFOGO | `HLc5qava5deWKeoVkN9nsu9RrqqD8PoHaGsvQzPFNbxR` |

### Pool Addresses
| Pool | Address |
|------|---------|
| FOGO-iFOGO | `HULdR8aMSxJAiNJmrTBcfKN4Zq6FgG33AHbQ3nDD8P5E` |
| FOGO-USDC | `J7mxBLSz51Tcbog3XsiJTAXS64N46KqbpRGQmd3dQMKp` |
| FOGO-stFOGO | `Be2eoA9g1Yp8WKqMM14tXjSHuYCudaPpaudLTmC4gizp` |

## API Reference

### Codex GraphQL Endpoints Used

```graphql
# Get historical bars (OHLCV)
query GetBars($pairAddress: String!, $networkId: Int!, $from: Int!, $to: Int!, $resolution: String!) {
  getBars(pairAddress: $pairAddress, networkId: $networkId, from: $from, to: $to, resolution: $resolution) {
    bars {
      timestamp
      volume
      txns
      uniqueBuyers
      uniqueSellers
    }
  }
}

# Get pair metadata
query GetPairMetadata($pairAddress: String!, $networkId: Int!) {
  pair(pairAddress: $pairAddress, networkId: $networkId) {
    volume24h: volume24
    volume7d: volume7d
    liquidity
    token0 { symbol price }
    token1 { symbol price }
  }
}
```

## Troubleshooting

### Codex comparison không hiển thị
- Mặc định đã bật sẵn, nếu không thấy có thể do:
  - Rate limit từ Codex API
  - Lỗi kết nối mạng
  - Pool chưa được index bởi Codex

### Codex volume = 0
- Kiểm tra date range có chứa giao dịch thực tế không
- Một số pool có thể chưa được Codex index đầy đủ
- Thử mở rộng date range

### Chênh lệch lớn giữa RPC và Codex
- Điều này là bình thường nếu họ dùng phương pháp khác nhau
- "Both sides" vs "One side" có thể chênh 2x
- Xem Method label để hiểu cách tính

### Rate limiting / Lỗi API
- Nếu gặp lỗi rate limit thường xuyên, bạn có thể:
  1. Mở phần "🔧 Nâng cao"
  2. Nhập Codex API key riêng (lấy từ codex.io)
  3. Click **Save**
- Key riêng của bạn sẽ được ưu tiên sử dụng

## References

- [Codex Docs](https://docs.codex.io/)
- [Fogo Agent Kit](../fogo-agent-kit/)
- [Valiant Skill](../fogo-agent-kit/skills/valiant/SKILL.md)
- [Data Providers Skill](../fogo-agent-kit/skills/data-providers/SKILL.md)
