# Toyol Agent-Native Art Bounty — 22 November 2026

**Status:** Original candidate finished and tested; NOT submitted, NOT reviewed/accepted, NOT paid. This does not count as Toyol earnings.

## Verified official opportunity
- Direct task: https://taskmarket.dev/tasks/0xbbbfba707ab89aa0d3caae8b3e5e47eedabadefc877d87baf5739723dbd7e38e
- Task amount **20 OUSD aggregate**, **1 OUSD per valid individual entry**, at most 20 eligible entries. Not winner-takes-all; buyer may reject inadequate or duplicate submissions.
- Tempo 4217, official Taskmarket TAP verified signer required, `stakeRequired=false`, `platformFeeBps=0`, `escrow.tracked=true`, book amount 20,000,000 atomic units.
- Requester: `0x3095f71fa8CA38ed73400CF1E1785e76549049b7`.
- Deadline: 2026-11-29T10:15:03.693Z.
- Public source had **18 prior submissions** and no submission by Toyol's Tempo wallet when screened. Slots may fill at any time: local safe script checks `rows.length < 20` before submitting.
- Work: fresh hand-drawn editorial geometric linocut/risograph composition showing tiny ordinary worker using a lever to move massive mechanical world. 16:9 2880×1620 original RGB PNG, **not a variation of** earlier Toyol communal arch art, no text/logos, no existing artwork or real people's likenesses.
- Transparent image-generation disclosure: **model none; Python 3 + Pillow geometric drawing**. Associated notes describe source, style and originality.
- Prepared package in working conversation: `Toyol_Hero2_Zero_Fee_One_Time_20261122.tar.gz`; SHA256 `b9faa93f7f3fa3421804ac942e4a9dd8216eb8f09542d49a9d084dcd62f0cdfa`.
- Local Termux script checks package and input sha256, verified TAP+wallet, source escrow and no stake, exact task ID and requester, 20-capacity limit, no previous own submission, three-minute deadline buffer, one-time attempt marker before any external write, payment-deny policy. Never exports keys or incurs fee. Cannot be executed by ChatGPT cloud because the signing key is local on user's phone.
- **No duplicate or automated retry**. Existing four Toyol candidate receipts remain separately watched.

## New autonomous TaskMarket outcome monitor
- `src/toyol-taskmarket-outcome-watch.mjs` and `.github/workflows/toyol-taskmarket-outcome-watch.yml` added on 22 Nov 2026.
- First official GitHub Actions run `45016999846` passed all checks, 8 offline verification tests; monitored all 4 already-submitted receipt IDs from authenticated public API; no awards/settlements found.
- One run hourly at minute 31. Opens one deduplicated GitHub Issue only when selected/accepted/reported payout transaction *candidate* is evidenced by the correct wallet. It never asserts cash transfer solely on task API. It does not spend or sign.
