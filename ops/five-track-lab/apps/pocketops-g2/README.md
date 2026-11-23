# PocketOps G2 — Heads Up: Even Realities Hackathon (2026)

Original smart-glasses work-decision HUD for the Even Realities G2 using the Even Hub SDK. This is a solo human entrant assisted by AI coding tools, not a four-person human team.

## Contest dates and prior-work disclosure

The relevant event build window is **23–29 November 2026** in Malaysia's local date/time.

The earliest GitHub commit of the shared five-track experiment was `7760a5e`, dated **22 November 2026 23:18 UTC = 23 November 2026 07:18 MYT**. It included the first original local Five-Track Lab bundle and a basic Even G2 adapter. Subsequent `pocketops-g2` app work, simulator testing, and recording scripts were added on **23 November 2026 MYT**. The initial PocketOps app commit in `main` was `1ff6ac76f9` (22 November 23:51 UTC = 23 November 07:51 MYT). The original app builds on that same-day prototype; this history is disclosed rather than presenting the first prototype as brand-new for the final version.

**No project-specific code predating 23 November 2026 has been identified in the inspected Git history.** If the owner separately reused older code not reflected in this history, that reuse must be added here before agreeing to the hackathon's terms. Third-party open-source Even Hub SDK and Vite tooling are external dependencies, not claimed as original creations.

## Functionality and limitations

PocketOps G2 displays work-status cards on a simulated 576 × 288 HUD. Official Even Hub simulator gestures navigate cards (click and scroll). The companion page accepts a short work item and an evidence level, and shows a bounded determination: NEEDS_PROOF, TESTED_LOCALLY, HUMAN_REVIEW, HOLD, or STOP. It does not custody funds, transmit payment instructions, or fetch private messages. No credential or API secret is needed to use the deterministic functionality.

An **optional** on-device browser language-model explanation exists but has **not** been verified to produce a real model answer in the contest setup. The rule engine is deterministic, not itself AI inference. Do not claim the project has a working cloud AI assistant.

All app functionality uses offline or owner-supplied, read-only demonstration data. No real trades, custody of user funds, or paid APIs. No secret is intentionally included in the app's inspected project source. Repository-wide security review, however, is separate from this app-specific disclosure.

## Reproduce from source

```bash
cd ops/five-track-lab/apps/pocketops-g2
npm install --no-audit --no-fund
npm test
npm run build
npm run pack
npm run dev
```

The native .ehpk is built with official `evenhub pack`. For simulator evidence, see GitHub Actions run [45088726502](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/45088726502), or the more recent [45088726502](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/45088726502) simulator workflow and recorded local demo. See [SUBMISSION.md](SUBMISSION.md) for full submission preparation. The 15-second simulator MP4 demonstrates genuine HUD navigation only, not a complete 3-minute AI demo.

## Genuine simulator demo video

A 15-second MP4 recording from the official Even Hub simulator is published at:
https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/main/ops/five-track-lab/apps/pocketops-g2/media/pocketops-g2-simulator-real.mp4

This is a **real simulator gesture/navigation test**, not physical G2 footage, an AI model inference demonstration, or proof of event submission. The exact source artifact was verified by SHA-256 `5cb79901040b317ff84f2a653eb5d5ee6580dbfc1ec18de1090cbdbb49f13b66` before publication in GitHub Actions run `45200754406`.

## Contest honesty checklist

- One human participant can register solo; AI coding help must not be presented as extra human teammates.
- This README distinguishes same-day original source from older source, and must be updated if any pre-event reuse is later discovered.
- The only public demo data is non-custodial, read-only or local user inputs; no real funds handled.
- No user messages or secrets should be uploaded; review changes and third-party dependencies before final submission.
- The organizer may feature project name, video, and screenshots publicly.
- An event registration is **not** a Build submission or award.
- Organizer pays any cash prize in **USDT on TON**, not Base USDC. A compatible wallet would only matter if a real prize is awarded; do not send funds in advance.
