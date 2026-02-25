import urllib.request
import json
from datetime import datetime, timezone

wallet = '5ZwXmBu3ZvTRmFGSoyUb4rX5R9SAz5fKropohACsAmf5'
helius_key = '7e3f5e80-2bd8-4f8e-bacd-c62c40fe3849'

url = f'https://mainnet.helius-rpc.com/?api-key={helius_key}'
data = {
    'jsonrpc': '2.0',
    'id': 1,
    'method': 'getSignaturesForAddress',
    'params': [wallet, {'limit': 100}]
}

req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=30) as resp:
    result = json.loads(resp.read())
    sigs = result.get('result', [])
    print(f'Total signatures fetched: {len(sigs)}')
    if sigs:
        first_time = datetime.fromtimestamp(sigs[0]['blockTime'], tz=timezone.utc)
        last_time = datetime.fromtimestamp(sigs[-1]['blockTime'], tz=timezone.utc)
        print(f'First: {first_time}')
        print(f'Last: {last_time}')
        print(f'Days span: {(first_time - last_time).days} days')
