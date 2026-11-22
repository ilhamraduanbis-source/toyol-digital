# Toyol agent-native zero-fee creative delivery queue — 22 November 2026

**Status:** two original deliverables produced and checked offline, both **NOT YET SUBMITTED**, **NOT awarded**, **no revenue verified**. No external account, wallet signing, deposit or fee was performed from the cloud.

## Candidate A: 50-second original Spanish task explainer video
- Official task: https://taskmarket.dev/tasks/0x7974a2831dbe25f693f84420b8534045a4d2f5915dad67dc0eb59702864e574b
- Task mode bounty, Tempo 4217, TAP verified, no stake, 0 platform fee. Requester `0xEeCD138212Fa1220627C9A3081f770C1b162a5E2`.
- 10 OUSD **shared among first up to 5 valid videos**; expected 2 OUSD per valid entry if all 5 fill, **not guaranteed or already earned**.
- Due 2026-11-22T22:25:23.422Z (2026-11-23 06:25:23 MYT).
- Official API at preparation: open; 0 public submissions; escrow booked 10000000.
- Production: fully original narrated/animated 720x1280 H.264/AAC MP4, ~50 seconds, Spanish (es-la) speech + burned-in subtitles, 7 scene flow from worker's perspective required for wallet last nibble `1`. Original vector-style graphics with Python Pillow, espeak and ffmpeg. Includes full Spanish and English word-by-word scene translations in text notes.
- Artifact hashes: video `d57fc476fc09258fb979bea714b050c7b5d88e7b5c1a26e18038d3bfdd538458`, notes `58873b1e42efce6d8acc835523915614aacf7fe3b9a18d363bf3a69209658577`.

## Candidate B: original blog hero illustration
- Official task: https://taskmarket.dev/tasks/0x83a813516e7796e0281f5c9d9c3fe75482205da76779372f54b09bff6b121b26
- Task mode bounty, Tempo 4217, TAP verified, no stake, 0 platform fee. Requester `0x3095f71fa8CA38ed73400CF1E1785e76549049b7`.
- 50 OUSD **shared as 1 OUSD per valid entry, first up to 50**, not a single 50 OUSD winner. Requester decides validity.
- Due 2026-11-29T09:50:42.518Z.
- Official API at preparation: open, 26 submissions, escrow booked 50000000.
- Original conceptual night-indigo and vermilion editorial paper-cut woodcut scene: anonymous ordinary figures building monumental communal arch; source produced natively 2880x1620 PNG, no real-person likeness, brand, logo or text. Includes notes naming Python/Pillow original illustration style.
- Artifact hashes: PNG `906853d14c6bb05f3b27a2c39c0f43436244d8ed63cabfeeea3464a299766850`, notes `7233c22c930261ee2c98febe3947e3216035e5e3834328dbe82f561e68024431`.

## Delivery and safeguards
- User-facing package created in conversation container: `Toyol_Next_Earn_Two_Free_Bounties_20261122.tar.gz`; SHA256 `f005e8e5cd57651789109129455c150848a87f7f5e23c4e49b90ab6f5601c7db`.
- Includes bash Termux one-time script, README, content hashes and original files. Script verifies TAP trust, pre-existing Tempo wallet `0xac57ad3c3f233e5865c3cd652f67ffc82a7af431`, exact primary task IDs/requesters, reward escrow, zero platform fee and stake, accepting window, current total entry count < 5 or < 50, and no wallet duplicate. A deny-all paid payment policy prohibits paid calls.
- Each attempt marker is written **before** one CLI submission, with no retry on uncertainty.
- User must run locally from own Termux because signing key is held only on phone; no key exported and cloud cannot legitimately sign. Local user had previously authorized zero-cost activity but 0.001 USDC permission for Lumen House was one-time only; it is **not** reused.
- Existing Lumen House pitch and prior Spanish infographic are wholly separate; do not alter or re-submit. Zero spend, zero alleged new receipts, no misleading revenue claim.

**Not evidence of job acceptance or earnings.** Confirm specific accepted task and wallet settlement only from public TaskMarket API/on-chain receipt before advancing financial state.


## Confirmed API submissions — 22 Nov 2026, 19:04 MYT

**Video Spanish**
- Official source: `GET https://api.taskmarket.dev/api/tasks/0x7974a2831dbe25f693f84420b8534045a4d2f5915dad67dc0eb59702864e574b/submissions?chainId=4217`.
- Submission ID: `36730de8-d3ee-46de-a618-98ec0448121f`.
- Wallet: `0xac57ad3c3f233e5865c3cd652f67ffc82a7af431`.
- API submittedAt `2026-11-22T11:04:10.170Z`, task had 3 total submissions on subsequent query.

**Hero illustration**
- Official source: `GET https://api.taskmarket.dev/api/tasks/0x83a813516e7796e0281f5c9d9c3fe75482205da76779372f54b09bff6b121b26/submissions?chainId=4217`.
- Submission ID: `5bfac545-2c6e-4b8c-a033-f77cc5e94ce5`.
- Wallet: `0xac57ad3c3f233e5865c3cd652f67ffc82a7af431`.
- API submittedAt `2026-11-22T11:04:24.868Z`, task had 29 total submissions on subsequent query.

**Status correction:** Earlier part of this note described both as not submitted. As of this update **both are submitted and confirmed on the platform primary API**, but both still report `awardCount:0`, `awards:[]`, no payment transaction hash, and no verified income. **DO NOT RESUBMIT either task**. Escrow pool != receivable or settlement. Preserve existing Lumen House pitch and first Spanish infographic separately.


## Submission receipts — 2026-11-22 19:04 MYT

**Evidence:** user-provided Termux screenshot. Local CLI reports two distinct successful TaskMarket API submissions. These are **not** award or settlement receipts.

- Spanish video task `0x7974a2831dbe25f693f84420b8534045a4d2f5915dad67dc0eb59702864e574b`: `SUBMISSION_ACCEPTED_BY_API 36730de8-d3ee-46de-a618-98ec0448121f`; preflight saw 2 existing entries against cap 5.
- AI economy hero image task `0x83a813516e7796e0281f5c9d9c3fe75482205da76779372f54b09bff6b121b26`: `SUBMISSION_ACCEPTED_BY_API 5bfac545-2c6e-4b8c-a033-f77cc5e94ce5`; preflight saw 28 entries against cap 50.
- Local receipt flags: `NO_AWARD_OR_PAYMENT_VERIFIED` for both. Never count 2 OUSD or 1 OUSD as revenue until requester acceptance and a settlement receipt are confirmed. Do not resubmit either task. Existing Lumen House pitch and Spanish infographic remain untouched. No owner funds spent for these two entries.
