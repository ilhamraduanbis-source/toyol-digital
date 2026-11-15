# Go-Hybrid wildcard #4488 — Toyol evidence

Submitted by the human operator on 15 November 2026: https://github.com/limitlessprojects/Go-Hybrid/issues/4488

Initial review: https://github.com/limitlessprojects/Go-Hybrid/issues/4488#issuecomment-6894821125 — CONTRIBUTOR verdict VIABLE, not a maintainer award. No M1 or M2 payment inferred.

## Reproducible standalone authority model

Save the following as publication_test.go in a new Go module, then run `go test -race -count=1 -v` with Go 1.23 or later. This is a standalone model, not a Hybrid compiler feature.

```go
package orderedeffects
import ("encoding/json"; "fmt"; "reflect"; "sort"; "testing")
type Intent struct { Worker int; Resource string; Units int }
type Grant struct { Resource string; Max int }
func validatePlan(proposals []Intent, grants map[int]Grant, cap int) ([]byte,error) {
 if cap<0 {return nil,fmt.Errorf("invalid cap")}
 xs:=append([]Intent(nil),proposals...)
 sort.Slice(xs,func(i,j int)bool{return xs[i].Worker<xs[j].Worker})
 used:=map[string]bool{}; seen:=map[int]bool{}; total:=0
 for _,p:=range xs {
  g,ok:=grants[p.Worker]
  if !ok||seen[p.Worker]||p.Resource==""||p.Resource!=g.Resource||p.Units<=0||p.Units>g.Max{return nil,fmt.Errorf("invalid grant or duplicate worker")}
  if used[p.Resource]{return nil,fmt.Errorf("duplicate resource")}
  if p.Units>cap-total{return nil,fmt.Errorf("aggregate allowance exceeded")}
  seen[p.Worker]=true;used[p.Resource]=true;total+=p.Units
 }
 if len(seen)!=len(grants){return nil,fmt.Errorf("missing worker")}
 return json.Marshal(xs)
}
func TestPublicationPlanAllSixOrders(t *testing.T){
 grants:=map[int]Grant{0:{"index:a",5},1:{"index:b",5},2:{"index:c",5}}
 intents:=[]Intent{{0,"index:a",3},{1,"index:b",3},{2,"index:c",4}}
 want,err:=validatePlan(intents,grants,10);if err!=nil{t.Fatal(err)}
 for _,order:=range [][]int{{0,1,2},{0,2,1},{1,0,2},{1,2,0},{2,0,1},{2,1,0}}{
  in:=[]Intent{intents[order[0]],intents[order[1]],intents[order[2]]}
  got,e:=validatePlan(in,grants,10);if e!=nil||!reflect.DeepEqual(got,want){t.Fatalf("%v: %s %v",order,got,e)}
  if got,e=validatePlan(in,grants,9);e==nil||got!=nil{t.Fatalf("over-budget published: %v %s",e,got)}
 }
}
func TestPublicationRejectsInvalidAuthority(t *testing.T){
 grants:=map[int]Grant{0:{"a",5},1:{"b",5}}
 cases:=[][]Intent{{{0,"b",1},{1,"b",1}},{{0,"a",1},{0,"a",1}},{{0,"a",1}},{{0,"a",6},{1,"b",1}},{{0,"a",0},{1,"b",1}},{{0,"a",1},{2,"b",1}}}
 for i,in:=range cases{if out,e:=validatePlan(in,grants,10);e==nil||out!=nil{t.Fatalf("case %d accepted",i)}}
 if out,e:=validatePlan([]Intent{{0,"a",1},{1,"a",1}},map[int]Grant{0:{"a",5},1:{"a",5}},10);e==nil||out!=nil{t.Fatal("duplicate resource accepted")}
}
```

## Earlier actual execution

The original standalone module (including two separate order-sensitive fan-in tests) ran on Go 1.23.2 on Linux with `go test -race -count=1 -v ./...`:

- PASS TestRaceFreeDoesNotImplyScheduleIndependentEffects
- PASS TestOrderedCommitAcrossAllSixSchedules
- PASS TestPublicationPlanAllSixOrders
- PASS TestPublicationRejectsInvalidAuthority
- Final: PASS, toyol.example/ordered-effects 1.013s

The authority tests reproduced the same canonical plan for six permutations at cap 10, no plan at cap 9, and rejected seven invalid authority cases. These are bounded standalone tests, not formal compiler soundness, proof of purity, external atomicity, or an award. The reproduction above is a formatting-only compact rendering of the two authority tests, not a new measured run.

## Next decision gate

Wait for a maintainer/owner verdict or formal MOONSHOT ledger entry. If selected, agree on scope and milestones before undertaking compiler integration. Do not submit duplicate proposals, contact third parties, or claim payouts from a contributor review. Preserve the distinction between proposed plan and actual external execution.
