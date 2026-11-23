# PocketOps G2 | Even Realities Heads Up Hackathon

## Proposed track
AI Assistants & Work (confirm exact track name in the current DoraHacks submission form).

## What problem it solves
Knowledge workers can confuse a successful local code check with proof that a job was accepted, a contest submission was verified, or an invoice was paid. PocketOps puts the next cautious action and the state of evidence in a compact smart-glasses view. It works offline and does not require users to buy G2 hardware to evaluate its simulator behavior.

## Product description
PocketOps G2 is an original Even Hub SDK app with a 576 x 288 heads-up display, native gesture navigation, and a companion browser screen. The user types a work item, selects the evidence they actually have, and receives a bounded decision such as NEEDS_PROOF, TESTED_LOCALLY, HUMAN_REVIEW, HOLD, or STOP. The decision is shown on the G2 display. Optional on-device AI wording is attempted only when the browser exposes an already available local language model. **The rule-based decisions themselves are not represented as AI model inference.** No external API call or payment is required for the deterministic functionality.

## Verified behavior and evidence
- Genuine source and SDK app: `ops/five-track-lab/apps/pocketops-g2/` in the public Toyol Digital repository.
- Automated unit tests: five checks passed for evidence gating, credential blocking, input validation and display bounding.
- Native packaging: official Even Hub CLI created a real `.ehpk` package, 38,357 bytes on CI run `45085335695`.
- Genuine official Even Hub simulator: opened successfully with Linux WebKit/GTK dependencies. Screenshot of first frame displayed `POCKETOPS 1/4 · Even G2`. After a real simulator API click, screenshot displayed `POCKETOPS 2/4 · Firebase`.
- Authentic screenshot evidence: [GitHub Actions run 45085335695](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/45085335695), artifact named `pocketops-g2-original-simulator-evidence`.
- Firebase SDK build and separate no-spend proof policy also passed in the same run, but **this PocketOps event submission is specifically an Even G2 app**.

## How to reproduce
```bash
cd ops/five-track-lab/apps/pocketops-g2
npm install --no-audit --no-fund
npm test
npm run build
npm run pack
npm run dev
```

Run the official Even Hub simulator against `http://127.0.0.1:5173` after installing its Linux runtime dependencies. The GitHub Actions workflow demonstrates the exact simulator command and screenshot/click automation. Use a genuine desktop recording of the working simulator for the event's demonstration video.

## Suggested live video, maximum 3 minutes
- 0:00-0:20: identify the problem and why an at-a-glance G2 evidence gate matters.
- 0:20-1:10: show simulator on card 1, tap to card 2; show true gesture behavior.
- 1:10-2:00: enter a normal work item in the companion UI, choose local test proof, assess and see TESTED_LOCALLY on HUD.
- 2:00-2:35: enter a payment action without verified evidence and show HOLD; demonstrate credential-block STOP using a non-secret placeholder.
- 2:35-2:55: explain optional local AI only when genuinely available, no paid cloud calls, and clarify limits.
- 2:55-3:00: show repository URL and QR/link to project.

## Still required before a genuine competition entry
1. Owner signs in to DoraHacks and completes free event registration.
2. Produce and publish a REAL demo video of the running simulator (not a montage of fabricated model inference). A CI still-pair by itself is not a substitute for a demo video.
3. Supply public repository URL, product description, demo video, and optionally the `.ehpk` through the actual submission form.
4. Confirm application meets the final track's AI criteria; deterministic policy with optional local AI **may not** satisfy an AI-only judging expectation unless actual model inference is demonstrated.
5. Verify DoraHacks confirmation before recording status as submitted. No income, prize, enrollment or award claimed.

## Intellectual property and costs
Original code here is currently in a publicly accessible GitHub repository. The user must inspect the platform's content license and contribution terms before official submission. This project incurs no purchases, deposits, on-chain transfers, or paid API requests.
