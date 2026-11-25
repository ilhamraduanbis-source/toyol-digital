# Cashu Mint Preflight

Original Toyol Digital project for Nut November 2026, built on 25 November. A dependency-free offline tool for checking public Cashu mint metadata and estimating input fees without reading private proofs or making transactions. It consumes snapshots of /v1/info and /v1/keysets (or runs on fictional demo fixtures), reports active output units, inactive inputs, declared mint/melt methods, amount limits and batch limits, and calculates NUT-02 fees from synthetic counts. No network, wallet, secrets or deposits required.

## Run

```sh
python3 mint_preflight.py --demo
python3 mint_preflight.py --self-test
python3 mint_preflight.py --info info.json --keysets keysets.json --counts counts.json
```

Counts map public keyset IDs to integer counts, not proof objects. Fee estimates are per unit and round once after summing all input fees. No assertion about an individual mint's reserves, cryptographic keyset ID derivation, actual support, availability or redeemability. Unknown ID versions fail closed. Only the advertised metadata is assessed; missing optional NUT-06 fields are unknown, not unsupported. Fixtures are synthetic. AI-assisted source, MIT-licensed in this directory. Specs: https://github.com/cashubtc/nuts/blob/main/06.md and https://github.com/cashubtc/nuts/blob/main/02.md.