import urllib.request
import json

signature = '5ER7hjggtjwYdexPFTEsAhZmc5wULzTVEEcBs7ERfY2PVA2wv7DuM3F7NgeSPU4KpAU6xGBHUiKEvoPYxEucL9eR'

# Helius API không cần key cho getTransaction? Thử Fogo RPC
data = {
    'jsonrpc': '2.0',
    'id': 1,
    'method': 'getTransaction',
    'params': [signature, {'encoding': 'jsonParsed', 'maxSupportedTransactionVersion': 0}]
}

url = 'https://mainnet.fogo.io/'
req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        tx = result.get('result', {})
        
        print('Transaction found!')
        print('Slot:', tx.get('slot'))
        print('Block time:', tx.get('blockTime'))
        
        meta = tx.get('meta', {})
        print('Err:', meta.get('err'))
        
        # Look for inner instructions
        inner_ixs = meta.get('innerInstructions', [])
        print(f'\nInner instructions: {len(inner_ixs)}')
        
        # Parse token transfers
        for inner in inner_ixs:
            for inst in inner.get('instructions', []):
                if inst.get('parsed', {}).get('type') == 'transfer':
                    info = inst['parsed']['info']
                    src = info.get('source', '')[:20]
                    dst = info.get('destination', '')[:20]
                    amt = info.get('amount')
                    print(f"Transfer: {amt} from {src}... to {dst}...")
                    
except Exception as e:
    print(f'Error: {e}')
