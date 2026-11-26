#!/usr/bin/env python3
"""ReleaseGuard: read Flagsmith SDK state, propose a reversible human-reviewed change."""
import argparse, hashlib, json, os, re, shlex, sys, urllib.request
from pathlib import Path

ENDPOINT = "https://edge.api.flagsmith.com/api/v1/flags/"
MAX_BYTES = 1024 * 1024
NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}\Z")
KEY = re.compile(r"[A-Za-z0-9]{10,128}\Z")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError("Redirect refused")

def read_flags(key):
    if not KEY.fullmatch(key): raise ValueError("Invalid client environment key")
    req = urllib.request.Request(ENDPOINT, headers={"X-Environment-Key":key,"Accept":"application/json"})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=15) as r:
        raw=r.read(MAX_BYTES+1)
        if len(raw)>MAX_BYTES: raise ValueError("Response too large")
    return normalize(json.loads(raw))

def normalize(rows):
    if not isinstance(rows,list) or len(rows)>10000: raise ValueError("Expected Flagsmith flag array")
    out={}
    for row in rows:
        if not isinstance(row,dict) or not isinstance(row.get("feature"),dict): raise ValueError("Invalid feature")
        n=row["feature"].get("name"); enabled=row.get("enabled")
        if not isinstance(n,str) or not NAME.fullmatch(n) or type(enabled) is not bool or n in out:
            raise ValueError("Invalid or duplicate flag")
        # Intentionally omit remote config values: they are untrusted and may be sensitive.
        out[n]=enabled
    return out

def canonical(x):
    return json.dumps(x,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()

def digest(x): return hashlib.sha256(canonical(x)).hexdigest()
def validate_env(key):
    if not isinstance(key,str) or not KEY.fullmatch(key): raise ValueError("Invalid environment key")

def plan(flags,key,name,desired):
    validate_env(key)
    if not isinstance(name,str) or not NAME.fullmatch(name) or name not in flags: raise ValueError("Unknown/unsafe flag name")
    if type(flags[name]) is not bool or type(desired) is not bool: raise ValueError("Boolean state required")
    if flags[name] == desired: raise ValueError("No change needed")
    data={"version":1,"environment_fingerprint":digest(key),"flag":name,
          "before":flags[name],"after":desired,"snapshot_sha256":digest(flags),
          "scope":"environment default; segment/identity overrides not inspected"}
    return {"plan":data,"approval_sha256":digest(data)}

def approve(record,token,flags,key):
    if not isinstance(record,dict) or set(record)!={"plan","approval_sha256"}: raise ValueError("Invalid plan record")
    p=record["plan"]
    if not isinstance(p,dict) or not isinstance(token,str): raise ValueError("Invalid approval")
    if digest(p)!=token or record["approval_sha256"]!=token: raise ValueError("Approval digest mismatch")
    # Reconstruct rather than trust command strings from a saved plan.
    fresh=plan(flags,key,p.get("flag"),p.get("after"))
    if fresh!=record: raise ValueError("Environment or state changed; create a new plan")
    def cmd(state):
        return shlex.join(["flagsmith","flag","update",p["flag"],"--enable" if state else "--disable","--environment",key])
    return {"approved_plan":token,"status":"HUMAN_EXECUTION_REQUIRED",
            "change_command":cmd(p["after"]),"rollback_command":cmd(p["before"]),
            "warning":"Use only a dedicated test environment you own. Verify CLI project/organisation, overrides and permissions. Recheck state immediately before execution; no atomic compare-and-set. Rollback is not guaranteed if another change intervenes."}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest="mode",required=True)
    sub.add_parser("inspect")
    p=sub.add_parser("plan");p.add_argument("flag");p.add_argument("state",choices=["on","off"])
    a=sub.add_parser("approve");a.add_argument("file");a.add_argument("digest")
    args=parser.parse_args()
    key=os.environ.get("FLAGSMITH_ENVIRONMENT","")
    flags=read_flags(key)
    if args.mode=="inspect": result={"source":"LIVE_FLAGSMITH_SDK_API","flags":flags,"snapshot_sha256":digest(flags)}
    elif args.mode=="plan": result=plan(flags,key,args.flag,args.state=="on")
    else:
        with Path(args.file).open("rb") as f: raw=f.read(MAX_BYTES+1)
        if len(raw)>MAX_BYTES: raise ValueError("Plan file too large")
        result=approve(json.loads(raw),args.digest,flags,key)
    print(json.dumps(result,indent=2))
if __name__=="__main__":
    try: main()
    except (ValueError,OSError,KeyError,TypeError) as e:
        print("ReleaseGuard stopped: "+type(e).__name__,file=sys.stderr);sys.exit(1)
