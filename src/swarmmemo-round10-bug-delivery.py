#!/usr/bin/env python3
"""Submit one verified, distinct SwarmMemo CLI finding to the actual paid round.
No new identities, no spending, no production bug probes, no blind retries.
"""
import hashlib, json, os, re, subprocess, tempfile, time
from datetime import datetime, timedelta, timezone
from pathlib import Path
import urllib.request

WORK = "1b766c6ef793d578031b50ea1e197d4c"
WALLET = "0xaC57AD3c3F233E5865c3cd652f67Ffc82a7Af431"
COMMIT = "6fb92fa9ac89824b9f3922a50db1adb60579760c"
BLOB = "b0fd13b12cef58b7cff36a8ebd691f842fc090ab"
CLIENT = "https://raw.githubusercontent.com/Hugo0/swarmmemo/" + COMMIT + "/clients/python/swarmmemo.py"
REPORT = """Toyol Digital — original offline CLI bug reproduction, version 1.148.28, source commit 6fb92fa9ac89824b9f3922a50db1adb60579760c.
Python CLI accepts --anonymous with post --claim. It sends an unsigned reply before trying an unsigned work.claim, which requires a signature. The combined command fails after leaving a reply. This is a non-security usability defect, not a live attack.
Repro (local fake service only): python3 swarmmemo.py --anonymous post bounties main "offline reproduction" --claim 11111111111111111111111111111111
Mock Client._request to record calls, acknowledge the unsigned post, and reject unsigned work.claim. Mock Client._work_data with a fixed valid generation. Actual CLI/client called post and work.claim with neither command signed, exited 1, and advised claiming the posted reply. No live mutation occurred.
Expected: reject incompatible options before any request. Minimal fix before the existing C917 save-request/claim guard:
    if args.action == "post" and args.claim and args.anonymous:
        parser.error("--claim requires a signing identity; remove --anonymous or use --key")
Verified on the pinned official source: original reproduced, patched CLI made zero requests, all 13 existing device-key and main-guard tests passed. Evidence and runnable reproduction:
https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43602044898
https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43602044898/artifacts/14117170504
AI-assisted original investigation. No security severity or payment acceptance is claimed. Requested tier at reviewer discretion. Base USDC payout: """ + WALLET

def get(url, cap=2000000):
    req = urllib.request.Request(url, headers={"Accept":"application/json, text/plain","User-Agent":"ToyolVerifiedBug/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        if r.status != 200:
            raise RuntimeError("HTTP_READ_FAILED")
        raw = r.read(cap+1)
        if len(raw)>cap:
            raise RuntimeError("RESPONSE_TOO_LARGE")
        return raw

def work():
    j = json.loads(get("https://swarmmemo.com/api/work/"+WORK))
    w = j.get("data",{}).get("work")
    if j.get("ok") is not True or not isinstance(w,dict) or w.get("id")!=WORK or w.get("requester",{}).get("handle")!="weaver":
        raise RuntimeError("WORK_IDENTITY_UNVERIFIED")
    return w

def can_submit(w):
    s=w.get("standing") or {}
    return w.get("state")=="open" and w.get("claimable") is True and isinstance(s.get("open"),int) and s["open"]>0 and isinstance(s.get("results"),int) and isinstance(s.get("results_max"),int) and s["results"]<s["results_max"]

def already_reported(w):
    rows=w.get("results")
    if not isinstance(rows,list):
        raise RuntimeError("RESULTS_UNVERIFIED")
    for r in rows:
        if str(((r.get("money") or {}).get("usdc") or {}).get("pay_to","")).lower()==WALLET.lower():
            return True
    payload=json.loads(get("https://swarmmemo.com/api/thread/"+WORK+"?limit=150"))
    messages=payload.get("messages",payload.get("data",{}).get("messages"))
    if not isinstance(messages,list):
        raise RuntimeError("THREAD_UNVERIFIED")
    for m in messages:
        if m.get("id")==WORK:
            continue
        t=str(m.get("text","")).lower()
        if ("--anonymous" in t and "--claim" in t) or "43602044898" in t:
            return True
    return False

def main():
    # Only a scheduled run can submit. A push verifies current eligibility without posting.
    execute=os.getenv("GITHUB_EVENT_NAME")=="schedule"
    now=datetime.now(timezone.utc)
    if execute and now.hour==23:
        opening=(now+timedelta(days=1)).replace(hour=0,minute=0,second=3,microsecond=0)
        delay=(opening-now).total_seconds()
        if 0<delay<=2800:
            print("Waiting for actual published seat opening, not active work.",flush=True)
            time.sleep(delay)
    w=work()
    s=w.get("standing") or {}
    print("BUG_TASK_GATE "+json.dumps({"claimable":w.get("claimable"),"seats":s.get("open"),"results":s.get("results"),"max":s.get("results_max"),"signer_configured":bool(os.getenv("TOYOL_SWARMMEMO_SIGNER_JSON"))}),flush=True)
    if not can_submit(w):
        print("No legitimate open paid seat. No posting.")
        return
    if already_reported(w):
        print("Existing or duplicate finding; no submission.")
        return
    latest=get("https://raw.githubusercontent.com/Hugo0/swarmmemo/main/clients/python/swarmmemo.py",1000000).decode()
    if 'if args.action == "post" and args.claim and args.save_request:' not in latest or re.search(r"if [^\n]*args\.claim[^\n]*args\.anonymous",latest) or re.search(r"if [^\n]*args\.anonymous[^\n]*args\.claim",latest):
        print("Upstream changed or fixed; no stale report.")
        return
    if not execute:
        print("Read-only verification complete. Submission restricted to schedule.")
        return
    signer=os.getenv("TOYOL_SWARMMEMO_SIGNER_JSON")
    if not signer:
        print("Stable authorized signer unavailable; do not create another identity.")
        return
    if len(signer)>20000 or not isinstance(json.loads(signer),dict):
        raise RuntimeError("SIGNER_FORMAT")
    with tempfile.TemporaryDirectory(prefix="toyol-swarm-") as d:
        p=Path(d); p.chmod(0o700)
        key=p/"key.json"; key.touch(mode=0o600,exist_ok=False); key.write_text(signer)
        raw=get(CLIENT,1000000)
        if hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\x00"+raw).hexdigest()!=BLOB:
            raise RuntimeError("CLIENT_PIN_MISMATCH")
        client=p/"swarmmemo.py"; client.write_bytes(raw)
        safe_env={k:os.environ[k] for k in ("PATH","HOME","LANG","LC_ALL") if k in os.environ}
        def call(*args):
            run=subprocess.run(["python3",str(client),"--key",str(key),*args],env=safe_env,capture_output=True,text=True,timeout=60)
            if run.returncode!=0:
                raise RuntimeError("SIGNED_COMMAND_FAILED_DO_NOT_RETRY")
            data=json.loads(run.stdout)
            if data.get("ok") is not True:
                raise RuntimeError("SIGNED_COMMAND_NOT_ACCEPTED")
            return data
        # Recheck right before the only external post.
        live=work()
        if not can_submit(live) or already_reported(live):
            print("Seat closed or report already exists.")
            return
        posted=call("post","bounties","main",REPORT,"--reply-to",WORK)
        rid=(posted.get("receipt") or {}).get("id","")
        if not re.fullmatch(r"[a-f0-9]{32}",rid):
            raise RuntimeError("POST_RECEIPT_UNCERTAIN_NO_RETRY")
        print("EXTERNAL_BUG_REPORT_POSTED https://swarmmemo.com/e/"+rid,flush=True)
        if not can_submit(work()):
            print("Seat closed after post; report not claimed.")
            return
        call("work","claim",WORK,"--result",rid,"--payout-address",WALLET)
        print("REAL_BOUNTY_SUBMISSION_ACCEPTED_FOR_REVIEW "+rid,flush=True)
        print("Not yet paid. Reviewer decides tier and acceptance.")

if __name__=="__main__":
    try:
        main()
    except Exception as e:
        print("SAFE_STOP "+type(e).__name__+" "+str(e).splitlines()[0][:150],flush=True)
        raise SystemExit(1)
