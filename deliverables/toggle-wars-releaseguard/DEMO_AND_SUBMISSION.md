# ReleaseGuard — demo and submission checklist

Track 02: AI Agents and Feature Flags, USD 1,000 prize (not earned).
Registration confirmed on 26 November 2026 at approximately 21:58 MYT by owner's WeMakeDevs screenshot.
The submission button returned "No submissions for this one." The owner emailed contact@wemakedevs.org at 22:02 MYT asking for the correct submission link. No submission confirmation.

## Evidence already verified
- 13 unit tests passed.
- 9 actual public Flagsmith demo flags read from the SDK API.
- Plan and inverse-command generation verified without modifying the public environment.
- CI: https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/45832882992
- No live change or rollback has yet been performed. No AI-model runtime is claimed: ReleaseGuard is a deterministic guardrail tool for coding agents.

## Dedicated free test setup (owner only)
Open https://app.flagsmith.com/signup and choose the free plan only; no payment details or upgrade.
Create a project named ReleaseGuard Demo and use its Development environment.
Create a non-sensitive, client-visible Boolean feature named new_checkout, disabled initially.
From SDK Keys / Environment Settings copy the Client-side Environment Key. This is not a management token.
Do not use a production environment, public demo, or other person's flags. Do not upload a personal access token.

## Actual demo steps
Use the existing repo; navigate to deliverables/toggle-wars-releaseguard.
Export FLAGSMITH_ENVIRONMENT locally using the dedicated test client key.
Run python3 releaseguard.py inspect and confirm new_checkout is false.
Run python3 releaseguard.py plan new_checkout on > plan.json.
Review the plan and digest. Run python3 releaseguard.py approve plan.json REVIEWED_DIGEST.
The tool returns change and rollback commands; no execution. Official CLI syntax: https://flagsmith.github.io/flagsmith-cli/flag/update/
Use the Flagsmith dashboard (or independently authenticated official CLI, explicitly scoped to the dedicated environment) to enable the flag after review.
Run inspect and verify new_checkout is true. Then demonstrate that the old plan is rejected as stale by re-running approve with the original digest.
Manually disable the flag in the same environment and run inspect again; verify false.
Do not expose any management credentials in the recording. Only record actual outputs. The stale-snapshot test does not guarantee atomic rollout.

## Suggested 90-second demonstration
0–15s: Explain how arbitrary changes by automated coding agents can be risky.
15–35s: Inspect the real dedicated test environment and create a plan.
35–55s: Review and approve the plan digest; show that the tool does not execute the change.
55–70s: Apply in the dashboard and verify the flag state; demonstrate rejection of the stale plan.
70–90s: Roll back in the dashboard, verify original state and show the actual CI evidence.

## Submission copy (use only after verified demo)
Project name: Toyol ReleaseGuard
Track: AI Agents and Feature Flags
Public source: https://github.com/ilhamraduanbis-source/toyol-digital/tree/main/deliverables/toggle-wars-releaseguard
Description: A deterministic safety guardrail for coding agents using Flagsmith. It reads live flag state, creates a digest-bound proposed change, checks for stale state, and generates reversible change commands only after a human approves the plan. It never automatically writes to a production environment.
Demo video: pending actual dedicated-environment recording.
Submission receipt: pending official channel confirmation.
Deadline in organizer confirmation email: 29 November 2026, 20:00 IST / 22:30 MYT.
