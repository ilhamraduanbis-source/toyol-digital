#!/usr/bin/env python3
"""Inspect future genuine SwarmMemo bug-bounty rounds and submit one proven
original unresolved CLI bug ONLY when a cash-paying seat really exists.
No duplicate submissions, new identities, wallet spend or fabricated proofs.
"""
import importlib.util,json,os,re,urllib.request

OLD="9a7a1d94ac3c0dd8c359882ca2006f60"
def read(u):
    with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"ToyolBugNextRound/1","Accept":"application/json"}),timeout=20) as r:
        if r.status!=200:raise ValueError("INDEX_HTTP")
        b=r.read(750001)
        if len(b)>750000:raise ValueError("INDEX_TOO_LARGE")
        return json.loads(b)
def main():
    j=read("https://swarmmemo.com/api/works?kind=earn&limit=100")
    rows=j.get("data",{}).get("works",j.get("works",[]))
    if not isinstance(rows,list):raise ValueError("INDEX_SCHEMA")
    cash=[]
    for w in rows:
        if not isinstance(w,dict) or not re.fullmatch("[a-f0-9]{32}",str(w.get("id") or "")):continue
        if w["id"]==OLD or w.get("state")!="open" or w.get("claimable") is not True:continue
        if w.get("requester",{}).get("handle")!="weaver":continue
        if not re.search("bug bounty",str(w.get("title") or ""),re.I):continue
        s=w.get("standing") or {}
        if not (s.get("open",0)>0 and s.get("results",100)<s.get("results_max",0) and s.get("per_agent_day")==1):continue
        if not any(isinstance(t,dict) and t.get("usdc") for t in s.get("tiers") or []):continue
        cash.append(w)
    cash.sort(key=lambda x:x.get("created_at",0),reverse=True)
    print("FUTURE_PAID_BUG_ROUNDS "+json.dumps([{"id":x["id"],"title":x["title"],
      "open":x["standing"].get("open")} for x in cash[:8]]),flush=True)
    if not cash:
        print("NO_NEW_CASH_BUG_SEAT");return
    # Proof script independently re-fetches work and checks requester, next
    # round seat and duplicates before signed post/claim.
    spec=importlib.util.spec_from_file_location("toyol_proven_bug","src/swarmmemo-updates-follow-bug.py")
    bug=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bug)
    bug.WORK=cash[0]["id"]
    bug.main()

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("FUTURE_ROUND_SAFE_STOP "+type(e).__name__+" "+str(e).splitlines()[0][:150],flush=True)
        raise SystemExit(1)
