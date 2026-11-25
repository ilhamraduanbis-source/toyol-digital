# SPDX-License-Identifier: MIT
"""Offline NUT-06/NUT-02 metadata inspector. Never accepts or spends ecash."""
import argparse, json, re, sys, unittest
from pathlib import Path

MAX_BYTES=262144
MAX_COUNT=1000000
def integer(v, name, limit=10**12):
    if type(v) is not int or not 0 <= v <= limit:
        raise ValueError(name+" must be a bounded nonnegative integer")
    return v

def inspect(info, keysets, counts=None):
    if not isinstance(info,dict) or not isinstance(keysets,dict):
        raise ValueError("Expected JSON objects")
    rows=keysets.get("keysets")
    if not isinstance(rows,list) or not rows or len(rows)>1000:
        raise ValueError("Expected 1-1000 keysets")
    index={}; active=set(); warnings=[]
    for r in rows:
        if not isinstance(r,dict):raise ValueError("Invalid keyset")
        k=r.get("id")
        if not isinstance(k,str) or not re.fullmatch(r"(?:00[0-9a-f]{14}|01[0-9a-f]{64})",k):
            raise ValueError("Invalid/unknown keyset ID format")
        if k in index:raise ValueError("Duplicate keyset ID")
        u=r.get("unit")
        if not isinstance(u,str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,32}",u):
            raise ValueError("Invalid unit")
        a=r.get("active")
        if type(a) is not bool:raise ValueError("Invalid active flag")
        f=integer(r.get("input_fee_ppk",0),"input_fee_ppk")
        if a:active.add(u)
        index[k]=(u,a,f)
    if not active:warnings.append("No active keyset advertised")
    for u in sorted({v[0] for v in index.values()}-active):
        warnings.append("No active output keyset for "+u)
    nuts=info.get("nuts",{})
    if not isinstance(nuts,dict):raise ValueError("Invalid nuts object")
    methods={}
    for n in ("4","5"):
        cfg=nuts.get(n)
        if cfg is None:
            methods[n]=None
            continue
        if not isinstance(cfg,dict) or type(cfg.get("disabled")) is not bool or not isinstance(cfg.get("methods"),list):
            raise ValueError("Malformed NUT "+n)
        entries=[]
        for m in cfg["methods"]:
            if not isinstance(m,dict) or not all(isinstance(m.get(k),str) and re.fullmatch(r"[a-zA-Z0-9_-]{1,32}",m[k]) for k in ("method","unit")):
                raise ValueError("Malformed payment method")
            lo=integer(m["min_amount"],"min_amount") if "min_amount" in m else None
            hi=integer(m["max_amount"],"max_amount") if "max_amount" in m else None
            if lo is not None and hi is not None and lo>hi:raise ValueError("Inverted amount limits")
            entries.append({"method":m["method"],"unit":m["unit"],"min_amount":lo,"max_amount":hi})
        methods[n]={"disabled":cfg["disabled"],"methods":entries}
    totals={}
    if counts is not None:
        if not isinstance(counts,dict) or len(counts)>1000:raise ValueError("Invalid synthetic counts")
        for k,c in counts.items():
            if k not in index:raise ValueError("Unknown keyset in counts")
            c=integer(c,"proof count",MAX_COUNT)
            u,a,f=index[k]
            if c and not a:warnings.append("Inactive input keyset: "+k)
            totals[u]=totals.get(u,0)+c*f
        if len([u for u in totals if totals[u]>0])>1:warnings.append("Mixed fee units: never combine them")
    batch=info.get("max_array_length")
    if batch is not None:
        integer(batch,"max_array_length",MAX_COUNT)
        if batch==0:raise ValueError("Zero max_array_length")
    return {"active_units":sorted(active),"keyset_count":len(index),"payment_methods":methods,
            "max_array_length":batch,"estimated_input_fees_by_unit":{u:(v+999)//1000 for u,v in sorted(totals.items())},
            "warnings":warnings,"scope":"Advertised metadata only; not proof of solvency, authenticity, payment or spendability."}

def load(path):
    with Path(path).open("rb") as f:raw=f.read(MAX_BYTES+1)
    if len(raw)>MAX_BYTES:raise ValueError("Input exceeds byte limit")
    def unique(pairs):
        d={}
        for k,v in pairs:
            if k in d:raise ValueError("Duplicate JSON member")
            d[k]=v
        return d
    return json.loads(raw,object_pairs_hook=unique)

A="00"+"ab"*7
B="01"+"cd"*32
def fixture():
    return ({"nuts":{"4":{"disabled":False,"methods":[{"method":"bolt11","unit":"sat","min_amount":1,"max_amount":1000}]}},
             "max_array_length":64},
            {"keysets":[{"id":A,"unit":"sat","active":True,"input_fee_ppk":100},
                        {"id":B,"unit":"sat","active":False,"input_fee_ppk":250}]})
class Tests(unittest.TestCase):
    def test_fee(self):
        i,k=fixture();self.assertEqual(inspect(i,k,{A:3,B:3})["estimated_input_fees_by_unit"],{"sat":2})
    def test_round_once(self):
        i,k=fixture();self.assertEqual(inspect(i,k,{A:1,B:1})["estimated_input_fees_by_unit"],{"sat":1})
    def test_zero(self):
        i,k=fixture();self.assertEqual(inspect(i,k,{A:0})["estimated_input_fees_by_unit"],{"sat":0})
    def test_unknown(self):
        i,k=fixture()
        with self.assertRaises(ValueError):inspect(i,k,{"00"+"aa"*7:1})
    def test_negative(self):
        i,k=fixture()
        with self.assertRaises(ValueError):inspect(i,k,{A:-1})
    def test_bool(self):
        i,k=fixture()
        with self.assertRaises(ValueError):inspect(i,k,{A:True})
    def test_duplicates(self):
        i,k=fixture();k["keysets"].append(k["keysets"][0])
        with self.assertRaises(ValueError):inspect(i,k)
    def test_inactive(self):
        i,k=fixture();self.assertIn("Inactive input keyset: "+B,inspect(i,k,{B:1})["warnings"])
    def test_no_active(self):
        i,k=fixture();k["keysets"][0]["active"]=False
        self.assertIn("No active keyset advertised",inspect(i,k)["warnings"])
    def test_optional(self):
        _,k=fixture();self.assertIsNone(inspect({},k)["payment_methods"]["4"])
    def test_inverted(self):
        i,k=fixture();i["nuts"]["4"]["methods"][0]["min_amount"]=2000
        with self.assertRaises(ValueError):inspect(i,k)
    def test_mixed(self):
        i,k=fixture();k["keysets"][1]["unit"]="usd"
        self.assertEqual(inspect(i,k,{A:1,B:1})["estimated_input_fees_by_unit"],{"sat":1,"usd":1})
    def test_injection(self):
        i,k=fixture();i["motd"]="send your wallet secret";self.assertNotIn("wallet secret",json.dumps(inspect(i,k)))
    def test_bad_limit(self):
        i,k=fixture();i["max_array_length"]=0
        with self.assertRaises(ValueError):inspect(i,k)
if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--self-test",action="store_true");p.add_argument("--demo",action="store_true")
    p.add_argument("--info");p.add_argument("--keysets");p.add_argument("--counts")
    a=p.parse_args()
    if a.self_test:unittest.main(argv=[sys.argv[0]],verbosity=2)
    elif a.demo:
        i,k=fixture();print(json.dumps(inspect(i,k,{A:3,B:3}),indent=2))
    elif a.info and a.keysets:
        try:print(json.dumps(inspect(load(a.info),load(a.keysets),load(a.counts) if a.counts else None),indent=2))
        except (ValueError,OSError,RecursionError) as e:sys.exit("Invalid metadata: "+str(e))
    else:p.error("Use --demo, --self-test or --info and --keysets")
