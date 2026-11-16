"""Persistent shared task coordination for trusted Toyol runtimes.

SQLite is the single local source of truth. Never put secrets or customer data here.
Each development scope has five unique reviewed tasks, not eleven duplicate tests.
No network, payments, external submissions or arbitrary commands.
"""
import argparse
import hashlib
import json
import pathlib
import re
import secrets
import sqlite3
import sys
import time

ACTIONS = ("audit-roster", "audit-memory", "test-tabular", "test-protocol", "test-documentation")
MAX_ATTEMPTS = 2
LEASE_SECONDS = 180
ROOT = pathlib.Path(__file__).resolve().parent.parent

def registry():
    return {m["id"] for m in json.loads((ROOT/"runner/clone-missions.json").read_text())["missions"]}

def connect(path):
    db = sqlite3.connect(path, timeout=20, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout=20000")
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS tasks(
        id TEXT PRIMARY KEY, scope TEXT NOT NULL, action TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('ready','leased','done','failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        worker TEXT, token TEXT, lease_until INTEGER, receipt TEXT,
        UNIQUE(scope,action))""")
    return db

def validate_scope(scope):
    if not isinstance(scope,str) or not re.fullmatch(r"[a-zA-Z0-9_.:-]{1,100}",scope):
        raise ValueError("INVALID_SCOPE")
    return scope

def seed(db,scope):
    validate_scope(scope)
    db.execute("BEGIN IMMEDIATE")
    try:
        for action in ACTIONS:
            tid=hashlib.sha256((scope+"\0"+action).encode()).hexdigest()
            db.execute("INSERT OR IGNORE INTO tasks(id,scope,action,state) VALUES(?,?,?,'ready')",(tid,scope,action))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return status(db,scope)

def claim(db,scope,worker,scores,now=None):
    validate_scope(scope)
    if worker not in registry():raise ValueError("UNKNOWN_AGENT")
    if not isinstance(scores,list) or len(scores)!=len(ACTIONS) or any(type(x) not in (int,float) or not -1e9<=x<=1e9 for x in scores):raise ValueError("INVALID_SCORES")
    now=int(time.time()) if now is None else now
    ranked=sorted(zip(ACTIONS,scores),key=lambda x:-x[1])
    db.execute("BEGIN IMMEDIATE")
    try:
        # Reclaim expired jobs; stale tokens can never finish a newer lease.
        db.execute("""UPDATE tasks SET state=CASE WHEN attempts>=? THEN 'failed' ELSE 'ready' END,
            worker=NULL,token=NULL,lease_until=NULL WHERE scope=? AND state='leased' AND lease_until<=?""",(MAX_ATTEMPTS,scope,now))
        # One active lease per identity in this scope.
        if db.execute("SELECT 1 FROM tasks WHERE scope=? AND worker=? AND state='leased'",(scope,worker)).fetchone():
            db.commit()
            return {"status":"AGENT_ALREADY_LEASED"}
        for action,score in ranked:
            row=db.execute("SELECT id,attempts FROM tasks WHERE scope=? AND action=? AND state='ready' AND attempts<?",(scope,action,MAX_ATTEMPTS)).fetchone()
            if row is None:continue
            token=secrets.token_hex(24)
            expires=now+LEASE_SECONDS
            db.execute("UPDATE tasks SET state='leased',worker=?,token=?,lease_until=?,attempts=attempts+1 WHERE id=?",(worker,token,expires,row["id"]))
            db.commit()
            return {"status":"LEASED","id":row["id"],"worker":worker,"action":action,"token":token,"leaseUntil":expires,"attempt":row["attempts"]+1}
        db.commit()
        return {"status":"NO_DISTINCT_READY_TASK"}
    except Exception:
        db.rollback()
        raise

def checked_receipt(row,receipt):
    if not isinstance(receipt,dict) or receipt.get("worker")!=row["worker"] or receipt.get("action")!=row["action"] or receipt.get("status")!="VERIFIED_LOCAL_ACTION" or receipt.get("externalAction") is not False or receipt.get("ownerSpend")!=0 or receipt.get("incomeInferred") is not False:
        raise ValueError("INVALID_RECEIPT")
    ev=receipt.get("evidence")
    if not isinstance(ev,dict):raise ValueError("MISSING_EVIDENCE")
    action=row["action"]
    def count(x):return type(x) is int and 0<=x<=300000
    def digest(x):return isinstance(x,str) and re.fullmatch(r"[0-9a-f]{64}",x) is not None
    if action in ACTIONS[:3]:
        if not count(ev.get("records")) or not digest(ev.get("sha256")):raise ValueError("INVALID_DATA_EVIDENCE")
        clean={"records":ev["records"],"sha256":ev["sha256"]}
        if action=="test-tabular":
            if ev.get("lossless") is not True:raise ValueError("INVALID_CONVERSION")
            clean["lossless"]=True
        else:
            if ev.get("findings")!=0:raise ValueError("AUDIT_FINDINGS")
            clean["findings"]=0
    else:
        if ev.get("exitCode")!=0 or not count(ev.get("outputBytes")) or not digest(ev.get("outputSha256")):raise ValueError("INVALID_TEST_EVIDENCE")
        clean={"exitCode":0,"outputBytes":ev["outputBytes"],"outputSha256":ev["outputSha256"]}
    return {"worker":row["worker"],"action":action,"status":"VERIFIED_LOCAL_ACTION","evidence":clean,"externalAction":False,"ownerSpend":0,"incomeInferred":False}

def finish(db,tid,worker,token,receipt=None,failed=False,now=None):
    now=int(time.time()) if now is None else now
    if worker not in registry():raise ValueError("UNKNOWN_AGENT")
    db.execute("BEGIN IMMEDIATE")
    try:
        row=db.execute("SELECT * FROM tasks WHERE id=?",(tid,)).fetchone()
        if row is None or row["state"]!="leased" or row["worker"]!=worker or row["token"]!=token or row["lease_until"]<=now:
            raise ValueError("STALE_OR_INVALID_LEASE")
        if failed:
            state="failed" if row["attempts"]>=MAX_ATTEMPTS else "ready"
            db.execute("UPDATE tasks SET state=?,worker=NULL,token=NULL,lease_until=NULL WHERE id=?",(state,tid))
        else:
            clean=checked_receipt(row,receipt)
            state="done"
            db.execute("UPDATE tasks SET state='done',token=NULL,lease_until=NULL,receipt=? WHERE id=?",(json.dumps(clean,separators=(",",":")),tid))
        db.commit()
        return {"status":state,"id":tid}
    except Exception:
        db.rollback()
        raise

def status(db,scope):
    validate_scope(scope)
    rows=db.execute("SELECT id,scope,action,state,attempts,worker,lease_until,receipt FROM tasks WHERE scope=? ORDER BY action",(scope,)).fetchall()
    return {"scope":scope,"tasks":[{**dict(r),"receipt":json.loads(r["receipt"]) if r["receipt"] else None} for r in rows]}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("database")
    parser.add_argument("operation",choices=["seed","claim","finish","fail","status"])
    args=parser.parse_args()
    raw=sys.stdin.read(100001)
    if len(raw)>100000:raise ValueError("INPUT_LIMIT")
    data=json.loads(raw or "{}")
    db=connect(args.database)
    try:
        op=args.operation
        if op=="seed":out=seed(db,data["scope"])
        elif op=="claim":out=claim(db,data["scope"],data["worker"],data["scores"])
        elif op=="status":out=status(db,data["scope"])
        else:out=finish(db,data["id"],data["worker"],data["token"],data.get("receipt"),op=="fail")
        print(json.dumps(out,separators=(",",":")))
    finally:db.close()

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("QUEUE_ERROR",type(e).__name__,str(e)[:160],file=sys.stderr)
        sys.exit(1)
