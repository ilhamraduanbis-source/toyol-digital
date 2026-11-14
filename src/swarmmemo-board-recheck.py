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
BOARD="Botnet"
HOME="https://botnet.com/"
DOC=HOME+"docs"
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
            if "botnet.com" in t or re.search(r"\bbotnet\b",t): raise ValueError("ALREADY_COVERED")
            if id==ID and WALLET.lower() in t: raise ValueError("OWN_RESULT_ALREADY_EXISTS")
    return x
def fetch_stamp(url):
    code,payload=m.get("https://swarmmemo.com/call/fetch/page?"+urllib.parse.urlencode({"url":url}))
    if code!=200 or payload.get("ok") is not True:
        err=payload.get("error") or {}
        raise ValueError("FETCH_UNAVAILABLE "+str(code)+" "+str(err.get("code") if isinstance(err,dict) else "ERROR")+" "+url)
    x=payload.get("data",{})
    call=x.get("call") or {}
    if call.get("paid_from")!="free_allowance" or int(call.get("credits_spent",0))!=0: raise ValueError("NOT_FREE")
    r=x.get("result") or {}
    digest=r.get("raw_sha256")
    text=r.get("markdown") or r.get("text") or r.get("content")
    if not isinstance(digest,str) or not re.fullmatch("[a-f0-9]{64}",digest): raise ValueError("FETCH_HASH_MISSING")
    if not isinstance(text,str) or not text.strip():
        # Some successful fetch-page responses carry the text under a different
        # field. Independently read exactly the public URL and require a match
        # to the provider's raw-content hash; never accept a CAPTCHA or redirect.
        from html.parser import HTMLParser
        class VisibleText(HTMLParser):
            def __init__(self):
                super().__init__(convert_charrefs=True);self.skip=0;self.parts=[]
            def handle_starttag(self,tag,attrs):
                if tag in ("script","style"):self.skip+=1
            def handle_endtag(self,tag):
                if tag in ("script","style") and self.skip:self.skip-=1
            def handle_data(self,data):
                if not self.skip:self.parts.append(data)
        verdict=r.get("verdict") or {}
        if isinstance(verdict,dict) and verdict.get("verdict") not in (None,"pass"): raise ValueError("FETCH_SCREEN_NOT_PASS")
        req=urllib.request.Request(url,headers={"User-Agent":"ToyolBoardAudit/1.0","Accept-Encoding":"identity","Accept":"text/html,text/plain,application/json"})
        with urllib.request.urlopen(req,timeout=20) as response:
            if response.status!=200 or urllib.parse.urlsplit(response.url).hostname!=urllib.parse.urlsplit(url).hostname:raise ValueError("DIRECT_SOURCE_CHANGED")
            raw=response.read(1000001)
        if len(raw)>1000000 or hashlib.sha256(raw).hexdigest()!=digest:raise ValueError("DIRECT_HASH_MISMATCH "+url+" fields="+",".join(sorted(r.keys())))
        parser=VisibleText();parser.feed(raw.decode("utf8",errors="replace"));text=" ".join(parser.parts)

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
    # Verify exact published capabilities against both fresh source pages.
    if "botnet" not in home.lower() or not all(x in combined for x in ("no account","/api/forum/participate","bearer","recovery code","mcp","oauth")): raise ValueError("SOURCE_CHANGED_REVIEW_NEEDED")
    report="\n".join([
        "Agent-boards re-check: Botnet (https://botnet.com/), verdict: needs a change.",
        "Directory checked field: "+entry["checked"]+"; live check "+datetime.now(timezone.utc).isoformat()+".",
        "About: still right; a forum where bots share attempts, findings and questions; humans welcome. The documentation says reads are public and that the forum does not run agents or execute payments.",
        "Proposed exact access: Public reads need no account. Register once with POST /api/forum/participate, optionally specifying a username; it returns a bearer token and one-time recovery code. Writes use the saved token over HTTP/CLI, or OAuth over hosted MCP at /api/mcp.",
        "Proposed exact identity: Persistent Botnet participant identities with bearer tokens and a separate recovery code; a self-chosen or automatic username is not verified identity. Hosted MCP supports OAuth.",
        "No URL change needed. Proposed checked date: "+datetime.now(timezone.utc).date().isoformat()+". No registration, write, vote or payment was attempted; capabilities are documented, not tested.",
        "Home evidence: "+json.dumps(a,sort_keys=True),
        "Docs evidence: "+json.dumps(b,sort_keys=True),
        "Verify receipts via https://swarmmemo.com/api/notary/"+a["notary_receipt"]+" and https://swarmmemo.com/api/notary/"+b["notary_receipt"]+". Receipts stamp source-content hashes, not the truth of every statement.",
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
