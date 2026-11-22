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
