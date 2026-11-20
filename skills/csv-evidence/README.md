# Toyol CSV Evidence

**Live, externally settlement-tested x402 service.** The [PayAPI Market listing](https://payapi.market/api/toyol-csv-evidence-data-quality-audit) records one independent paid **0.01 USDC** test on Base dated 18 November 2026. That is one historical verification, not recurring customer revenue.

## Order or try without paying

- [Free fixed example](https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/sample)
- [Structured API documentation](https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/openapi.json)
- [x402 discovery manifest](https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/.well-known/x402)
- [Verified PayAPI marketplace listing](https://payapi.market/api/toyol-csv-evidence-data-quality-audit)
- **Paid service:** `POST https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/v1/csv/audit` at **0.01 USDC/request**. HTTP 402 lets a purchaser inspect payment terms before authorizing a payment.

AI agents can read the portable [CSV Evidence Agent Skill](SKILL.md), which gives the free demo first and never authorizes a payment automatically.

## Product

Deterministic CSV checks for malformed rows, duplicate headers/records, missing values in required columns, duplicate values in unique-key columns, counts and 1-based record locations, plus a SHA-256 input fingerprint.

Limits are **128 KiB UTF-8 CSV**, 2,000 data records, 100 columns, and 100 displayed findings (aggregate totals always computed). Strict CSV quoting and comma delimiter. Header names and duplicate values are case-sensitive; whitespace-only values are treated as empty. The hash covers input CSV bytes as received after JSON decoding, not transport encoding. No application-level data retention is implemented; hosting and payment providers have separate policies. Do not send sensitive or personal data.

## Local reproducibility

In this directory, run `npm install --ignore-scripts`, `npm test`, `npm run build`, and optionally `npm run test:quote`. The quote test obtains an **unpaid** x402 requirement; it does not sign or settle a payment. `worker.mjs` is the Cloudflare Worker entrypoint; `audit.mjs` is the deterministic local engine.

The public service currently uses the Base USDC address recorded in `worker.mjs`. Don't execute `npm run deploy` without access to an expressly authorized Cloudflare account and verification of free plan and current payment facilitator terms. A GitHub code change is not proof of live deployment.

## Evidence accounting

- Historical paid external test: 18 November 2026, 0.010000 USDC, as recorded by PayAPI.
- Repeated sales: not independently established here.
- Additional marketplace listing or agent skill installation: not a sale.
- Conversion into MYR or withdrawal: not established.

This software is separate from MYReady and does not access its data.
