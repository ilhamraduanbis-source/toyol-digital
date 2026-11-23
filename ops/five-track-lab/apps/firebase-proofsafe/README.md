# ProofSafe — Evidence-first Hybrid AI (Firebase #BuildHybridAI 2026)

## What it does
ProofSafe assists people who must make work decisions without confusing a generated answer with accepted evidence. The original web application calls **Firebase AI Logic** for model inference. It uses `ONLY_ON_DEVICE` unless project-level confirmed free quota, billing-disabled flag, owner consent and cloud-fallback opt-in are all present, in which case the SDK uses `PREFER_ON_DEVICE`. Actual response provenance is read from `response.response.inferenceSource`, returning `ON_DEVICE`, `IN_CLOUD`, or `UNKNOWN`. Unknown is never reported as a verified inference route.

## Reproduce without charging anything
```bash
npm install --no-audit --no-fund
npm test
npm run build
npm run dev
```
The resulting frontend can be opened in a browser. Without Firebase configuration and a genuine App Check site key, it deliberately refuses model inference instead of fabricating responses. Do not publicly distribute API tokens or any private data. Public Firebase web config is not itself a protected secret.

## To demonstrate genuine hybrid inference
1. Register a real Firebase project that needs **no paid plan**. Do not enable Cloud Billing or provide a credit card.
2. Configure Firebase AI Logic, enable Gemini Developer API under available free quota, and configure **App Check** including reCAPTCHA Enterprise site key. If an App Check provider or free quota is not available, stop.
3. Use compatible **Chrome Desktop 139+** with the on-device model available; execute `ONLY_ON_DEVICE` and capture actual `ON_DEVICE` response and screenshot.
4. After checking free quota and explicitly confirming no-charge behavior, set all three `VITE_` cloud flags to `true` and check the consent box. Rebuild and use a compatible device without a local model. Capture an actual `IN_CLOUD` response only if the SDK reports it.
5. Create a public YouTube demo no longer than 3 minutes, with English narration or subtitles, showing real inference and source labels. Link a working public demo URL and source repository on Devpost.

Never submit an accountless frontend preview as proof of functioning AI. The organiser's requirements include a real runtime Firebase SDK call, a YouTube video and a public repository with an open-source license visible at its root. The MIT license here applies **only to this application directory**, not to the other, unrelated Toyol Digital repository files. For strict root-license compliance, publish this directory in its own dedicated public repository before final submission. Existing whole-repo Toyol source is not relicensed.

## Status (23 Nov 2026)
- Source code written: yes
- Local static unit tests and Vite build: verified only after CI reports PASS
- Live Firebase project and real model response: NOT configured / NOT verified
- Devpost registration and official submission: NOT confirmed
- Payments or deposits made: none for this project
- Income received from contest: USD0 confirmed

See official requirements: https://firebasehybridaihackathon.devpost.com/
