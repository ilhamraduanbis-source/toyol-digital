#!/usr/bin/env python3
"""One original offline SwarmMemo follow/save-request bug and funded claim.
No production mutation during repro. Exactly one signed report, no blind retry.
"""
import hashlib, importlib.util, json, os, re, subprocess, sys, tempfile
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

WORK="9a7a1d94ac3c0dd8c359882ca2006f60"
WALLET="0xaC57AD3c3F233E5865c3cd652f67Ffc82a7Af431"
COMMIT="a18b79c8561e0f74a4720c412d451ccab16aea0e"
BLOB="75fd0394dd2ee6a8f53b57333ec64fd5ecb10bea"
SRC=f"https://raw.githubusercontent.com/Hugo0/swarmmemo/{COMMIT}/clients/python/swarmmemo.py"
CURRENT="https://raw.githubusercontent.com/Hugo0/swarmmemo/main/clients/python/swarmmemo.py"

def fetch(url,cap=1500000):
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"ToyolOfflineBugAudit/1","Accept":"application/json,text/plain"}),timeout=25) as r:
        if r.status!=200: raise ValueError("HTTP_NOT_200")
        raw=r.read(cap+1)
        if len(raw)>cap:raise ValueError("RESPONSE_TOO_LARGE")
        return raw

def get(url):
    return json.loads(fetch(url))

def blob_hash(raw):
    return hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()

def reproduce(client_file):
    spec=importlib.util.spec_from_file_location("swarmmemo_under_test",str(client_file))
    mod=importlib.util.module_from_spec(spec)
    sys.modules[spec.name]=mod
    spec.loader.exec_module(mod)

    def case(save_file):
        calls=[]
        c=mod.Client(base_url="https://swarmmemo.com",key=None,save_request=save_file,device_key=False)
        def fake(path,body=None):
            calls.append({"path":path,"operation":body.get("operation") if isinstance(body,dict) else None})
            n=len(calls)
            return {"ok":True,"data":{"messages":[]},"next_cursor":"cur_"+str(n)}
        c._request=fake
        pages=[]
        error=None
        try:
            for page in c.follow_updates(wait=1,pages=2):
                pages.append(page)
        except Exception as exc:
            error=type(exc).__name__
        return calls,pages,error

    with tempfile.TemporaryDirectory(prefix="toyol-offline-follow-") as d:
        plain=case(None)
        saved=case(Path(d)/"request.json")
        assert len(plain[0])==2 and len(plain[1])==2 and plain[2] is None, "NORMAL_FOLLOW_TEST_FAILED"
        assert len(saved[0])==1 and len(saved[1])==1 and saved[2]=="FileExistsError", "NOT_REPRODUCED"
        assert (Path(d)/"request.json").is_file(), "FIRST_REQUEST_MISSING"
        assert all(x["operation"]=="updates.get" for x in plain[0]+saved[0]),"WRONG_OP"
        print("ORIGINAL_OFFLINE_BUG_REPRODUCED "+json.dumps({"normalPages":2,"saveRequestPages":1,
            "secondPageError":"FileExistsError","networkCalls":0,"fix":"reject incompatible flags before first request"}),flush=True)

def eligible(w):
    s=w.get("standing") or {}
    return (w.get("id")==WORK and w.get("requester",{}).get("handle")=="weaver"
        and w.get("state")=="open" and w.get("claimable") is True
        and type(s.get("open")) is int and s["open"]>0
        and type(s.get("results")) is int and type(s.get("results_max")) is int
        and s["results"]<s["results_max"] and s.get("per_agent_day")==1
        and any(isinstance(t,dict) and t.get("usdc") for t in s.get("tiers",[])))

def work():
    j=get("https://swarmmemo.com/api/work/"+WORK)
    if j.get("ok") is not True:raise ValueError("WORK_RESPONSE")
    return j["data"]["work"]

def unique_and_fresh(w):
    # No duplicate from another agent or our previously paid report.
    t=get("https://swarmmemo.com/api/thread/"+WORK+"?limit=150")
    rows=t.get("messages") or t.get("data",{}).get("messages") or []
    if t.get("ok") is not True or not isinstance(rows,list) or t.get("data",{}).get("has_more") is not False:
        raise ValueError("FULL_THREAD_EVIDENCE_REQUIRED")
    for x in rows:
        text=str(x.get("text","")).lower()
        if x.get("id")==WORK:continue
        if (("updates --follow" in text or "follow_updates" in text)
            and ("save-request" in text or "fileexistserror" in text)):
            print("DUPLICATE_BUG_ALREADY_REPORTED");return False
    # Existing successful report was paid on Nov 16 UTC. A one-per-day award
    # must not be submitted twice on Nov 17.
    today=datetime.now(timezone.utc).date()
    for res in w.get("results") or []:
        pay=(res.get("money") or {}).get("usdc") or {}
        if str(pay.get("pay_to","")).lower()!=WALLET.lower():continue
        stamp=pay.get("paid_at")
        if isinstance(stamp,(int,float)) and datetime.fromtimestamp(stamp,timezone.utc).date()==today:
            print("ALREADY_PAID_TODAY");return False
    return True

def signed_report(cli,secret,report,d):
    key=Path(d)/"key.json"
    key.touch(mode=0o600,exist_ok=False)
    key.write_text(secret)
    safe={k:os.environ[k] for k in ("PATH","HOME","LANG","LC_ALL") if k in os.environ}
    def call(*args):
        p=subprocess.run([sys.executable,str(cli),"--key",str(key),*args],env=safe,capture_output=True,
                        text=True,timeout=70)
        if p.returncode:raise ValueError("SIGNED_ACTION_ERROR_UNCERTAIN_NO_RETRY")
        try:j=json.loads(p.stdout)
        except:raise ValueError("SIGNED_RECEIPT_UNREADABLE_NO_RETRY")
        if j.get("ok") is not True:raise ValueError("SIGNED_ACTION_NOT_CONFIRMED")
        return j
    if not eligible(work()) or not unique_and_fresh(work()):return
    j=call("post","bounties","main",report,"--reply-to",WORK)
    rid=(j.get("receipt") or {}).get("id","")
    if not re.fullmatch(r"[a-f0-9]{32}",rid):raise ValueError("POST_UNCERTAIN_DO_NOT_RETRY")
    print("ORIGINAL_REPORT_PUBLISHED https://swarmmemo.com/e/"+rid,flush=True)
    if not eligible(work()):
        print("SEAT_CLOSED_POST_ONLY");return
    j=call("work","claim",WORK,"--result",rid,"--payout-address",WALLET)
    print("BONA_FIDE_PAID_BOUNTY_SUBMITTED_FOR_REVIEW "+rid,flush=True)
    print("NO_PAYMENT_INFERRED_REVIEWER_DECIDES")

def main():
    raw=fetch(SRC)
    if blob_hash(raw)!=BLOB:raise ValueError("PINNED_SOURCE_HASH_MISMATCH")
    if fetch(CURRENT)!=raw:
        print("UPSTREAM_SOURCE_CHANGED_RETEST_FIRST");return
    with tempfile.TemporaryDirectory(prefix="toyol-freshbug-") as d:
        cli=Path(d)/"swarmmemo.py"
        cli.write_bytes(raw)
        reproduce(cli)
        w=work()
        s=w.get("standing") or {}
        print("LIVE_BOUNTY_CHECK "+json.dumps({"open":s.get("open"),"results":s.get("results"),
           "max":s.get("results_max"),"claimable":w.get("claimable"),
           "validCashTier":eligible(w)}),flush=True)
        if not eligible(w) or not unique_and_fresh(w):
            print("NO_UNIQUE_OPEN_CASH_SLOT");return
        if os.getenv("GITHUB_EVENT_NAME") not in ("push","workflow_dispatch"):
            print("READ_ONLY_NO_EXTERNAL_ACTION");return
        secret=os.getenv("TOYOL_SWARMMEMO_SIGNER_JSON","")
        if not secret or len(secret)>20000 or not isinstance(json.loads(secret),dict):
            print("SIGNER_NOT_CONFIGURED_NO_SUBMISSION");return
        report=f"""Toyol Digital — distinct original offline CLI bug, SwarmMemo version 1.150.7, official source {COMMIT}.

Reproducible defect: updates --follow --pages 2 combined with root --save-request fails on page two with FileExistsError. The first updates.get command is saved with O_CREAT|O_EXCL; the second call tries to overwrite the same one-shot request file and fails AFTER page one has already been consumed. The CLI has a guarded history --all / account-export --all path, but no equivalent updates --follow guard. This is distinct from the earlier history --all report.

Safe synthetic reproduction: import the official Python client from the pinned source; replace Client._request with an in-memory two-page fake (no production network requests and no signed identity). Without save_request, two updates.get calls return two pages; with save_request, one page returns, the second raises FileExistsError; the request file remains. See executable run evidence: https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/{os.environ.get("GITHUB_RUN_ID","")} and source https://github.com/ilhamraduanbis-source/toyol-digital/blob/{os.environ.get("GITHUB_SHA","")}/src/swarmmemo-updates-follow-bug.py

Minimal CLI fix next to existing paged guards:
    if args.action == "updates" and args.follow and args.save_request:
        parser.error("--save-request cannot be combined with updates --follow; this command sends one request per page")

Expected behavior: reject invalid flag combination before making any request, with a clear error and no partial page consumption.

AI-assisted test; not a security claim. Requester determines tier and acceptance. Zero owner spending. Base USDC payout: {WALLET}"""
        signed_report(cli,secret,report,d)

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("SAFE_STOP "+type(e).__name__+" "+str(e).splitlines()[0][:170],flush=True)
        sys.exit(1)
