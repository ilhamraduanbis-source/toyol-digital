# Solana USDC verification prototype

Independent Toyol Digital skill, prepared before customer award. No actual customer transaction has been supplied. No live payment, deployment, or income is claimed.

## Usage

Node.js 22 or newer. No npm dependencies or credentials.

```sh
node verify.mjs <transaction-signature> <recipient-wallet> <USDC-amount>
node verify.mjs <transaction-signature> <recipient-token-account> <USDC-amount> account
node --test verify.test.mjs
```

The CLI uses only Solana's public mainnet RPC, requests finalized confirmation and a parsed transaction, verifies signature and slot, and checks native Circle USDC mint and SPL Token program. Amounts are exact integer micro-USDC. It verifies incoming transfer instructions (including CPI), recipient owner or exact destination token account, and matching recipient balance increase. No key, SOL, token approvals, transaction submission, signing or paid RPC needed.

Exit 0: pass. Exit 1: fail. Exit 2: indeterminate (including RPC outage, ambiguity, incomplete parsed metadata, unsupported transaction version). Refuses internal owner transfers in owner mode and contradictory balance data. It does not identify a commercial invoice, prevent reuse of a valid signature across invoices, authenticate the RPC provider beyond HTTPS, or guarantee cashout. An application must separately bind transaction signatures to orders and consume each payment once. Complex multi-leg swaps and incomplete historical metadata can be indeterminate. Account mode verifies the specified token account, not a separately supplied wallet owner.

References:
- Solana getTransaction: https://solana.com/docs/rpc/http/gettransaction
- Solana JSON structures: https://solana.com/docs/rpc/json-structures
- Circle native USDC mint: https://help.circle.com/support/en/usdc-supported-blockchains-minting-redemption-faqs?id=kb_article_view&sysparm_article=KB0010590

Tests use synthetic RPC responses and intentionally fake fixture addresses; no actual payments or tests against customer infrastructure. Validate live customer examples and acceptance criteria after authorized award.
