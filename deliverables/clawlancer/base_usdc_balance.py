#!/usr/bin/env python3
"""Read-only USDC balance on Base (chain ID 8453) using the public JSON-RPC."""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from decimal import Decimal

USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
DEFAULT_RPC = "https://mainnet.base.org"

class RPCError(RuntimeError):
    pass

def rpc_call(endpoint, method, params):
    if not endpoint.startswith("https://"):
        raise RPCError("Use an HTTPS RPC endpoint.")
    request = urllib.request.Request(
        endpoint,
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = response.read(300000)
            if len(data) >= 300000:
                raise RPCError("RPC response unexpectedly large")
            obj = json.loads(data)
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise RPCError(f"RPC request failed: {type(exc).__name__}") from exc
    if not isinstance(obj, dict) or obj.get("error") or not isinstance(obj.get("result"), str):
        raise RPCError("RPC returned an error or missing result")
    return obj["result"]

def balance(wallet, endpoint=DEFAULT_RPC):
    if not re.fullmatch(r"0x[a-fA-F0-9]{40}", wallet):
        raise ValueError("Wallet must be a 0x-prefixed 20-byte EVM address")
    if rpc_call(endpoint, "eth_chainId", []) != "0x2105":
        raise RPCError("Refusing RPC for non-Base chain")
    # ERC20 balanceOf(address): function selector 0x70a08231
    calldata = "0x70a08231" + wallet[2:].lower().rjust(64, "0")
    result = rpc_call(endpoint, "eth_call", [{"to": USDC, "data": calldata}, "latest"])
    if not re.fullmatch(r"0x[a-fA-F0-9]{64}", result):
        raise RPCError("Unexpected ERC20 ABI uint256 response")
    return Decimal(int(result, 16)) / Decimal(1_000_000)

def main(argv=None):
    parser = argparse.ArgumentParser(description="Check native USDC balance on Base, read-only")
    parser.add_argument("wallet", help="EVM address, 0x followed by 40 hex characters")
    parser.add_argument("--rpc", default=DEFAULT_RPC, help="Trusted HTTPS Base RPC endpoint")
    args = parser.parse_args(argv)
    try:
        amount = balance(args.wallet, args.rpc)
    except (ValueError, RPCError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"chainId":8453,"token":"USDC","contract":USDC,"wallet":args.wallet,"balance":f"{amount:.6f}"}))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
