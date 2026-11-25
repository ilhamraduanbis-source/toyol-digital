package orderedeffects

import (
 "bytes"
 "encoding/json"
 "math"
 "math/big"
 "sort"
 "testing"
)

// Independent reference: arbitrary precision sum, pairwise conflict checking,
// and direct grant lookup. No incremental budget arithmetic or shared helper.
func oracleV3(xs []IntentV2, gs map[uint32]GrantV2, cap uint64)([]byte,error){
 if len(xs)!=len(gs){return nil,rejectIdentity}
 for i,x:=range xs {
  if _,ok:=gs[x.Worker];!ok{return nil,rejectIdentity}
  for j:=0;j<i;j++ {if xs[j].Worker==x.Worker{return nil,rejectIdentity}}
 }
 for _,x:=range xs{
  g:=gs[x.Worker]
  if x.Resource==([16]byte{})||x.Resource!=g.Resource||x.Operation==0||x.Operation!=g.Operation||x.Units==0||x.Units>g.Max{return nil,rejectGrant}
 }
 for i,x:=range xs{for j:=0;j<i;j++{if xs[j].Resource==x.Resource{return nil,rejectConflict}}}
 total:=new(big.Int)
 for _,x:=range xs{total.Add(total,new(big.Int).SetUint64(x.Units))}
 if total.Cmp(new(big.Int).SetUint64(cap))>0{return nil,rejectBudget}
 result:=append([]IntentV2{},xs...)
 sort.Slice(result,func(i,j int)bool{return result[i].Worker<result[j].Worker})
 return json.Marshal(result)
}
func TestV3OracleGrid(t *testing.T){
 values:=[]uint64{0,1,2,math.MaxUint64-1,math.MaxUint64}
 orders:=[][3]int{{0,1,2},{0,2,1},{1,0,2},{1,2,0},{2,0,1},{2,1,0}}
 n:=0
 for _,a:=range values{for _,b:=range values{for _,c:=range values{for _,cap:=range values{
  for mode:=0;mode<5;mode++{
   xs,gs:=baseV2(3)
   for i,u:=range []uint64{a,b,c}{xs[i].Units=u;g:=gs[uint32(i)];g.Max=math.MaxUint64;gs[uint32(i)]=g}
   switch mode {
   case 1:xs[0].Worker=99
   case 2:xs[0].Operation=0
   case 3:xs[1].Resource=xs[0].Resource;g:=gs[1];g.Resource=xs[0].Resource;gs[1]=g
   case 4:xs[1].Worker=xs[0].Worker
   }
   for _,o:=range orders{
    in:=[]IntentV2{xs[o[0]],xs[o[1]],xs[o[2]]}
    before,_:=json.Marshal(in)
    got,e:=validateV2(in,gs,cap);want,w:=oracleV3(in,gs,cap)
    after,_:=json.Marshal(in)
    if e!=w||!bytes.Equal(got,want)||!bytes.Equal(before,after){t.Fatalf("case %d cap %d got %s %v want %s %v",n,cap,got,e,want,w)}
    n++
   }
  }
 }}}}
 if n!=18750{t.Fatalf("grid size %d",n)}
 t.Logf("%d validator/reference comparisons across all six arrival orders",n)
}
func BenchmarkV3Validator(b *testing.B){
 xs,gs:=baseV2(64)
 b.ReportAllocs()
 for i:=0;i<b.N;i++{if _,e:=validateV2(xs,gs,64);e!=nil{b.Fatal(e)}}
}
func BenchmarkV3Reference(b *testing.B){
 xs,gs:=baseV2(64)
 b.ReportAllocs()
 for i:=0;i<b.N;i++{if _,e:=oracleV3(xs,gs,64);e!=nil{b.Fatal(e)}}
}
