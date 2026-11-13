# Membership Hunt — zero owner cash

Mandate (13 Nov 2026): public hunt and free membership hunt run in parallel, with no bounty ceiling. A membership, profile, invitation, bid, credit or submitted task is not income.

## Live and planned lanes

- Frantic: existing registered agent `agent-65c3b0`, public hire listing, payout configuration and invitation/status checks. Reuse this identity. Existing authenticated delivery path remains unchanged. No bulk outreach.
- SwarmMemo: prior one-off signed submission `6aaba9998e6a4f41ca2872a5eac1b273`. The delivery script generated a temporary key and removed it; do not claim that this is a reusable member identity or rotate identities to bypass quotas. Recover the original signer if available, otherwise seek platform-supported account recovery or a single durable new identity without claiming continuity or new-agent rewards. A persistent identity permits profile publication, links, inbox and eligible group invitations. Ordinary SwarmMemo credit is not cash; verify explicit USDC bounty and settlement separately.
- OpenTask: free autonomous registration with P-256 DPoP operational and separate recovery keys, or owner-approved OAuth/API-token route. Prefer a dedicated Toyol seller profile, with a truthful bio, structured capability and published service listing. A scoped bearer token for that profile may be configured as the Actions secret `TOYOL_OPENTASK_TOKEN`, with its expected profile ID as repository variable `TOYOL_OPENTASK_PROFILE_ID`. Only use read scopes needed for profile, proposals, recommendations and notifications (check current token onboarding guide). Never commit credentials or put them in artifacts, summaries, issues or chat. The reader verifies profile identity before accessing private work. Without credential setup it reports a blocker, not enrollment. Autonomous DPoP registration requires a persistent credential manager with recovery; do not use an ephemeral runner that will lose the keys.
- BasedAgents: free registration is real but paid claims require 1 USDC bond per active bounty. No bond from owner money; do not start reputation-only work just to inflate metrics. No paid claim before a separate approved, funded strategy.
- Additional leads: only join where official terms permit autonomous agents, free membership, legitimate payout and Malaysia participation. No impersonation, identity farming, evasion, wallet spend, deposits, subscriptions, paid verification or disclosure of user identity without authorization.

## Profile and execution

Suggested truthful seller capabilities: bounded code and documentation review, reproducible public API QA, JSON/CSV validation, source-backed research, and small verified patches. Demonstrated evidence: Frantic submitted delivery #148 and SwarmMemo documentation audit; acceptance/payment not claimed. Never list unverified proficiency, guarantees or fabricated experience. Do not publish a duplicate listing to gain artificial reputation.

Every matching invitation: verify current brief, permitted automation, pricing, deadline, available seat, required capability, funding and payout; produce and verify work; submit only through authorized route. For confidential work, keep all private text and deliverables outside the public repository. Membership radar currently records only public evidence and counts; it does not process private proposals or automatically register accounts.

## Official references
- https://opentask.ai/guides/agent-auth-integration
- https://opentask.ai/guides/agent-developer-quickstart
- https://opentask.ai/api/openapi
- https://swarmmemo.com/tools/identity
- https://swarmmemo.com/tools/work
- https://basedagents.ai/skill.md

## Operation
`.github/workflows/toyol.yml` runs `src/membership-hunt.mjs` alongside scheduled public scans at minute 29 each hour (subject to GitHub scheduling). Pushes run tests only. Reports contain aggregate counts/status and public result reference; payment monitoring and prior work remain separate. No notification on routine zero results.
