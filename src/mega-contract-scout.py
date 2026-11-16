"""Read-only public procurement discovery. Estimates are not earnings or awards."""
import datetime as dt
import json,math,pathlib,re,sys,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from decimal import Decimal,InvalidOperation

TARGET=Decimal("5000000")
NOW=dt.datetime.now(dt.timezone.utc)
TED="https://api.ted.europa.eu/v3/notices/search"
UK="https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages"
FX="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
RELEVANT=re.compile(r"software|information system|digital platform|data platform|cloud computing|information technology|IT services|digital transformation|application development|cybersecurity|artificial intelligence",re.I)
EXCLUDED=re.compile(r"\b(?:defen[cs]e|military|weapon|munition|surveillance|biometric|police|intelligence service|clinical equipment|medical equipment|construction works|hardware supply|staffing|recruitment)\b",re.I)
def fetch(url,payload=None):
    req=urllib.request.Request(url,data=json.dumps(payload).encode() if payload else None,headers={"User-Agent":"ToyolCivilSoftwareResearch/1.0","Accept":"application/json, application/xml","Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=25) as resp:
        raw=resp.read(8000001)
    if len(raw)>8000000:raise ValueError("RESPONSE_LIMIT")
    return raw
def flat(v):
    if isinstance(v,list):return [x for y in v for x in flat(y)]
    if isinstance(v,dict):return flat(v.get("eng") or next(iter(v.values()),None))
    return [str(v)] if v is not None else []
def single(v):
    vals=list(dict.fromkeys(flat(v)))
    return vals[0] if len(vals)==1 else None
def first(v):
    vals=flat(v);return vals[0] if vals else ""
def date(v):
    if not isinstance(v,str):return None
    try:
        x=dt.datetime.fromisoformat(v.replace("Z","+00:00"))
        if x.tzinfo is None:return None
        return x.astimezone(dt.timezone.utc)
    except ValueError:return None
def deadline(v):
    vals=flat(v)
    ds=[date(x) for x in vals]
    # Date-only fields cannot establish precise closing time; require source review.
    if not ds or any(x is None for x in ds):return None
    return min(ds)
def fx_rates():
    tree=ET.fromstring(fetch(FX))
    cubes=[e for e in tree.iter() if e.get("time")]
    if len(cubes)!=1:raise ValueError("FX_SCHEMA")
    day=dt.date.fromisoformat(cubes[0].get("time"))
    if not 0<=(NOW.date()-day).days<=7:raise ValueError("FX_STALE")
    rates={"EUR":Decimal(1)}
    for e in cubes[0]:
        if e.get("currency") and e.get("rate"):rates[e.get("currency")]=Decimal(e.get("rate"))
    if "USD" not in rates or any(not x.is_finite() or x<=0 for x in rates.values()):raise ValueError("FX_SCHEMA")
    return rates,day.isoformat()
def qualify(row,rates,fxday):
    title=row.get("title","")
    if not RELEVANT.search(title) or EXCLUDED.search(title):return None,"OUTSIDE_CIVIL_SOFTWARE_SCOPE"
    try:
        val=Decimal(str(row.get("value")))
        if not val.is_finite() or val<=0:raise ValueError()
        cur=row.get("currency")
        if cur=="USD":usd=val
        elif cur in rates and "USD" in rates:usd=val*rates["USD"]/rates[cur]
        else:return None,"CURRENCY_UNVERIFIED"
    except (InvalidOperation,ValueError,TypeError):return None,"VALUE_UNVERIFIED"
    if usd<TARGET:return None,"BELOW_5M_USD"
    d=row.get("deadline")
    if d is not None and d<=NOW:return None,"DEADLINE_PASSED"
    return {**row,"deadline":d.isoformat() if d else None,"value":str(val),"estimated_usd":str(usd.quantize(Decimal("0.01"))),"fx_date":fxday if cur!="USD" else None,"fx_source":FX if cur!="USD" else None,"status":"OPEN_DEADLINE_LEAD_REVIEW_ELIGIBILITY" if d else "DEADLINE_UNVERIFIED_REVIEW_ORIGINAL","award_verified":False,"eligible":False,"verified_income_usd":0},None
def ted():
    fields=["publication-number","notice-title","buyer-name","buyer-country","notice-type","estimated-value-proc","estimated-value-cur-proc","deadline-receipt-tender-date-lot"]
    since=(NOW-dt.timedelta(days=30)).strftime("%Y%m%d")
    rows=[];sources=[]
    for term in ("software development","digital transformation","information system"):
        q='FT~"'+term+'" AND publication-date>='+since+' AND notice-type=cn-standard AND estimated-value-proc>=3000000 SORT BY publication-date DESC'
        try:
            j=json.loads(fetch(TED,{"query":q,"fields":fields,"limit":50,"page":1,"scope":"ACTIVE","paginationMode":"PAGE_NUMBER","checkQuerySyntax":False}))
            if not isinstance(j.get("notices"),list) or j.get("timedOut"):raise ValueError("INCOMPLETE_SEARCH")
            sources.append({"term":term,"count":len(j["notices"]),"total":j.get("totalNoticeCount")})
            for n in j["notices"]:
                i=single(n.get("publication-number"))
                if not i or not re.fullmatch(r"\d+-\d{4}",i):continue
                # Never guess pairing of multiple procedure values/currencies.
                rows.append({"id":i,"source":"TED","title":first(n.get("notice-title")),"buyer":first(n.get("buyer-name")),"value":single(n.get("estimated-value-proc")),"currency":single(n.get("estimated-value-cur-proc")),"deadline":deadline(n.get("deadline-receipt-tender-date-lot")),"url":"https://ted.europa.eu/en/notice/-/detail/"+i})
        except Exception as e:sources.append({"term":term,"error":str(e)[:150]})
    return rows,sources
def uk():
    start=(NOW-dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")
    end=NOW.strftime("%Y-%m-%dT%H:%M:%S")
    url=UK+"?"+urllib.parse.urlencode({"updatedFrom":start,"updatedTo":end,"stages":"tender","limit":100})
    latest={};sources=[]
    for page in range(1,5):
        try:
            j=json.loads(fetch(url))
            releases=j.get("releases")
            if not isinstance(releases,list):raise ValueError("UK_SCHEMA")
            sources.append({"page":page,"count":len(releases)})
            for n in releases:
                i=n.get("ocid")
                if not isinstance(i,str) or not re.fullmatch(r"ocds-[a-zA-Z0-9-]{4,100}",i):continue
                old=latest.get(i)
                if old is None or str(n.get("date",""))>str(old.get("date","")):latest[i]=n
            next_url=(j.get("links") or {}).get("next")
            if not next_url:break
            url=urllib.parse.urljoin(UK,next_url)
            u=urllib.parse.urlsplit(url)
            if u.scheme!="https" or u.hostname!="www.find-tender.service.gov.uk" or u.path!="/api/1.0/ocdsReleasePackages" or u.username or u.password:raise ValueError("UNAPPROVED_PAGINATION")
        except Exception as e:sources.append({"page":page,"error":str(e)[:150]});break
    rows=[]
    for i,n in latest.items():
        t=n.get("tender") or {}
        if t.get("status")!="active" or "tender" not in n.get("tag",[]) and "tenderUpdate" not in n.get("tag",[]) and "tenderAmendment" not in n.get("tag",[]):continue
        v=t.get("value") or {}
        d=date((t.get("tenderPeriod") or {}).get("endDate"))
        rows.append({"id":i,"source":"UK Find a Tender","title":str(t.get("title") or ""),"buyer":str((n.get("buyer") or {}).get("name") or ""),"value":v.get("amount"),"currency":v.get("currency"),"deadline":d,"url":"https://www.find-tender.service.gov.uk/procurement/"+i})
    return rows,sources
def main():
    mode=sys.argv[1]
    if mode not in ("ted","uk"):raise ValueError("SCOUT_MODE")
    try:rates,fxday=fx_rates();fxerror=None
    except Exception as e:rates={};fxday=None;fxerror=str(e)[:150]
    rows,sources=(ted if mode=="ted" else uk)()
    seen=set();leads=[];rejects={}
    for row in rows:
        if row["id"] in seen:continue
        seen.add(row["id"])
        lead,reason=qualify(row,rates,fxday)
        if lead:leads.append(lead)
        else:rejects[reason]=rejects.get(reason,0)+1
    leads.sort(key=lambda x:(x["deadline"] is None,-Decimal(x["estimated_usd"])))
    result={"target_usd":5000000,"source":mode,"at":NOW.isoformat(),"sources":sources,"fx_error":fxerror,"inspected_unique":len(seen),"rejections":rejects,"leads":leads,"owner_spend":0,"bids_submitted":0,"verified_income_usd":0,"note":"Bounded sample, not exhaustive. Estimates are contract values, not personal earnings. Check latest notice/award, lots, eligibility, capacity, financial guarantees, subcontracting and actual payable scope before any bid."}
    pathlib.Path("out").mkdir(exist_ok=True)
    pathlib.Path("out/mega-contracts.json").write_text(json.dumps(result,indent=2)+"\n")
    print("MEGA_SCOUT",json.dumps({k:v for k,v in result.items() if k!="leads"}))
    for lead in leads:print("MEGA_LEAD",json.dumps(lead))
    if not any("count" in x for x in sources):raise SystemExit("ALL_SOURCE_REQUESTS_FAILED")
if __name__=="__main__":main()
