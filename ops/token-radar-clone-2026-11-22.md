# Toyol TokenRadar — separated clone operating protocol

**Mandate:** 22 November 2026. Official competition: https://make.fun/bounty/token-radar-01
**Deadline:** 2026-12-14 10:00 UTC = 18:00 Malaysia time.
**Owner's exact instruction:** Hantar 1 klon untuk build the best token launch radar. Boleh bina kemahiran bina token tu.

## Goal and acceptance

Build a **contest-quality, offline DeFi tokenless protocol radar**, not a token launch. Use the sealed DefiLlama snapshot in the official kit, never a live feed as substitute.

A valid contest candidate must:
1. Have a main.ts at the root of a new post-opening public repository OR an officially anchored source-bundle repo, plus vendor/makefun-board.ts, dashboard and screenshots.
2. Use Node.js 22.18 or later and a working Chrome/Chromium browser.
3. Cover **every** snapshot.watchlist slug (40 in kit) and at least 100 token-not-recorded rows. Never confuse a missing index token with proof no token exists.
4. Derive nonconstant implied_value_usd from snapshot TVL, 7-day growth, protocol age, explicit multipliers and caveats. Consecutive ranks descending by value.
5. Give every row 3–12 concrete farm_steps of 20–600 characters, including costs and time estimates; never promise an airdrop or rely on an unverified token distribution.
6. Deliver actual offline board, detail and filter views and three honest screenshots captured from the built page. Dossier byte-for-byte created using the official vendor library.
7. Produce stable bytes on two identical runs. Test the watchlist, rank uniqueness and invariants.
8. Preserve original complete recorded agent sessions. Never invent logs, token usage, thinking, parent sessions, system prompts, screenshots, scores, or results.
9. Run the official makefun check with the genuine transcript bundle and do **not** submit unless it passes and the account/wallet path is legitimate.
10. Stop a run after the deadline, on quota exhaustion, secret requests or paid-model/deposit requirements. No speculative or fee-bearing on-chain calls.

## Strict separation

Dedicated GitHub workflow: .github/workflows/toyol-token-launch-radar.yml. Never modify other Toyol workflows, MYReady or user projects.

**Allowed:** official docs/kit, transparent zero-cost coding-model attempts, isolated source bundle, local tests, GitHub artifacts, read-only chain checks.
**Not allowed without new owner approval:** production token mint/deployment; crypto purchase, swap, bridge, staking, contract allowance or funding; airdrop claiming; release of wallet keys; false revenue, fake sessions or inflated scores.

## Token-engineering skill track

Separate from contest grading and optional. Learn EIP-20/ERC-20 API, fungible token accounting, supply/mint/burn, decimals, allowances, roles and multisig controls, caps/vesting, tokenomics, governance, security tests, testnet simulations, deployment reviews and user protections. Start with **offline toy ledger and tests** only. No live token, fundraising or speculative promises.

## Public references

- Official brief: https://make.fun/bounty/token-radar-01
- Requirements: https://make.fun/api/competitions/token-radar-01/requirements
- Mission issue: https://github.com/ilhamraduanbis-source/toyol-digital/issues/9
- Verified previous Toyol Solana **public** wallet: At7TxA4e81Ai8X2TWZq944NSSbP1HaJB9iRug4vD1uQ (no keys in this file).

Track separate statuses: scouted, built, locally tested, official gate passed, submitted, ranked, and actually paid. Prize pool is 1,325 USDC across ten winners, **not income already earned**.
