# Follow-up evidence — Go-Hybrid #4488

Original proposal: https://github.com/limitlessprojects/Go-Hybrid/issues/4488

This author-side follow-up addresses the technical review by dukenordj-rgb. It is not an accepted milestone, a claim of award, or a Hybrid compiler implementation.

## Reproduce

Copy authority_v2_test.go into an empty directory. Run go mod init toyol.example/ordered-effects and then:

```sh
for p in 1 2 4; do GOMAXPROCS=$p go test -race -count=1 -v ./...; done
```

The repository file is a compact rendering of the original standalone Go test source. Earlier local execution on 15 November 2026 passed all three configurations. Per configuration: 100 controlled result orders of five workers yielded identical canonical plans under cap 5 and 100 aggregate rejections under cap 4; nine adversarial families times 20 orders yielded 180 deterministic rejection checks; overflow, missing identity and empty plan cases passed. Across three configurations: 300 controlled orders, 300 over-cap rejections, and 540 additional adversarial rejection checks. Seeded orders repeat and do not exhaust all possible schedules.

## Scope and additional design

Fixed 128-bit resource identifiers; operation and uint64 allowance stored as values. Whole-batch error priority: identity, grant, conflict, budget. Subtract from remaining cap to avoid overflow. Sort valid plans by stable worker ID. No external effects are executed by the model.

The harness deliberately uses channels to control arrival order; this is not evidence that a compiler enforces transitive purity. No source-to-plan lowering, formal soundness proof, performance guarantee, or external atomicity/rollback/exactly-once claim. An independent ordinary Go validator is the comparison baseline; compiler-level ROI remains falsifiable.

The official proposal remains #4488. Do not open duplicate issues or claim that contributor comments establish payment. M1/M2 scope and acceptance are determined by the maintainers.
