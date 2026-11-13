# Toyol Digital — Continuity without ChatGPT Plus

Updated 13 November 2026 (MYT). Keep this file with the repository. It is a runbook, not a promise of continuous income.

## Mission and accounting

The original RM400 checkpoint is 15 November 2026 at 10:49 MYT. Continue in 24-hour increments if short, without resetting historical receipts or stopping at RM400. Owner capital remains RM0. No deposits, paid APIs, borrowing, gas purchases, speculative transactions or wallet approvals without explicit owner permission. No fake users, engagement farming, duplicate entries, policy evasion or arbitrary remote code execution. Prefer cashable earnings and fiat bank payouts. See missions/rm400.md.

Verified starting receipt for the current runbook: 0.010000 USDC on Base from SwarmMemo, transaction 0x5e1563608e7d4f8e7d699685712d108fc5cd3c16db8fd4f2f3c7397e2bdb67df. See issue #5. No MYR cashout established. Never count advertised rewards, bids, credits or accepted-but-unsettled work as cash.

## Independent services

| Workflow | Intended schedule (UTC) | What it actually does |
|---|---|---|
| toyol.yml | hourly :29 | discovery and bounded rule-based patch drafts; no automatic third-party PR |
| brain-proof.yml | daily 03:37 | local open-source Qwen 3B model; bounded AI patch drafts, not externally submitted |
| world-radar.yml | hourly :17 | broad source screening and Frantic settlement checks |
| toyol-cash-priority.yml | hourly :23 | cash, offers, contracts, Toku orders |
| toyol-fiat-radar.yml | hourly :41 | public fiat opportunities |
| opentask-offer-watch.yml | hourly :43 | existing offers and contracts |
| frantic-deliver.yml | hourly :11 | delivers only reviewed, finished items from frantic-ready.json |
| toyol-usdc-receipt-watch.yml | hourly :13 | verifies SwarmMemo Base receipts, monitors Taskmarket awards |
| toyol-continuity.yml | every six hours :53 | checks eight known workflows and requests at most two stale eligible recoveries per run |

GitHub standard hosted runners in this public repository are independent of ChatGPT subscription. Respect GitHub terms, usage limits and scheduling policy. Schedules can be delayed or dropped. Public repo schedules can be disabled after 60 days of inactivity. The guardian cannot recover an entirely stopped scheduler, suspended account, disabled workflow or revoked credentials. It does not automatically enable disabled workflows. See Actions for actual run timestamps, not just the cron configuration. Run the relevant workflow manually on main if necessary.

No purchased model or cloud server is required. Existing local AI model is a limited draft generator; it is not ChatGPT, and has no general authority to accept or deliver arbitrary customer work.

## Payout routes and commitments

- BountyHub: account linked to GitHub, Stripe Malaysia and Maybank connection confirmed by owner screenshot. No paid bounty yet. Respect meaningful human contribution requirements; no fully AI-generated PR contrary to policy.
- Toku: agent cmwelikcf000ngq0716yigh2f active, three services published ($5 conversion, $10 testing, $8 technical documentation review), no worker orders as of 13 Nov 15:08 MYT. Stripe payouts and charges disabled. Support email sent from owner's Gmail 13 Nov; await correction from US to Malaysia. Never invent US details or create duplicate agent.
- OpenTask: five bids totaling 751 USDC advertised, not earnings. Existing payout route needs owner activation after 14 Nov 2026 10:31 MYT, subject to actual platform readiness. No duplicate payout registration or financial signature.
- Frantic: #148 delivered, human review pending, no settlement confirmed. Queue executor can process only reviewed completed work.
- Taskmarket: four completed Forge-confirmed submissions (10.44 OUSD advertised), not verified earnings. Captain Bot queue entry not confirmed submitted. Check current status before retry; don't duplicate.
- SwarmMemo: first verified receipt described above. Never pay to discover or claim work.

## Phone runner

Installed file: ~/.toyol/forge/local-runner.mjs. It reads a data-only queue from runner/queue.json once per minute and refuses unverified CI, wrong scope, paid submission or repeated entry. It never executes downloaded candidate code. The runner is not a general remote terminal. The wallet and Forge private key remain on the phone; never upload them to the public repository, logs or chat.

A local-only supervisor is available in scripts/toyol-keepalive.mjs. It monitors the installed runner, tries at most three restarts per 15 minutes, validates identity before starting, and refuses ambiguous process/lock ownership. It does not download updates or expose keys. Install from an inspected, pinned commit and start using nohup. Stop both processes by creating ~/.toyol/forge/runner.stop; remove it only when deliberately resuming. A supervisor does not defeat Android force-stop, reboot or battery restrictions. For boot recovery, Termux:Boot must be installed from a compatible signed distribution, launched once and configured; do not uninstall existing Termux or keys to switch distribution.

To check: tail -n 20 ~/.toyol/forge/runner.log. If needed, tail -n 20 ~/.toyol/forge/supervisor.log. Do not share keys or environment dumps. Unknown submission status requires inspection of public Taskmarket and Forge records before retry.

## Resume with any assistant

Read this runbook, missions/rm400.md, runner/queue.json, frantic-ready.json, latest Actions runs and issue #5. Verify fresh receipts before reporting money. Continue on actual funded, permitted, zero-owner-cost work; prioritize specific deliverables over scans. Use existing approved platform credentials through their configured secrets only. No new fees or registrations without owner consent. Never tell the owner that a human or AI assistant is continuously working if only scheduled scans and prepared jobs are running. Notify only for verified receipts or an essential owner action.

The owner retains control of the repository, accounts and phone. ChatGPT subscription expiration does not delete those external resources, but loss of a connected tool or expired third-party token may require the owner to reauthorize. No guaranteed income or payout date.
