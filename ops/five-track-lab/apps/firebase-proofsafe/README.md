# ProofSafe hybrid inference candidate

This is an original Firebase AI Logic Web SDK frontend with a four-factor cloud-spending guard, fail-closed local inference and repeatable Node policy tests. The Firebase project is NOT configured; no actual Firebase SDK inference or remote API call has been performed.

Reproduce: npm install --no-audit --no-fund && npm test && npm run build. To run on device, create your own no-billing Firebase project, populate a local .env (never commit it), use supported Chrome Desktop and run npm run dev. Only approve cloud fallback after confirming no-spend quota and billing protections. The on-device model may need a free local download; do not assume it is available on the user's mobile phone.

Contest needs authentic model inference, a demo video and registration on Devpost, not only passing JavaScript unit tests.
