# Shared AI in existing Toyol

Added to the same repository and existing clone roster on 16 November 2026. No reset, second colony or wallet changes. All eleven registered agents share the existing skill catalog and bounded observation history.

## Interface

`node src/shared-skill-cloud.mjs think <agent> <purpose> <task>`
`node src/agent-ai.mjs ask <agent> <purpose> <task>`
`node src/agent-ai.mjs all` — bounded development batch across registered agents.
`node src/agent-ai.mjs context <agent> <purpose> <task>` — inspect context without inference.

Purposes: plan, research, code, debug, review, write, learn, coordinate. Text assistance only. Each prompt is built from the agent's registered identity, mission, latest own observations, bounded shared observations and four shared skills. Inputs and outputs are limited; caller-supplied model IDs and injected context are ignored. No arbitrary shell, external tools, account operations, transactions, automatic posting or paid API fallback. Outputs remain untrusted drafts, not executed plans.

## Model and local runtime

Qwen/Qwen2.5-0.5B-Instruct, Apache-2.0, pinned revision c89bee90d9f811437d9735454613c35b4a3c4dc8. Source: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/tree/c89bee90d9f811437d9735454613c35b4a3c4dc8.

Use the pinned-model provisioning steps in .github/workflows/toyol-agent-ai.yml on an authorized CPU environment. Set TOYOL_LOCAL_MODEL_DIR to the provisioned snapshot directory; use the matching Python virtual environment on PATH. Offline inference uses safetensors and disables remote code; no API credentials are needed. The runner must be trusted and the model directory must be provisioned from the pinned snapshot. The code does not independently hash every model weight file. No private keys, credentials or customer data should be sent in prompts.

Development CI runs unit tests and real local-model text generation for 11 mission-specific requests covering all eight purposes. CI is a development/test environment, not a permanent business inference server. Inference is batched serially in one model process to avoid loading 11 copies of weights. Parallel clone requests may be queued by a future persistent runtime. The small model is a baseline, not proof of production-grade reasoning, coding or financial decisions. No image/audio model, autonomous browser, paid API or external action approval is included.

## Evidence and operational integration

The existing Shared Skill Cloud exposes the think interface and collects completed AI-development workflow metadata alongside other clone observations. Real AI outputs from the CI test are retained in the toyol-local-ai-test-evidence artifact. Only verified results may be promoted to reusable skills. Existing paid workflows, payment reconciliation, market identities, Hopper and both large-target scouts are unchanged. The gateway is callable by their development modules, but existing marketplace production workflows have not been rewired to execute model-generated plans.

Next step: qualify a persistent authorized zero-cost runtime, add a durable bounded request queue, and connect existing reviewed tools behind explicit permission gates. Confirm real model quality before authorizing any independent execution. No owner-funded spend; stop when free capacity is unavailable.

## Controlled AI-selected actions (implemented in place)

`node src/shared-skill-cloud.mjs act <agent> <purpose> <task>` selects one reviewed local skill with the pinned model and executes it. `node src/agent-action.mjs` runs the eleven-agent development cycle. Model choice is constrained to five fixed labels; the selected label must match its highest finite model logit. Arbitrary generated code, shell strings, URLs, wallet actions and external transactions are not accepted. The five tools audit the actual mission registry, audit shared observations, round-trip actual mission data through CSV/JSON, run protocol analysis self-tests, and run documentation audit self-tests. Verification produces a bounded receipt, not a revenue or delivery claim. All five actions are independently covered by executable integration tests.

The existing Shared Skill Cloud collector now checks successful, trusted main-branch AI workflow artifacts for complete, validated local action receipts. It copies only bounded worker/action/source/run identifiers and evidence hashes/counts into `runner/shared-memory.json` under `actionReceipts` (up to 120 receipts). Model prose and prompts are not copied. Failed or unavailable evidence is not promoted. Other agents can read this evidence through the shared memory API. The collector must successfully run and persist receipts before publication is considered verified.

Development CI confirms the initial eleven-agent text inference run succeeded (run 43800349904). The new constrained action integration runs in the existing Shared AI workflow. Existing production-market workflows, external permissions and payment reconciliation are unchanged. A local action receipt establishes only the specific validation performed; it does not establish independent business execution, approval, revenue or an always-on model service.
