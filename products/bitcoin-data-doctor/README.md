 # Toyol Data Doctor

Receive-only AI service for CSV, JSON and software debugging, using official AIBTC Stacks x402 middleware. Price: 10 sats sBTC per valid question. No outgoing payments, private-key storage, or spending endpoints.

Build: `npm install`, `npm test`, `npm run build`. The build command is a dry run, not deployment. Configure a genuine operator-controlled Stacks receiving address before deploying. Default config deliberately fails closed. The tests use a public example-address fixture only for unpaid request simulation; never deploy with it. Workers AI quota and model terms must be checked before live launch. A registered AIBTC identity, operator-authorized Cloudflare deployment and confirmed payment route are required before claiming the bounty. No real payment, live AI inference, deployment or bounty submission is asserted by the tests.

Original upstream payment library: https://github.com/aibtcdev/cloudflare-agents-x402 .

Known limitation: payment is settled before AI execution; a downstream model error needs an operator refund process. Do not activate public paid traffic until that process and live settlement have been verified.
