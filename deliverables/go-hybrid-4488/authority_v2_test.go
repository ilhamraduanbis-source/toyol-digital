package orderedeffects

import (
 "bytes"
 "encoding/json"
 "fmt"
 "math"
 "math/rand"
 "sort"
 "sync"
 "testing"
)

// Standalone plan construction model; no external effects.
type ResourceID [16]byte
type GrantV2 struct { Resource ResourceID; Operation uint8; Max uint64 }
type IntentV2 struct { Worker uint32; Resource ResourceID; Operation uint8; Units uint64 }
type RejectV2 string
func (r RejectV2) Error() string { return string(r) }
const (
 rejectIdentity RejectV2 = "IDENTITY"
 rejectGrant RejectV2 = "GRANT"
 rejectConflict RejectV2 = "CONFLICT"
 rejectBudget RejectV2 = "BUDGET"
)
func validateV2(in []IntentV2, grants map[uint32]GrantV2, cap uint64) ([]byte,error) {
 xs:=append([]IntentV2(nil),in...)
 seen:=map[uint32]bool{}
 if len(xs)!=len(grants){return nil,rejectIdentity}
 for _,p:=range xs {
  if _,ok:=grants[p.Worker];!ok||seen[p.Worker]{return nil,rejectIdentity}
  seen[p.Worker]=true
 }
 for _,p:=range xs {
  g:=grants[p.Worker]
  if p.Resource==(ResourceID{})||p.Resource!=g.Resource||p.Operation==0||p.Operation!=g.Operation||p.Units==0||p.Units>g.Max{return nil,rejectGrant}
 }
 resources:=map[ResourceID]bool{}
 for _,p:=range xs {if resources[p.Resource]{return nil,rejectConflict};resources[p.Resource]=true}
 left:=cap
 for _,p:=range xs {if p.Units>left{return nil,rejectBudget};left-=p.Units}
 sort.Slice(xs,func(i,j int)bool{return xs[i].Worker<xs[j].Worker})
 if xs==nil {xs=[]IntentV2{}}
 return json.Marshal(xs)
}
func idV2(n byte) ResourceID {var a ResourceID;a[15]=n;return a}
func baseV2(n int)([]IntentV2,map[uint32]GrantV2){
 xs:=make([]IntentV2,n);gs:=map[uint32]GrantV2{}
 for i:=range xs {r:=idV2(byte(i+1));xs[i]=IntentV2{uint32(i),r,1,1};gs[uint32(i)]=GrantV2{r,1,10}}
 return xs,gs
}
func controlledV2(xs []IntentV2,order []int)[]IntentV2{
 ready:=make([]chan struct{},len(xs));done:=make(chan IntentV2);var wg sync.WaitGroup
 for i,p:=range xs {ready[i]=make(chan struct{});wg.Add(1);go func(p IntentV2,gate <-chan struct{}){defer wg.Done();<-gate;done<-p}(p,ready[i])}
 out:=make([]IntentV2,0,len(xs))
 for _,i:=range order{close(ready[i]);out=append(out,<-done)}
 wg.Wait();return out
}
func TestV2OneHundredForcedWorkerOrders(t *testing.T){
 xs,gs:=baseV2(5);want,e:=validateV2(xs,gs,5);if e!=nil{t.Fatal(e)}
 rng:=rand.New(rand.NewSource(4488))
 for i:=0;i<100;i++{
  out:=controlledV2(xs,rng.Perm(len(xs)))
  got,e:=validateV2(out,gs,5);if e!=nil||!bytes.Equal(want,got){t.Fatalf("iteration %d",i)}
  got,e=validateV2(out,gs,4);if got!=nil||e!=rejectBudget{t.Fatalf("unexpected over-budget result %s %v",got,e)}
 }
 t.Log("100 controlled worker orders: 100 canonical successes, 100 aggregate rejections")
}
func TestV2AdversarialErrorPriority(t *testing.T){
 cases:=[]struct{name string; mutate func([]IntentV2,map[uint32]GrantV2);want RejectV2}{
 {"unknown and invalid",func(x []IntentV2,g map[uint32]GrantV2){x[0].Worker=99;x[1].Operation=2},rejectIdentity},
 {"duplicate identity and over quota",func(x []IntentV2,g map[uint32]GrantV2){x[0].Worker=x[1].Worker;x[2].Units=math.MaxUint64},rejectIdentity},
 {"wrong operation and budget",func(x []IntentV2,g map[uint32]GrantV2){x[0].Operation=2},rejectGrant},
 {"wrong resource",func(x []IntentV2,g map[uint32]GrantV2){x[0].Resource=idV2(9)},rejectGrant},
 {"zero operation",func(x []IntentV2,g map[uint32]GrantV2){x[0].Operation=0},rejectGrant},
 {"zero units",func(x []IntentV2,g map[uint32]GrantV2){x[0].Units=0},rejectGrant},
 {"exceeds grant",func(x []IntentV2,g map[uint32]GrantV2){x[0].Units=11},rejectGrant},
 {"conflict and budget",func(x []IntentV2,g map[uint32]GrantV2){x[0].Resource=x[1].Resource;g[0]=GrantV2{x[1].Resource,1,10}},rejectConflict},
 {"aggregate",func(x []IntentV2,g map[uint32]GrantV2){},rejectBudget},
 }
 rng:=rand.New(rand.NewSource(7))
 for _,c:=range cases{t.Run(c.name,func(t *testing.T){
 x,g:=baseV2(3);c.mutate(x,g)
 for i:=0;i<20;i++{out,e:=validateV2(controlledV2(x,rng.Perm(3)),g,2);if out!=nil||e!=c.want{t.Fatalf("want %s got %s %v",c.want,out,e)}}
 })}
 t.Log("9 adversarial families, 20 orders each; 180 deterministic rejection checks")
}
func TestV2OverflowAndEmpty(t *testing.T){
 x,g:=baseV2(2);x[0].Units=math.MaxUint64;g[0]=GrantV2{x[0].Resource,1,math.MaxUint64}
 if out,e:=validateV2(x,g,math.MaxUint64);out!=nil||e!=rejectBudget{t.Fatal(fmt.Sprintf("overflow accepted: %s %v",out,e))}
 if out,e:=validateV2(x[:1],g,math.MaxUint64);out!=nil||e!=rejectIdentity{t.Fatal("missing identity")}
 if out,e:=validateV2(nil,nil,0);e!=nil||string(out)!="[]"{t.Fatal(string(out),e)}
}
