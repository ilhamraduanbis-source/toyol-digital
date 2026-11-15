#!/usr/bin/env python3
"""Offline evidence-first Markdown audit. Candidates are NOT verified findings."""
import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import tempfile
from collections import defaultdict
from pathlib import Path, PurePosixPath
import unittest

FIELDS = ["id","fact","file_a","line_a","quote_a","file_b","line_b","quote_b","why"]
COMMIT = re.compile(r"[0-9a-f]{40}")
# Conservative patterns: candidate generation only, never automatic conclusions.
FACT = re.compile(
    r"(?i)\b(?P<key>[A-Za-z][\w.-]*(?:\s+[A-Za-z][\w.-]*){0,3})"
    r"\s+(?P<relation>defaults? to|default is|expires after|is limited to|"
    r"must be|is always|is never|requires|does not require)\s+"
    r"(?P<value>[^.;\n]{1,100})"
)
TABLE = re.compile(r"^\s*\|\s*([^|]{1,100})\s*\|\s*([^|]{1,160})\s*\|")
LIMIT = 8_000_000

def git(repo, *args):
    return subprocess.check_output(
        ["git","-C",str(repo),*args], timeout=60,
        env={"PATH":"/usr/local/bin:/usr/bin:/bin","GIT_CONFIG_NOSYSTEM":"1",
             "GIT_CONFIG_GLOBAL":"/dev/null","GIT_TERMINAL_PROMPT":"0"},
    )

def read_corpus(repo, commit):
    if not COMMIT.fullmatch(commit):
        raise ValueError("full lowercase commit SHA required")
    if git(repo,"rev-parse","--verify",commit+"^{commit}").decode().strip()!=commit:
        raise ValueError("commit identity mismatch")
    entries=git(repo,"ls-tree","-rz",commit).split(b"\0")
    corpus={}; size=0
    for entry in entries:
        if not entry: continue
        meta,name=entry.split(b"\t",1)
        mode,kind,oid=meta.decode().split()
        path=name.decode("utf-8")
        if not path.endswith(".md"): continue
        if kind!="blob" or mode not in ("100644","100755"):
            continue
        p=PurePosixPath(path)
        if p.is_absolute() or ".." in p.parts or "\\" in path:
            raise ValueError("unsafe corpus path")
        raw=git(repo,"cat-file","blob",oid)
        size+=len(raw)
        if size>LIMIT or len(corpus)>=2000:
            raise ValueError("corpus exceeds bounded audit size")
        corpus[path]=raw.decode("utf-8",errors="strict").splitlines()
    if not corpus: raise ValueError("no Markdown files")
    return corpus

def normalized(s):
    return re.sub(r"\s+"," ",s.replace("**","").replace("\x60","").strip()).casefold()

def index_corpus(corpus):
    groups=defaultdict(list)
    for path,lines in sorted(corpus.items()):
        heading=""
        for n,line in enumerate(lines,1):
            if re.match(r"^#{1,6}\s+",line):
                heading=line.strip("# ").strip()
            plain=line.replace("**","").replace("\x60","")
            matches=[]
            for m in FACT.finditer(plain):
                key=normalized(m["key"])
                rel=normalized(m["relation"])
                if rel in ("default to","defaults to","default is"): rel="default"
                if rel in ("requires","does not require"):
                    value=rel+": "+normalized(m["value"]); rel="requirement"
                else: value=normalized(m["value"])
                matches.append((key+" | "+rel,value))
            t=TABLE.match(line)
            if t and not re.fullmatch(r"[:\s-]+",t[1]):
                key=normalized(t[1]); value=normalized(t[2])
                if key not in {"name","field","parameter","argument","type","limit","status","value","description"}:
                    matches.append(("table | "+key,value))
            for key,value in matches:
                if value:
                    groups[key].append({"file":path,"line":n,"text":line,"heading":heading,"value":value})
    return [{"key":k,"passages":v} for k,v in sorted(groups.items())
            if len({x["value"] for x in v})>1 and len(v)<=40]

def context(corpus,path,n,radius=4):
    lines=corpus[path]
    if n<1 or n>len(lines): raise ValueError("line outside file")
    return [{"line":i+1,"text":lines[i]} for i in range(max(0,n-1-radius),min(len(lines),n+radius))]

def validate(corpus, csv_text, minimum=1):
    reader=csv.DictReader(io.StringIO(csv_text,newline=""),strict=True)
    if reader.fieldnames!=FIELDS: raise ValueError("exact CSV header required")
    seen=set(); rows=[]
    for i,row in enumerate(reader,1):
        if set(row)!=set(FIELDS) or any(v is None for v in row.values()):
            raise ValueError(f"row {i}: invalid column count")
        if row["id"]!=str(i) or not row["fact"].strip() or not 1<=len(row["why"])<=300:
            raise ValueError(f"row {i}: invalid id/fact/why")
        for side in ("a","b"):
            path=row["file_"+side]; number=row["line_"+side]
            if not re.fullmatch(r"[1-9][0-9]*",number):
                raise ValueError(f"row {i}: invalid line")
            n=int(number); key=(path,n)
            if path not in corpus or n>len(corpus[path]) or key in seen:
                raise ValueError(f"row {i}: unknown or reused passage")
            seen.add(key)
            actual=corpus[path][n-1].strip()
            quote=row["quote_"+side].strip()
            if not quote or quote not in actual or not (15<=len(quote)<=300 or quote==actual and len(actual)<15):
                raise ValueError(f"row {i}: quote mismatch or length")
        rows.append(row)
    if len(rows)<minimum: raise ValueError("minimum findings not met")
    return {"rows":len(rows),"exact_quotes":"pass","unique_passages":"pass",
            "semantic_correctness":"REVIEW_REQUIRED","submission":"not performed","income_verified":False}

def write_json(path,obj):
    p=Path(path); p.parent.mkdir(parents=True,exist_ok=True)
    tmp=p.with_suffix(p.suffix+".tmp")
    tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    tmp.replace(p)

def fingerprint(corpus):
    return hashlib.sha256(json.dumps(corpus,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def cli():
    p=argparse.ArgumentParser(description=__doc__)
    sub=p.add_subparsers(dest="cmd",required=True)
    for command in ("scan","verify","context"):
        q=sub.add_parser(command); q.add_argument("--repo",required=True); q.add_argument("--commit",required=True)
        if command=="scan": q.add_argument("--out",required=True)
        elif command=="verify":
            q.add_argument("--csv",required=True); q.add_argument("--minimum",type=int,default=1)
            q.add_argument("--out",required=True)
        else:
            q.add_argument("--file",required=True); q.add_argument("--line",type=int,required=True)
    sub.add_parser("selftest")
    args=p.parse_args()
    if args.cmd=="selftest":
        suite=unittest.defaultTestLoader.loadTestsFromTestCase(AuditTests)
        raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())
    corpus=read_corpus(args.repo,args.commit)
    if args.cmd=="scan":
        candidates=index_corpus(corpus)
        write_json(args.out,{"commit":args.commit,"corpus_sha256":fingerprint(corpus),
                   "files":len(corpus),"candidate_groups":candidates,"status":"CANDIDATES_NOT_FINDINGS"})
    elif args.cmd=="verify":
        if not 1<=args.minimum<=10000: raise ValueError("invalid minimum")
        report=validate(corpus,Path(args.csv).read_text(encoding="utf-8"),args.minimum)
        write_json(args.out,{"commit":args.commit,"corpus_sha256":fingerprint(corpus),**report})
    else: print(json.dumps(context(corpus,args.file,args.line),ensure_ascii=False,indent=2))

class AuditTests(unittest.TestCase):
    def setUp(self):
        self.c={"a.md":["# Same API","| Token TTL | 60 seconds |","The token requires a signature."],
                "b.md":["# Same API","| Token TTL | 90 seconds |","The token does not require a signature."]}
    def csv(self,rows):
        out=io.StringIO(newline=""); w=csv.DictWriter(out,fieldnames=FIELDS); w.writeheader(); w.writerows(rows); return out.getvalue()
    def row(self):
        return dict(zip(FIELDS,["1","TTL","a.md","2",self.c["a.md"][1],"b.md","2",self.c["b.md"][1],"Same API TTL differs."]))
    def test_candidates(self):
        a=index_corpus(self.c); self.assertTrue(any("token ttl" in x["key"] for x in a))
    def test_verified_not_semantic(self):
        a=validate(self.c,self.csv([self.row()])); self.assertEqual(a["semantic_correctness"],"REVIEW_REQUIRED")
    def test_wrong_quote(self):
        r=self.row(); r["quote_b"]="fabricated exact text"
        with self.assertRaises(ValueError): validate(self.c,self.csv([r]))
    def test_duplicate(self):
        r=self.row(); s={**r,"id":"2"}
        with self.assertRaises(ValueError): validate(self.c,self.csv([r,s]))
    def test_wrong_line(self):
        r=self.row(); r["line_a"]="0"
        with self.assertRaises(ValueError): validate(self.c,self.csv([r]))
    def test_minimum(self):
        with self.assertRaises(ValueError): validate(self.c,self.csv([self.row()]),2)
    def test_untracked_file(self):
        r=self.row(); r["file_a"]="../outside.md"
        with self.assertRaises(ValueError): validate(self.c,self.csv([r]))
    def test_csv_quoting(self):
        r=self.row(); r["why"]='A, unlike B, says "60".'
        self.assertEqual(validate(self.c,self.csv([r]))["rows"],1)
    def test_context(self):
        self.assertEqual(context(self.c,"a.md",2,1)[0]["line"],1)
    def test_git_pin(self):
        with tempfile.TemporaryDirectory() as d:
            subprocess.run(["git","init","-q",d],check=True)
            Path(d,"a.md").write_text("Pinned source\n",encoding="utf-8")
            subprocess.run(["git","-C",d,"add","a.md"],check=True)
            subprocess.run(["git","-C",d,"-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","fixture"],check=True)
            sha=subprocess.check_output(["git","-C",d,"rev-parse","HEAD"]).decode().strip()
            Path(d,"a.md").write_text("Working tree changed\n",encoding="utf-8")
            self.assertEqual(read_corpus(d,sha)["a.md"],["Pinned source"])
            with self.assertRaises(ValueError): read_corpus(d,"HEAD")

if __name__=="__main__": cli()
