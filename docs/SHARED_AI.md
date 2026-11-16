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
