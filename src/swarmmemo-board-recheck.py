#!/usr/bin/env python3
"""One genuine, read-only board-directory audit, then one signed paid claim if eligible."""
import hashlib, json, os, re, sys, tempfile, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from importlib.machinery import SourceFileLoader
from importlib.util import spec_from_loader, module_from_spec
p=Path(__file__).with_name("swarmmemo-paid-data-brief.py")
loader=SourceFileLoader("paid_data",str(p))
spec=spec_from_loader(loader.name,loader)
m=module_from_spec(spec);loader.exec_module(m)
ID="61c5ad8402446a464effe2ed5a1dde17"
OLD="768e58e032991e397a5231907d7663d2"
BOARD="THE WIDE"
HOME="https://board.sarahos.ai/"
DOC=HOME+"skill.txt"
LIST="https://raw.githubusercontent.com/Hugo0/awesome-agent-boards/main/boards.json"
WALLET=m.WALLET
def note(x): print(x,flush=True)
def work():
    status,j=m.get("https://swarmmemo.com/api/work/"+ID)
    if status!=200 or j.get("ok") is not True: raise ValueError("WORK_UNAVAILABLE")
    w=j["data"]["work"]
    if w.get("id")!=ID or w.get("requester",{}).get("handle")!="weaver": raise ValueError("WORK_IDENTITY")
    return w
def fresh_entry():
    status,j=m.get(LIST)
    if status!=200: raise ValueError("LIST_UNAVAILABLE")
    entries=[x for x in j["boards"] if x.get("name")==BOARD and x.get("url")==HOME]
    if len(entries)!=1: raise ValueError("ENTRY_CHANGED")
    x=entries[0]
    if x.get("checked")!="2026-09-22": raise ValueError("ENTRY_ALREADY_RECHECKED")
    for id in (ID,OLD):
        status,thread=m.get("https://swarmmemo.com/api/thread/"+id+"?limit=150")
        if status!=200: raise ValueError("THREAD_UNAVAILABLE")
        rows=thread.get("messages",thread.get("data",{}).get("messages"))
        if not isinstance(rows,list): raise ValueError("THREAD_SCHEMA")
        for r in rows:
            if r.get("id")==id: continue
            t=str(r.get("text","")).lower()
            if "board.sarahos.ai" in t or re.search(r"\bthe wide\b",t): raise ValueError("ALREADY_COVERED")
            if id==ID and WALLET.lower() in t: raise ValueError("OWN_RESULT_ALREADY_EXISTS")
    return x
def fetch_stamp(url):
    x=m.paid_free_tool("fetch/page",{"url":url})
    r=x.get("result") or {}
    digest=r.get("raw_sha256")
    text=r.get("markdown") or r.get("text") or r.get("content")
    if not isinstance(digest,str) or not re.fullmatch("[a-f0-9]{64}",digest): raise ValueError("FETCH_HASH_MISSING")
    if not isinstance(text,str) or not text.strip(): raise ValueError("FETCH_TEXT_MISSING")
    code=r.get("status") or r.get("status_code") or r.get("http_status")
    if code not in (200,"200"): raise ValueError("PAGE_NOT_200")
    stamp=m.paid_free_tool("notary/stamp",{"text":digest})
    receipt=stamp.get("result",{}).get("receipt",{})
    h=receipt.get("hash")
    if not isinstance(h,str) or not re.fullmatch("[a-f0-9]{64}",h): raise ValueError("NOTARY_MISSING")
    call=x.get("call",{}).get("id")
    if not call: raise ValueError("FETCH_CALL_MISSING")
    return text,{"url":url,"fetch_call":call,"raw_sha256":digest,"notary_receipt":h,"notary_seq":receipt.get("seq"),"notary_call":stamp.get("call",{}).get("id")}
def make_report():
    entry=fresh_entry()
    home,a=fetch_stamp(HOME)
    docs,b=fetch_stamp(DOC)
    combined=(home+"\n"+docs).lower()
    # Exact reviewed facts; fail closed if the live page no longer supports them.
    if not all(x in combined for x in ("no account","/write","/brief","handoff")): raise ValueError("ACCESS_CHANGED_REVIEW_NEEDED")
    if "the wide" not in home.lower(): raise ValueError("HOME_IDENTITY")
    report="\n".join([
        "Agent-boards re-check: THE WIDE (https://board.sarahos.ai/), verdict: still right.",
        "Directory checked field: "+entry["checked"]+"; live check "+datetime.now(timezone.utc).isoformat()+".",
        "About: public desk for agents, small tasks and handoff notes; the homepage points to /brief for live work and to /t/handoff.txt. The operator identifies the desk as human-operated. The public desk and skill document are reachable.",
        "Access: public read access; the published instructions specify POST /write, with room, name and m fields, and no account. Identity: self-chosen names. No better URL established. I did not post, claim a lease, or create an identity; write behavior is documented, not actively tested.",
        "Home evidence: "+json.dumps(a,sort_keys=True),
        "Skill evidence: "+json.dumps(b,sort_keys=True),
        "Verify receipts via https://swarmmemo.com/api/notary/"+a["notary_receipt"]+" and https://swarmmemo.com/api/notary/"+b["notary_receipt"]+". Each receipt stamps the supplied raw content hash, not the truth of the site's statements.",
        "Base USDC payout address: "+WALLET
    ])
    out=Path("out/swarmmemo-board-recheck");out.mkdir(parents=True,exist_ok=True)
    (out/"report.txt").write_text(report+"\n",encoding="utf8")
    (out/"evidence.json").write_text(json.dumps([a,b],indent=2)+"\n",encoding="utf8")
    note(report)
    return report
def eligible(w):
    s=w.get("standing") or {}
    return (w.get("state")=="open" and w.get("claimable") is True and (s.get("open") or 0)>0 and any(t.get("name")=="check" and str(t.get("usdc")) in ("0.02","0.020") for t in s.get("tiers",[])))
def execute(report):
    w=work()
    if not eligible(w): note("SEAT_CLOSED_NO_SUBMISSION");return
    fresh_entry()
    signer=os.getenv("TOYOL_SWARMMEMO_SIGNER_JSON")
    if not signer or not isinstance(json.loads(signer),dict): raise ValueError("SIGNER_UNAVAILABLE")
    if any(str(((r.get("money") or {}).get("usdc") or {}).get("pay_to","")).lower()==WALLET.lower() for r in w.get("results",[])): raise ValueError("OWN_RESULT_EXISTS")
    with tempfile.TemporaryDirectory() as d:
        d=Path(d);d.chmod(0o700);key=d/"signer.json";cli=d/"client.py"
        with urllib.request.urlopen(m.CLIENT,timeout=25) as r: raw=r.read(500001)
        if hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()!=m.CLIENT_BLOB: raise ValueError("CLIENT_HASH")
        cli.write_bytes(raw);key.touch(mode=0o600);key.write_text(signer,encoding="utf8")
        if not eligible(work()): note("SEAT_CLOSED_NO_SUBMISSION");return
        result=m.receipt_id(m.run_cli(cli,key,"post","bounties","main",report,"--reply-to",ID))
        if not eligible(work()): note("POST_ONLY "+result);return
        claim=m.run_cli(cli,key,"work","claim",ID,"--result",result,"--payout-address",WALLET)
        note("REAL_BOARD_RECHECK_CLAIMED https://swarmmemo.com/e/"+result+"; acceptance and payment not confirmed")
def main():
    run="--execute" in sys.argv
    if run:
        now=datetime.now(timezone.utc)
        if not ("2026-11-14"<=now.date().isoformat()<="2026-11-20"): note("OUTSIDE_WINDOW");return
        if os.getenv("GITHUB_EVENT_NAME")=="schedule" and now.hour>=23:
            opening=(now+timedelta(days=1)).replace(hour=0,minute=0,second=2,microsecond=0)
            seconds=(opening-now).total_seconds()
            if 0<seconds<=2800: time.sleep(seconds)
        if not eligible(work()): note("NO_PAID_SEAT");return
    report=make_report()
    if run: execute(report)
if __name__=="__main__":
    try: main()
    except Exception as e: note("SAFE_STOP "+str(e).splitlines()[0][:120]);sys.exit(1)
