#!/usr/bin/env python3
"""Public Federal Register metadata collector. Preparation only, not a formal timed pull."""
import argparse, datetime as dt, hashlib, json, pathlib, time, urllib.parse, urllib.request

BASE = "https://www.federalregister.gov/api/v1/documents.json"
AGENCIES = ("consumer-financial-protection-bureau", "federal-deposit-insurance-corporation",
            "comptroller-of-the-currency", "federal-reserve-system",
            "national-credit-union-administration", "financial-crimes-enforcement-network")
FIELDS = ("document_number", "title", "publication_date", "agencies", "html_url",
          "comments_close_on", "regulation_id_numbers", "docket_ids")

def fetch(params, evidence):
    url = BASE + "?" + urllib.parse.urlencode(params)
    for attempt in (1, 2):
        entry = {"url": url, "attempt": attempt,
                 "utc": dt.datetime.now(dt.timezone.utc).isoformat()}
        try:
            req = urllib.request.Request(url, headers={"User-Agent":"ToyolDigital public-data research/1.0",
                                                      "Accept":"application/json"})
            with urllib.request.urlopen(req, timeout=25) as r:
                if urllib.parse.urlparse(r.geturl()).hostname != "www.federalregister.gov":
                    raise ValueError("unexpected redirect")
                entry["date_header"] = r.headers.get("Date")
                data = r.read(12_000_001)
                if len(data)>12_000_000:
                    raise ValueError("response too large")
                j=json.loads(data)
            if not isinstance(j.get("results"),list) or not isinstance(j.get("count"),int):
                raise ValueError("unexpected response schema")
            entry.update(count=j["count"], page_rows=len(j["results"]),
                         response_sha256=hashlib.sha256(data).hexdigest())
            evidence.append(entry)
            return j
        except Exception as exc:
            entry["error"]=str(exc)[:400]; evidence.append(entry)
            if attempt==1: time.sleep(1)
    return None

def paged(params, evidence, sample=False):
    rows=[]; count=None; page=1
    while True:
        j=fetch(params+[("per_page",1 if sample else 100),("page",page)],evidence)
        if j is None: return rows, count, False
        if count is None: count=j["count"]
        elif count!=j["count"]: return rows,count,False
        rows.extend(j["results"])
        if sample: return rows,count,True
        if len(rows)==count: return rows,count,True
        if not j["results"] or len(rows)>count or page>=1000: return rows,count,False
        page+=1
        time.sleep(.2)

def collect(sample=False):
    evidence=[]; proposals={}; counts={}; errors=[]
    for agency in AGENCIES:
        params=[("conditions[type][]","PRORULE"),("conditions[agencies][]",agency),
                ("conditions[publication_date][gte]","2025-01-01"),
                ("conditions[publication_date][lte]","2026-10-31")]+[("fields[]",f) for f in FIELDS]
        rows,count,complete=paged(params,evidence,sample)
        counts[agency]={"reported":count,"retrieved":len(rows),"complete":complete}
        if not complete: errors.append(agency)
        for row in rows:
            key=row.get("document_number")
            if not key: errors.append("missing document_number"); continue
            if key in proposals and proposals[key]["record"]!=row:
                errors.append("inconsistent duplicate "+key)
            item=proposals.setdefault(key,{"record":row,"agency_queries":[]})
            item["agency_queries"].append(agency)
    rins=sorted({rin for x in proposals.values() for rin in (x["record"].get("regulation_id_numbers") or [])})
    finals={}
    if not sample:
        for rin in rins:
            p=[("conditions[regulation_id_number]",rin),("conditions[type][]","RULE")]
            p.extend(("fields[]",f) for f in ("document_number","type","publication_date"))
            rows,count,complete=paged(p,evidence)
            finals[rin]={"rows":rows,"reported":count,"complete":complete}
            if not complete: errors.append("RIN "+rin)
    return {"mode":"PREPARATION_SAMPLE" if sample else "METADATA_ONLY_NOT_A_DELIVERY",
            "agency_counts":counts,"unique_records":len(proposals),"proposals":proposals,
            "rins":rins,"final_rules_by_rin":finals,"request_evidence":evidence,"errors":errors,
            "limitation":"CFR parts, covered entities, text-derived dates, formal award timing and final report require separate verified steps."}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--sample",action="store_true")
    p.add_argument("--out",required=True)
    a=p.parse_args()
    result=collect(a.sample)
    path=pathlib.Path(a.out);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({"mode":result["mode"],"agency_counts":result["agency_counts"],
                      "unique_records":result["unique_records"],"errors":result["errors"],
                      "evidence_requests":len(result["request_evidence"])},ensure_ascii=False))
