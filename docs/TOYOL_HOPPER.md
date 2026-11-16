# Toyol Hopper — long-term integration revenue

Owner mandate, 16 November 2026: retain one independent clone on MultiHopper after the 48-hour cash sprint and after the competition. Do not divert the existing cash workers or MYReady resources.

## Verified starting terms

- Organizer: https://business.multihopper.com/build-and-route/
- Developer overview: https://business.multihopper.com/developers/
- Quickstart: https://dev-docs.multihopper.com/quickstart
- Security: https://dev-docs.multihopper.com/concepts/security
- Earn listing: https://superteam.fun/earn/listing/multihopper-build-and-route-challenge-up-to-dollar50000-revenue-share-1/

Organizer page states a 0.25% share of full-fee qualifying integration volume, separate from a $5,000 guaranteed shared competition pool growing to $50,000. Partner onboarding and agreed commercial terms apply. Prize threshold is $100,000 qualifying mainnet volume per product, not a deposit. The campaign runs nominally 21 October–30 November 2026; exact UTC boundaries and announcement dates remain under clarification. Organizer's latest rules give top three shares 60/25/15%; older Earn wording conflicts. Verify before any entry. No claim of individual $50,000 prize.

At the stated rate, $1 million qualifying volume yields $2,500 gross integration revenue; $20 million yields $50,000 gross. Not net profit or a forecast. No fabricated or circular volume, no evasion of compliance checks, no custody of customer keys, no owner-funded production transfers.

## One product hypothesis: transparent treasury reconciliation

Test whether small teams or agent operators need a dashboard that reconciles authorized vendor payouts, expected fees, receipts and pending status. MultiHopper can be an optional integration only where a customer's legitimate needs justify its added costs. Do not imply that a normal direct transfer needs multi-hop routing. The product is a hypothesis, not approved demand.

1. Observe partner terms, API access, fees, campaign and security docs daily.
2. Validate specific buyer needs and willingness to pay before building production infrastructure. No spam or unsolicited outreach.
3. Build offline mock reconciliation and test fixtures; then obtain authorized devnet API access using separate test environment. Never use a live wallet in a devnet exercise.
4. Require partner approval, legal/commercial review, documented customer consent, real demand and a security review before production. No live transfer, signing or spending is authorized by this document.
5. Verify actual fee-share receipts and separately track eligible volume, fees, operating costs and real customers. Continue after campaign deadline if partner economics are viable.

## Execution

Daily 03:41 UTC (11:41 MYT), GitHub Actions workflow .github/workflows/toyol-multihopper-watch.yml. Push triggers initial public-doc scan. Produces hopper-status.json and a run summary. Public GET only; no account creation, API keys, transfers, customer acquisition or income claims. Existing controller tracks it as scheduled, with no expiry. A successful scan is evidence of research, not a deployed integration.

Initial blockers: devnet account/API access not verified, partner onboarding incomplete, no validated customer, no production volume, no verified revenue. Retain mission after November 30; if terms change, review before proceeding.
