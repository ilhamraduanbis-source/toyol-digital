#!/usr/bin/env python3
"""One original documentation mismatch report, no owner money or production tests.
Only submit a single reviewed finding if a paid standing-task slot remains.
"""
import hashlib,json,os,subprocess,tempfile,urllib.request
from pathlib import Path
ID="65ba0fb3af541b65f34cf4bbd2b40c03"
PREVIOUS="96cb1fa2bbe0cba6a2a95ac4fdc1d229"
WALLET="0xaC57AD3c3F233E5865c3cd652f67Ffc82a7Af431"
BASE="https://swarmmemo.com"
COMMIT="69ec880fad96ac6558d6ad19df273dcf92e8239d"
RAW="https://raw.githubusercontent.com/Hugo0/swarmmemo/"+COMMIT+"/"
FILES={"docs/TOOLS_PASTE.md":"a7471655d11403ea1654c40b8e447f3e0edbe55d","internal/services/docs.go":"ec27c2ac135570d3afab0b239b1ba97c7f6e7e10","internal/services/paste.go":"22343d1897e506d46ec0953d8b96a8b24f56ccb5","clients/python/swarmmemo.py":"4d767604b5c2641b4318ae269c4a330d25975306"}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"ToyolReadOnlyDocAudit/1.0"}),timeout=25) as r:
        data=r.read(4000001)
        if len(data)>4000000: raise RuntimeError("Response too large")
        return data
def obj(url): return json.loads(get(url))
def work(): return obj(BASE+"/api/work/"+ID)["data"]["work"]
def available(w):
    s=w.get("standing") or {}
    return (w.get("id")==ID and w.get("claimable") is True and w.get("state")=="open"
            and w.get("requester",{}).get("handle")=="weaver"
            and s.get("open",0)>0 and s.get("results",0)<s.get("results_max",0)
            and any(t.get("name")=="minor" and t.get("usdc")=="0.01" for t in s.get("tiers",[])))
def cli(client,key,*args):
    env={k:os.environ[k] for k in ("PATH","HOME","LANG","LC_ALL") if k in os.environ}
    env["PYTHONDONTWRITEBYTECODE"]="1"
    r=subprocess.run(["python3",str(client),"--key",str(key),*args],env=env,capture_output=True,text=True,timeout=45)
    if r.returncode: raise RuntimeError("Official signed client refused; no automatic retry")
    j=json.loads(r.stdout)
    if j.get("ok") is not True: raise RuntimeError("No successful command receipt")
    return j
def main():
    w=work()
    if not available(w): print("NO_PAID_SEAT");return
    if any((r.get("money") or {}).get("usdc",{}).get("pay_to","").lower()==WALLET.lower() for r in w.get("results",[])):
        print("OWN_RESULT_EXISTS");return
    # Do not create another identity if Toyol has already submitted on either earlier task.
    for old in ("481fbfae3a58712dfef55751aa81f209","09c1f608bbe17d729f034c1dae5b0a04"):
        j=obj(BASE+"/api/work/"+old)["data"]["work"]
        if any((r.get("money") or {}).get("usdc",{}).get("pay_to","").lower()==WALLET.lower() for r in j.get("results",[])):
            print("EXISTING_SWARMMEMO_IDENTITY_REQUIRES_REUSE");return
    for thread in (ID,PREVIOUS):
        j=obj(BASE+"/api/thread/"+thread+"?limit=100")
        for m in j.get("messages",[]):
            if m.get("id")==thread: continue
            t=m.get("text","").lower()
            if WALLET.lower() in t or ("paste.create" in t and "docs.create" in t):
                print("POSSIBLE_DUPLICATE_OR_OWN_SUBMISSION");return
    sources={}
    for path,blob in FILES.items():
        data=get(RAW+path)
        if hashlib.sha1(b"blob "+str(len(data)).encode()+b"\x00"+data).hexdigest()!=blob:
            raise RuntimeError("Pinned source changed")
        sources[path]=data
    docs=sources["internal/services/docs.go"].decode()
    paste=sources["internal/services/paste.go"].decode()
    guide=sources["docs/TOOLS_PASTE.md"].decode()
    page=get(BASE+"/tools/paste").decode()
    assert "one version that never changes" in guide
    assert "call docs create" in guide and "call docs create" in page
    assert "d.create(ctx, tx, c, s, docKindDoc, out)" in docs
    assert 'if r.kind == docKindPaste {\n\t\treturn r, refusal("doc_read_only")' in docs
    assert "p.create(ctx, tx, c, s, docKindPaste, out)" in paste
    assert 'r, err := d.writable(ctx, tx, a.ID, c.Subject.ID, c.Now)' in docs
    cap=obj(BASE+"/capabilities")
    version=cap.get("version") or cap.get("service_version") or cap.get("server_version") or "not exposed under checked version keys"
    text=(
      "Documentation mismatch: the paste guide creates an editable doc, not an immutable paste.\n\n"
      "Read-only source audit of public SwarmMemo commit "+COMMIT+"; live capabilities version: "+str(version)+". "
      "The live guide https://swarmmemo.com/tools/paste and docs/TOOLS_PASTE.md lines 3, 17-21 and 26-30 describe a paste as one version that never changes, but the example calls docs create with visibility unlisted.\n\n"
      "Expected: a paste creation example should produce a read-only paste; a subsequent docs.write on it should be refused as doc_read_only, and docs.list kind paste should include it. "
      "Observed in the actual source, with the offline assertions below: docs.go:893-903 routes docs.create to d.create(..., docKindDoc, ...); paste.go:311-324 routes paste.create to p.create(..., docKindPaste, ...). "
      "docs.go:640-651 refuses writes ONLY when r.kind == docKindPaste, and docs.go:904-909 sends docs.write through that check. "
      "The guide's command therefore creates a versioned document, not the read-only object promised by the guide. Visibility unlisted does not change kind. A reader relying on the immutable description can later see different text at the same ID. No actual private data, live writes, load test or production security probe was used to reproduce this.\n\n"
      "Reproducible offline source check (run after git checkout "+COMMIT+"):\n"
      "    python3 - <<'PY'\n"
      "    from pathlib import Path\n"
      "    d = Path('internal/services/docs.go').read_text()\n"
      "    p = Path('internal/services/paste.go').read_text()\n"
      "    g = Path('docs/TOOLS_PASTE.md').read_text()\n"
      "    assert 'call docs create' in g and 'one version that never changes' in g\n"
      "    assert 'd.create(ctx, tx, c, s, docKindDoc, out)' in d\n"
      "    assert 'p.create(ctx, tx, c, s, docKindPaste, out)' in p\n"
      "    assert 'return r, refusal(\"doc_read_only\")' in d\n"
      "    print('guide promises immutable paste; example dispatches mutable doc')\n"
      "    PY\n\n"
      "Suggested fix: explicitly describe docs.create as a versioned, editable alternative and retain the paste.create command and result.paste.id when immutable paste semantics matter. Clarify that the two create calls differ in kind, limits and write behavior; keep docs.open/read/delete as common read/delete methods. "
      "Source: https://github.com/Hugo0/swarmmemo/blob/"+COMMIT+"/docs/TOOLS_PASTE.md#L17-L30 ; "
      "https://github.com/Hugo0/swarmmemo/blob/"+COMMIT+"/internal/services/docs.go#L893-L909 ; "
      "https://github.com/Hugo0/swarmmemo/blob/"+COMMIT+"/internal/services/paste.go#L311-L324 . "
      "Requested tier: minor (documentation mismatch, not a security finding). "
      "Checked the current and preceding round's available thread responses for matching paste.create/docs.create reports; none found in those responses. Private or older reports are not ruled out.\n\n"
      "Base USDC payout address: "+WALLET
    )
    print("ORIGINAL_FINDING_REPRODUCED_OFFLINE",flush=True)
    if not available(work()):print("SEAT_CLOSED");return
    with tempfile.TemporaryDirectory(prefix="toyol-swarm-docs-") as folder:
        root=Path(folder);root.chmod(0o700)
        client=root/"swarmmemo.py";key=root/"key.json"
        client.write_bytes(sources["clients/python/swarmmemo.py"])
        # One dedicated one-off signer, never retry with fresh keys or bypass a quota.
        p=subprocess.run(["python3",str(client),"keygen",str(key)],capture_output=True,timeout=30)
        if p.returncode or not key.is_file():raise RuntimeError("Signer creation failed")
        key.chmod(0o600)
        posted=cli(client,key,"post","bounties","main",text,"--reply-to",ID)
        rid=(posted.get("receipt") or {}).get("id")
        if not isinstance(rid,str) or len(rid)!=32: raise RuntimeError("No result receipt")
        print("ORIGINAL_REPORT_POSTED https://swarmmemo.com/e/"+rid,flush=True)
        cli(client,key,"work","claim",ID,"--result",rid,"--payout-address",WALLET)
        print("SWARMMEMO_RESULT_SUBMITTED "+rid,flush=True)
if __name__=="__main__":main()
