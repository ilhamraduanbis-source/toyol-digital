# Toyol API Response Proof — prototype v0.1

An independent deterministic QA module for machine-to-machine workflows. Given a caller-supplied HTTP status, parsed JSON response, and explicit expected status and field rules, it returns structured pass/fail evidence. It does not send requests, access private systems, or retain input. It does not certify response authenticity, provenance, complete JSON Schema conformance, or external service uptime.

## Example (Node.js)

```js
import { auditResponse } from './audit.mjs';
console.log(auditResponse({
  status: 200,
  body: { id: "abc", ready: true },
  contract: { status: 200, fields: [
    { pointer: "/id", type: "string" },
    { pointer: "/ready", type: "boolean" }
  ]}
}));
```

Expected pass: true. Change ready to "true" to observe TYPE_MISMATCH.

```sh
node --test skills/api-response-proof/audit.test.mjs
```

Input boundary: parsed JSON only, 128 KiB serialized response, max 32 nesting levels, 20,000 nodes, 64 field rules, JSON Pointer subset with escaping. Invalid contracts throw; absent optional fields do not fail. Do not submit secrets or personal data. Findings do not echo field values. No remote URL fetching or network credentials.

## Commercial gate (not implemented)

First validate a real buyer need using existing agent-service channels and documented permission. Only after evidence of demand, evaluate a separately deployed paid endpoint using the existing Toyol x402 pattern. Candidate service: automated API response regression/contract checks; repeat checks may create recurring usage, but no buyer, price acceptance, settlement, revenue or deployment has been verified. No paid infrastructure, wallet signing, new accounts, production changes or MYReady dependencies. Avoid counting simulated or advertised values as income. Keep existing Toyol workflows unchanged.

The 12 persisted cases cover the basic behavior; the equivalent cases were executed in a JavaScript sandbox. The Node test file has not yet been executed by repository CI.
