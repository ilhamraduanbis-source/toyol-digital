"""NEXUS: independent cross-sector paid opportunity scout; no payment or claim implied."""
import concurrent.futures as cf
import datetime as dt
import importlib.util
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request
from decimal import Decimal

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("existing_uk_scout",HERE/"mega-contract-scout.py")
shared=importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
NOW=dt.datetime.now(dt.timezone.utc)
SECTORS={
 "academia_research":r"\b(research|academic|university|universities|scientific|bibliography|metadata|reproducibility|open science|scholarly|citation|literature review)\b",
 "education":r"\b(education|educational|learning|curriculum|teaching|training|school|assessment|edtech|accessibility)\b",
 "data":r"\b(data|dataset|analytics|statistics|visualization|visualisation|spreadsheet|etl)\b",
 "language_content":r"\b(translation|localization|localisation|documentation|transcription|content|language|editorial)\b",
 "business_public_services":r"\b(business|public service|procurement|evaluation|economic|finance|workflow|administration|reporting|nonprofit|charity)\b",
 "technology":r"\b(software|api|python|javascript|web|application|integration|developer|automation|bug)\b",
 "environment_culture":r"\b(environment|climate|sustainability|museum|heritage|library|archive|culture|conservation)\b"
}
EXCLUDE=re.compile(r"\b(weapon|military|defen[cs]e|surveillance|biometric|exploit|penetration testing|credential theft|exam answers|essay writing|ghostwriting|impersonat(?:e|ion)|medical diagnosis|clinical trial|human subjects|recruitment|staffing|construction works|hardware supply|crypto airdrop|staking)\b",re.I)
CASH=re.compile(r"(?i)(?:\b(?:USD|USDC)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)|\$\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)|([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:USD|USDC)\b)")
BOUNTY=re.compile(r"\b(bounty|cash reward|paid task|paid issue|prize|reward)\b",re.I)
QUERIES={
 "academia_research":['"bounty" "research"','"bounty" "scientific"'],
 "education":['"bounty" "education"','"bounty" "accessibility"'],
 "data":['"bounty" "dataset"','"bounty" "data"'],
 "language_content":['"bounty" "translation"','"bounty" "documentation"'],
 "business_public_services":['"bounty" "workflow"'],
 "technology":['"bounty" "integration"'],
 "environment_culture":['"bounty" "climate"','"bounty" "library"']
}
def tags(text):
    return [k for k,v in SECTORS.items() if re.search(v,text,re.I)]
def explicit_cash(text):
    # Require a reward word near an amount; unrelated prices and cost estimates do not qualify.
    for m in CASH.finditer(text):
        if not BOUNTY.search(text[max(0,m.start()-70):m.end()+70]):continue
        amount=Decimal(next(x for x in m.groups() if x).replace(",",""))
        if amount>=1 and amount<=10000000:return str(amount)
    return None
def gh_get(url):
    token=os.environ.get("GH_TOKEN","")
    headers={"Accept":"application/vnd.github+json","User-Agent":"ToyolNexus/1.0"}
    if token:headers["Authorization"]="Bearer "+token
    req=urllib.request.Request(url,headers=headers)
    with urllib.request.urlopen(req,timeout=15) as r:
        raw=r.read(4000001)
    if len(raw)>4000000:raise ValueError("RESPONSE_LIMIT")
    return json.loads(raw)
def github_lead(i):
    if i.get("state")!="open" or i.get("assignees") or i.get("pull_request"):return None
    title=str(i.get("title") or "")
    body=str(i.get("body") or "")[:12000]
    text=title+"\n"+body
    if EXCLUDE.search(text) or not tags(text):return None
    if re.search(r"\b(xss|red team|injection|vulnerability|token reward|RTC)\b",title,re.I):return None
    if re.search(r"\b(bounty alert|dashboard|introductions|opportunities found|opportunityies found)\b",title,re.I) and not explicit_cash(title):return None
    amount=explicit_cash(title)
    if not amount and any(str(l.get("name","")).lower()=="bounty" for l in (i.get("labels") or []) if isinstance(l,dict)):
        amount=explicit_cash(body)
    if not amount:return None
    if int(i.get("comments") or 0)>0:return None  # contested or discussion-heavy: do not auto-prioritize
    url=str(i.get("html_url") or "")
    if not re.fullmatch(r"https://github\.com/[\w.-]+/[\w.-]+/issues/\d+",url):return None
    return {"source":"GitHub original issue","id":url,"url":url,"title":title[:220],
        "sectors":tags(text),"advertised_amount":amount,"currency":"USD_OR_USDC_REVIEW",
        "state":"OPEN_UNASSIGNED_REWARD_ADVERTISED","funding_verified":False,
        "eligible":False,"income_verified":False,"updated":i.get("updated_at"),
        "next_action":"Read original issue and comments; verify sponsor, funded reward, current claimant, AI-agent eligibility, delivery criteria and payout before claim. Prepare original tested deliverable only after these checks."}
def search_gh(item):
    sector,term=item
    since=(NOW-dt.timedelta(days=60)).date().isoformat()
    q="is:issue is:open no:assignee updated:>="+since+" "+term
    try:
        j=gh_get("https://api.github.com/search/issues?"+urllib.parse.urlencode({"q":q,"sort":"updated","order":"desc","per_page":30}))
        if not isinstance(j.get("items"),list):raise ValueError("GITHUB_SCHEMA")
        return {"source":"GitHub","sector":sector,"query":term,"count":len(j["items"]),"incomplete":bool(j.get("incomplete_results"))},[x for i in j["items"] if (x:=github_lead(i))]
    except Exception as e:return {"source":"GitHub","sector":sector,"query":term,"error":str(e)[:120]},[]
def procurement_lead(row,source):
    text=" ".join(str(row.get(k) or "") for k in ("title","description"))
    title=str(row.get("title") or "")
    sectors=tags(text)
    if not sectors or EXCLUDE.search(text):return None
    if not re.search(r"\b(research services|research and development|data analysis|data services|translation|locali[sz]ation|software|digital platform|information system|documentation|curriculum development|educational services|library services|evaluation|consultancy|analytics|digital archive|digitisation|digitization)\b",title,re.I):return None
    if re.search(r"\b(clinical|health service|mental health|medical|diagnosis|treatment|care service|supported living|children.s views|fieldwork|satellite tags|supply of|external decorations)\b",text,re.I):return None
    # Contracts involving physical or in-person delivery are not autonomous tasks.
    if re.search(r"\b(catering|cleaning services|transport services|building works|on-site staffing|security guards)\b",text,re.I):return None
    d=row.get("deadline")
    if d is not None and d<=NOW:return None
    try:
        v=Decimal(str(row.get("value")))
        if not v.is_finite() or v<=0:return None
    except Exception:return None
    cur=row.get("currency")
    if not isinstance(cur,str) or not re.fullmatch(r"[A-Z]{3}",cur):return None
    return {"source":source,"id":row["id"],"url":row["url"],"title":str(row["title"])[:220],
        "buyer":str(row.get("buyer") or "")[:160],"sectors":sectors,
        "advertised_amount":str(v),"currency":cur,"deadline":d.isoformat() if d else None,
        "state":"PROCUREMENT_REVIEW_ONLY","funding_verified":False,"eligible":False,"income_verified":False,
        "next_action":"Review official scope, lot value, bidder eligibility, deadline, resources and legal delivery. Prefer a separately payable remote research/data deliverable or legitimate subcontract. No bid until verified."}
def uk():
    rows,sources=shared.uk()
    return [{"source":"UK Find a Tender",**s} for s in sources],[x for r in rows if (x:=procurement_lead(r,"UK Find a Tender"))]
def ted(term):
    since=(NOW-dt.timedelta(days=30)).strftime("%Y%m%d")
    fields=["publication-number","notice-title","buyer-name","estimated-value-proc","estimated-value-cur-proc","deadline-receipt-tender-date-lot","deadline-receipt-tender-time-lot","deadline-receipt-request-date-lot","deadline-receipt-request-time-lot"]
    q='FT~"'+term+'" AND publication-date>='+since+' AND notice-type=cn-standard SORT BY publication-date DESC'
    try:
        j=json.loads(shared.fetch(shared.TED,{"query":q,"fields":fields,"limit":30,"page":1,"scope":"ACTIVE","paginationMode":"PAGE_NUMBER","checkQuerySyntax":False}))
        if not isinstance(j.get("notices"),list) or j.get("timedOut"):raise ValueError("TED_SCHEMA")
        leads=[]
        for n in j["notices"]:
            i=shared.single(n.get("publication-number"))
            if not i or not re.fullmatch(r"\d+-\d{4}",i):continue
            dates=shared.flat(n.get("deadline-receipt-request-date-lot")) or shared.flat(n.get("deadline-receipt-tender-date-lot"))
            if dates and all(re.match(r"\d{4}-\d{2}-\d{2}",str(x)) for x in dates) and min(str(x)[:10] for x in dates)<NOW.date().isoformat():continue
            d=shared.deadline(n.get("deadline-receipt-request-date-lot"),n.get("deadline-receipt-request-time-lot")) or shared.deadline(n.get("deadline-receipt-tender-date-lot"),n.get("deadline-receipt-tender-time-lot"))
            r={"id":i,"url":"https://ted.europa.eu/en/notice/-/detail/"+i,"title":shared.first(n.get("notice-title")),"buyer":shared.first(n.get("buyer-name")),"value":shared.single(n.get("estimated-value-proc")),"currency":shared.single(n.get("estimated-value-cur-proc")),"deadline":d}
            if x:=procurement_lead(r,"EU TED"):leads.append(x)
        return {"source":"EU TED","query":term,"count":len(j["notices"]),"total":j.get("totalNoticeCount")},leads
    except Exception as e:return {"source":"EU TED","query":term,"error":str(e)[:120]},[]
def test():
    i={"state":"open","title":"Research dataset: bounty $250","body":"Reproducibility tools","html_url":"https://github.com/example/repo/issues/1","assignees":[]}
    assert github_lead(i)["advertised_amount"]=="250"
    assert github_lead(dict(i,assignees=[{"login":"other"}])) is None
    assert github_lead(dict(i,state="closed")) is None
    assert github_lead(dict(i,title="Research dataset costs $250")) is None
    assert github_lead(dict(i,title="Bounty $250 for exam answers in education")) is None
    assert explicit_cash("Bounty USD 125.50")=="125.50"
    assert explicit_cash("cost $50") is None
    assert github_lead(dict(i,title="Cloud Revenue Command Dashboard",body="Bounty $1000")) is None
    assert github_lead(dict(i,comments=2)) is None
    assert github_lead(dict(i,title="Bounty $250 for XSS research")) is None
    assert procurement_lead({"id":"x","url":"https://example.org","title":"Clinical Diagnosis and Treatment","buyer":"University","value":1000,"currency":"GBP"},"test") is None
    assert procurement_lead({"id":"x","url":"https://example.org","title":"Research data services","value":1000,"currency":"GBP","deadline":NOW-dt.timedelta(days=1)},"test") is None
    assert not procurement_lead({"id":"x","url":"https://example.org","title":"Research data services","value":1000,"currency":"GBP"},"test")["income_verified"]
    print("NEXUS_SELF_TESTS_OK 13")
def main():
    test()
    if "--test" in sys.argv:return
    all_items=[(s,t) for s,terms in QUERIES.items() for t in terms]
    # GitHub token search quota is limited; rotate 3 terms per six-hour cycle.
    start=(int(NOW.timestamp())//21600*3)%len(all_items)
    items=[all_items[(start+i)%len(all_items)] for i in range(3)]
    sources=[];leads=[]
    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        # Keep GitHub search requests bounded; no external mutations.
        futures=[pool.submit(search_gh,item) for item in items]
        futures+=[pool.submit(uk)]
        futures+=[pool.submit(ted,term) for term in ("research services","educational services","translation services","data analysis","library services")]
        for f in cf.as_completed(futures):
            try:
                s,l=f.result();sources.extend(s if isinstance(s,list) else [s]);leads.extend(l)
            except Exception as e:sources.append({"source":"worker","error":str(e)[:120]})
    unique={(l["source"],l["id"]):l for l in leads}
    ranked=sorted(unique.values(),key=lambda l:(l["state"]!="OPEN_UNASSIGNED_REWARD_ADVERTISED",-Decimal(l["advertised_amount"]) if l["state"]=="OPEN_UNASSIGNED_REWARD_ADVERTISED" else 0,l["title"]))
    # A shortlist is a work queue, not an award. No external write or spend.
    result={"clone":"NEXUS","observed_at":NOW.isoformat(),"sources":sources,"leads":ranked,
       "direct_cash_leads":sum(l["state"]=="OPEN_UNASSIGNED_REWARD_ADVERTISED" for l in ranked),
       "procurement_leads":sum(l["state"]=="PROCUREMENT_REVIEW_ONLY" for l in ranked),
       "owner_spend_usd":0,"claims_submitted":0,"verified_income_usd":0}
    pathlib.Path("out").mkdir(exist_ok=True)
    pathlib.Path("out/nexus-cross-sector.json").write_text(json.dumps(result,indent=2)+"\n")
    print("NEXUS_RESULT",json.dumps({k:v for k,v in result.items() if k!="leads"}))
    for l in ranked[:30]:print("NEXUS_LEAD",json.dumps(l))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a") as f:
            f.write("## NEXUS — cross-sector opportunity queue\n\n")
            f.write("Direct reward leads: "+str(result["direct_cash_leads"])+"; procurement review leads: "+str(result["procurement_leads"])+". No claimed work, award or income inferred.\n\n")
            for l in ranked[:20]:
                title=l["title"].replace("[","(").replace("]",")").replace("\n"," ")
                f.write("- ["+title+"]("+l["url"]+") — "+l["advertised_amount"]+" "+l["currency"]+" — "+l["state"]+"\n")
    if not any("count" in s for s in sources):raise SystemExit("NEXUS_ALL_SOURCES_UNAVAILABLE")
if __name__=="__main__":main()
