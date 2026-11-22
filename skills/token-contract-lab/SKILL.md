# Toyol #TokenRadar | Token Engineering Lab

This skill is an **offline educational module**, not a real token generator, investment recommendation or deployed smart contract.

**Verified test command:** node --test skills/token-contract-lab/token-ledger.test.mjs

## Foundation — ERC-20 accounting

Read the official specification: https://eips.ethereum.org/EIPS/eip-20  
Read current OpenZeppelin ERC-20 reference: https://docs.openzeppelin.com/contracts/5.x/api/token/erc20

Learn totalSupply, balanceOf, transfer, approve, allowance and transferFrom. Study units/decimals, underflow protection, account identities, mint authority, burning, caps, approval risks and total-supply invariants.

The files token-ledger.mjs and token-ledger.test.mjs implement an **in-memory mock ledger in JavaScript**. It never signs transactions, touches a blockchain or generates wallet addresses. It cannot be sold or deployed as ERC-20. Twelve unit tests assert balances, delegated spending, capped minting, burns and invalid inputs.

## Educational Solidity example — not compiled, audited or deployed

The repository also includes `ToyolLabToken.sol`, an **illustrative** capped ERC-20 Solidity contract drafted against OpenZeppelin 5.6.1. Its Solidity compilation and security review have **not** been verified. Do not treat it as a production-ready contract or a real launched token.

## Production design track — not implemented/deployed

1. Written purpose and utility of a token; why a database record would not be more appropriate.
2. Tokenomics: maximum supply, ownership, allocations, treasury/vesting, admin and emergency controls, governance, liquidity risks.
3. Standard solidity implementation using audited libraries such as OpenZeppelin, not handwritten ERC-20 mechanisms. Select the library **and version** explicitly.
4. Access-control strategy (Ownable, AccessControl or multisig) and privileged action review; avoid unlimited mint rights and opaque transfer fees.
5. Build deterministic local test suites, fuzz/property tests, allowance-race and reentrancy review where applicable; peer code review and third-party audit before even a testnet trial.
6. Only after explicit owner authorization: a testnet deployment with published verified source and separate test assets; real assets, public sales or mainnet deployment require additional approvals and legal/security checks.

**Do not** automate minting, airdrop farming, trading, swapping, staking, liquidity deposits or token sales on anyone's wallet.

## Relation to the Make.fun Token Launch Radar bounty

The contest is about analyzing **protocols whose DefiLlama record shows no token**, not about creating tokens. The dashboard must not infer a guaranteed future token, airdrop or price from missing token metadata. Its implied values are transparent model outputs and must separate observed data from speculative estimates.

Useful skills shared by both tracks: chain IDs, token standards and categories, transparent supply models, role/owner risks, safe interactions, wallet approvals, governance and audit documentation.

References:
- https://make.fun/bounty/token-radar-01
- https://eips.ethereum.org/EIPS/eip-20
- https://docs.openzeppelin.com/contracts/5.x/api/token/erc20
- https://docs.openzeppelin.com/contracts/5.x/access-control

## New ability — token vesting schedules (22 November 2026)

Toyol Digital now has its **own offline vesting model**, independent of any external vesting-calculator service:

- Working reusable source: `skills/token-contract-lab/vesting-engine.mjs`
- Regression tests: `skills/token-contract-lab/vesting-engine.test.mjs`
- Verified CI: `.github/workflows/toyol-vesting-skill-ci.yml`
- Original premium product: **Toyol Vesting Studio v1.0** packaged as a separate locally deliverable ZIP for possible sale on Getly. Keep the premium browser interface and seller files **out of the public repo** pending owner storefront publication.
- Master product includes BM/English instructions, editable multiple allocations, CSV and JSON export, responsive charts and a single stand-alone offline HTML file. Product package tested with 20 math tests + Chromium interaction on desktop and mobile.

**Deterministic model:** Store tokens in BigInt smallest units (0–18 decimals). At TGE release `floor(total * tgeBasisPoints / 10000)`. For remaining allocation vest linearly over exact UTC elapsed time or in whole calendar-month steps. Cliff blocks non-TGE unlock until the cliff, then catches up accrued vesting. At maturity unlock exactly 100%. Claimable = max(0, vested minus user-reported claimed). Check allocated supply never exceeds declared total supply. Do not promise actual legal rights or token value.

**Use the skill appropriately:** Token Launch Radar does not require token creation or on-chain transfers. Vesting Studio models distributions, not live ERC20 claims or launches. Never connect or request a seed phrase, private key, wallet approval or deploy real token contracts without explicit new authorization.

**How to check code:** `node --test skills/token-contract-lab/vesting-engine.test.mjs`. The GitHub Action must pass before upgrades. The full commercial package includes independent 20-case engine tests and screenshot-backed browser validation.
