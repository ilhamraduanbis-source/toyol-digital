# Toyol ReleaseGuard — Toggle Wars 2026

Original AI-assisted tool started on 26 November 2026 for the AI Agents and Feature Flags track. It reads actual environment-level Flagsmith flag states, creates a digest-bound proposed change, detects stale snapshots and generates explicit change and rollback commands only after a human approves the plan digest. No management credentials are needed by ReleaseGuard, and it never executes the commands itself.

## Setup
Python 3.10+; no third-party dependencies. For inspection only, the public example environment key published at https://www.flagsmith.com/ can be used:

```sh
cd deliverables/toggle-wars-releaseguard
python3 -m unittest -v
FLAGSMITH_ENVIRONMENT=TijpMX6ajA7REC4bf5suYg python3 releaseguard.py inspect
```

Never modify the public demo environment. For a real change, create a dedicated free test environment you own and a Boolean flag named new_checkout initially disabled. Export its **client-side environment key** as FLAGSMITH_ENVIRONMENT. Do not put management tokens in the repository.

```sh
python3 releaseguard.py plan new_checkout on > plan.json
cat plan.json
# Review the exact flag, before/after state and environment. Copy the approval_sha256:
python3 releaseguard.py approve plan.json YOUR_REVIEWED_DIGEST
```

The resulting commands are for the human to review and manually run using the official authenticated Flagsmith CLI, against the dedicated test environment only. Re-read the flag state after any change. The generated inverse command is not an atomic rollback. This is an environment-default advisory tool; it does not model overrides or automate production changes. A digest records content integrity, not legal approval or a cryptographic signature. No claim of measured time savings yet.

Official API: https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview
CLI: https://flagsmith.github.io/flagsmith-cli/flag/update/
Contest: https://www.wemakedevs.org/hackathons/flagsmith/rules

## Remaining contest gates
Registration, live public API smoke test, own test environment end-to-end change, short real demonstration video and official submission confirmation. Tests and read-only API smoke are not proof that a change was applied or the contest was submitted.
