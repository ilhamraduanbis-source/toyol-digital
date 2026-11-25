# Go-Hybrid #4488: independent reference check V3

25 November 2026. Continuation of the existing proposal, not a new entry or an accepted milestone.

## Reproducible results

CI run: https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/45563003294
Source tested: commit f01905b2936b201438802d21fb99cd4e53a1ee90, Go 1.26.11 linux/amd64.

Independent reference uses arbitrary precision budget summation and pairwise identity/resource conflict checks. The finite grid checks three intent quantities and cap drawn from {0,1,2,MaxUint64-1,MaxUint64}, five mutation modes and all six permutations: 18,750 comparisons. All matched result bytes or rejection category, and the original input slice was unchanged. Race-detector run passed, including previous V2 tests.

64-worker benchmark, three repetitions (200 ms target):
- Validator: 29,174 / 30,091 / 30,187 ns/op; 14,331 / 14,327 / 14,328 B/op; 24 allocs/op.
- Reference: 24,744 / 24,575 / 24,853 ns/op; 8,136 / 8,141 / 8,136 B/op; 73 allocs/op.

The validator was slower and used more allocated bytes per operation in this benchmark, despite fewer allocations. This result does not establish a performance advantage. A compiler implementation, transitive purity proof, external effect semantics and general scalability remain untested. The reference shares the same domain data types and rejection categories; independence here is algorithmic, not a formal specification proof.

Reproduce in this directory:
```sh
GO111MODULE=off go test -race -count=1 -v
GO111MODULE=off go test -run '^$' -bench 'BenchmarkV3' -benchtime=200ms -count=3
```
