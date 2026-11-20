---
name: csv-evidence
description: Inspect CSV data quality with a free example before deciding whether to purchase a real 0.01 USDC x402 audit on Base. For duplicate headers or records, missing required values, duplicate identifiers, row widths, and reproducible SHA-256 evidence. Never send sensitive CSV or authorize payments without user approval.
metadata:
  author: Toyol Digital
  version: "1.0.0"
---

# Toyol CSV Evidence — verified x402 data audit

Use when an AI agent needs a bounded, deterministic check of **nonsensitive CSV** for malformed row widths, duplicate records or headers, empty required fields and nonunique key columns. The service returns structured findings, exact record numbers, aggregate counts and a SHA-256 input fingerprint.

The service is independently accessible; this skill is a **buyer integration guide**, not a paid account, wallet or automatic purchase permission. Installing it does not send data or money.

## Discovery and free sample

- Free fixed example: https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/sample
- OpenAPI: https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/openapi.json
- x402 discovery manifest: https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/.well-known/x402
- Official marketplace listing and paid-route verification: https://payapi.market/api/toyol-csv-evidence-data-quality-audit
- Paid endpoint: `POST https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/v1/csv/audit`

If the service is down, unhealthy or inconsistent with its published price, stop. The free sample is **fixed** and cannot be used to test a purchaser's private dataset. For local files, prefer an offline audit when sending the data would be unnecessary.

## Supported input and output

For a real paid audit, the request is JSON:

```json
{
  "csv": "id,name\n1,Ada\n1,Ada\n2,\n",
  "required": ["name"],
  "unique": ["id"]
}
```

The input is a UTF-8, comma-delimited CSV, at most **128 KiB**, **2,000 data records**, **100 columns**. Do not submit passwords, API keys, student/customer records, medical data, unconsented personal information or other sensitive material. Optional `required` and `unique` are arrays of header names. Audit output includes `pass`, `records`, `columns`, `totalFindings`, `counts`, `findings`, and `sha256`. The output can truncate the displayed findings at 100 while preserving the aggregate count.

## Payment gate

1. First inspect `/sample` and `/openapi.json` without any wallet or payment signature.
2. Ask for and obtain the purchaser's explicit approval for **0.01 USDC per request** plus any separately quoted network/provider costs. Do not purchase on your own initiative just because this skill exists.
3. Use a compatible **x402 v2** payment client. The service returns an HTTP **402 Payment Required** with the supported payment terms. Check that the quote is for `eip155:8453` (Base), asset `0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913` (USDC), amount `10000` atomic units, and recipient `0xac57ad3c3f233e5865c3cd652f67ffc82a7af431`. If any term differs, stop and ask for review.
4. Let the user's already-authorized payment client perform payment and request delivery. **Never request a seed phrase or private key**, never create a wallet deposit for this skill and never replay an uncertain payment.
5. Verify the actual successful HTTP response and requested checks. A 402 quote, purchase intent, platform listing or local test is not proof of a successful payment or audit.

## Limitations

This is deterministic CSV quality validation, not schema inference, a database migration, malware scanning, a security certification, an assurance of compliance, or a replacement for expert data governance. The application claims no persistent record storage; network, hosting and payment providers have their own policies. Check their privacy terms before sending any data.

## Seller information

- Source code, tests and audit algorithm: https://github.com/ilhamraduanbis-source/toyol-digital/tree/main/skills/csv-evidence
- The PayAPI marketplace records a verified one-off paid test dated 18 November 2026. That proves one settled test transaction, **not** subsequent customer demand, recurring income, acceptance by other marketplaces or a guarantee of future service availability.
