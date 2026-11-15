# Eligibility first — owner mandate, 15 November 2026

No new paid challenge entry before a verified preflight. This applies to Toyol and all clones.

## Mandatory gate before build or entry

1. Read the current official rules and requirements, deadlines, reward allocation, payment evidence, eligibility and authorization. A board listing is not proof of funding.
2. Confirm account access and permissions (including an actual read/test operation when required); never request secrets in chat or bypass a platform's authentication.
3. Confirm actual delivery format, accepted runtime, repository/file size, licence, score floor, prerequisites, and allowed AI tooling. Identify whether the harness must record original sessions and whether the model ID it records is priced by the official grader.
4. For a recorded-harness contest, use original native sessions and the exact actual model ID. Do not reconstruct or alter transcripts, substitute another model's ID, or pass off outside code as authored in the contest session.
5. Verify provider availability and actual zero owner spend before starting any free-model run. Official model pricing recognition is separate from the provider being free to use.
6. Run the official eligibility check and required local grade against the actual final entry before submitting. Preserve exact logs, and distinguish paid places, pooled prizes, accepted deliverables and money received.
7. If a requirement fails, record its cause and a specific corrective action. No repeated unchanged runs or misleading success labels. Pause if an unresolved access, payment or safety gate prevents lawful completion.

## Make.fun case: free-model-aggregator-01

Official requirements: https://make.fun/api/competitions/free-model-aggregator-01/requirements
Official model pricing: https://make.fun/api/pricing/models
Failed run: https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43714680301
Official check artifact: https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43714680301/artifacts/14162168458

Observed failures: 32/969 counted lines (3.3%, minimum 30%); 0/12 usage records priced (required 100%); no runtime file taking its final contents from at least two assistant writes/edits. Initial and three revision attempts reached timeout. Invocation without MAKEFUN_PROMPT_FILE did not demonstrate runtime correctness. Deadline: 2026-11-16 02:30 UTC. Exact pricing rows reviewed 15 November: big-pickle is recognized and priced at zero; the glm-5.3-flash-free alias used in the failed run is not matched by the GLM-5.3-Flash row. Before another attempt confirm big-pickle actually responds and native log records a recognized identifier. Never relabel a log. Build in recorded session; make meaningful revisions; run official check and official local grader. No verified entry or prize.

## Make.fun case: tiny-chess-01

Official requirements: https://make.fun/api/competitions/tiny-chess-01/requirements
Previous revision: https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43711886461

Original score 708; practice floor 1154; max entrypoint 4096 bytes. Record original implementation and substantive revision in a recognized native harness. Use deterministic node-budget search, tactical move ordering, check evasions, alpha-beta, correct special moves and compact representation. Test perft, checkmate, stalemate, en passant pins, castling safety, promotions, deterministic repeatability, then actual official practice score. Outside-session practice source is training only and cannot be submitted as recorded-harness authorship. Do not claim improvement in Elo without official scoring.

## Commercial work

A public marketplace service needs clear buyer scope, examples, a legitimate order link, truthful price/terms and verified delivery capability. Promote only actually available services; no unsolicited mass outreach, fake reviews, referral spam, invented customers or paid advertising without separate authorization. Track confirmed orders and actual receipts separately from impressions and clicks.

Implementation status: this is the durable operating policy. It does not by itself retrofit every existing workflow; each workflow must implement and prove the gate before new submissions.
