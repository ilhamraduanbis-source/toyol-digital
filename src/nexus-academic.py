"""NEXUS academic practice. Public, synthetic examples only; no thesis uploads."""
import argparse, datetime as dt, hashlib, json, os, pathlib, re, urllib.request, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
DIR=ROOT/"runner"/"nexus-academic"
CUR=DIR/"curriculum.json"
STATE=DIR/"progress.json"
OUT=ROOT/"out"/"nexus-academic"
def read(p):return json.loads(p.read_text(encoding="utf-8"))
def dump(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
def digest(s):return hashlib.sha256(s.encode()).hexdigest()
def audit(text):
    rules=[
      (r"\bdiperolehi\b","BM01","diperoleh","Semak bentuk pasif baku."),
      (r"\bianya\b","BM02","ia / kata nama asal / gugurkan","Elakkan bentuk ianya; pilih berdasarkan konteks."),
      (r"\bdi\s+(?:jalankan|hasilkan|bincangkan|nyatakan|peroleh)\b","BM03",None,"Imbuhan di- bagi kata kerja pasif ditulis rapat."),
      (r"\b(?:daripada|dari)\b","BM04",None,"Semak konteks: dari untuk tempat/arah/masa; daripada untuk sumber/perbandingan."),
      (r"\b(?:semua|sentiasa|tidak pernah|membuktikan|terbukti)\b","ARG01",None,"Semak kecukupan bukti dan skop dakwaan; bukan semestinya salah."),
      (r"\b(?:oleh itu|justeru|maka|kesimpulannya)\b","ARG02",None,"Semak sama ada premis menyokong inferens."),
      (r"\b(?:tiada kajian|kajian pertama|belum pernah dikaji)\b","LIT01",None,"Dakwaan kelompongan memerlukan carian terdokumen.")
    ]
    findings=[]
    for pattern,code,fix,why in rules:
        for m in re.finditer(pattern,text,re.I):
            findings.append({"rule":code,"span":m.group(),"position":m.start(),"suggestion":fix,"reason":why,"requires_context":True})
    return sorted(findings,key=lambda x:x["position"])
def metadata(doi):
    if not re.fullmatch(r"10\.\d{4,9}/[A-Za-z0-9./_():;-]+",doi):raise ValueError("invalid DOI syntax")
    url="https://api.crossref.org/works/"+doi
    req=urllib.request.Request(url,headers={"User-Agent":"NexusAcademic/1.0","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=15) as f:raw=f.read(500001)
    if len(raw)>500000:raise ValueError("response limit")
    m=json.loads(raw)["message"]
    if m.get("DOI","").lower()!=doi.lower():raise ValueError("DOI mismatch")
    return {"doi":m["DOI"],"title":(m.get("title") or [""])[0],"authors":[(" ".join([a.get("given",""),a.get("family","")])).strip() for a in m.get("author",[])][:20],"year":(m.get("published",{}).get("date-parts") or [[None]])[0][0],"source":url,"status":"METADATA_VERIFIED_ONLY","full_text_verified":False}
def source_probe(url):
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"NexusAcademic/1.0","Accept":"text/html, application/json"})
        with urllib.request.urlopen(req,timeout=12) as f:
            raw=f.read(200000)
            status=f.status
        # Availability only. Do not archive or republish third-party full text.
        return {"url":url,"status":"REACHABLE","http":status,"sample_bytes":len(raw),"full_text_reviewed":False}
    except Exception as e:return {"url":url,"status":"UNAVAILABLE","error":type(e).__name__,"full_text_reviewed":False}
def discover(query):
    url="https://api.crossref.org/works?"+urllib.parse.urlencode({"query.bibliographic":query,"rows":5,"filter":"type:journal-article","select":"DOI,title,author,published,URL,type"})
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"NexusAcademic/2.0","Accept":"application/json"})
        with urllib.request.urlopen(req,timeout=15) as f:raw=f.read(1000001)
        if len(raw)>1000000:raise ValueError("response limit")
        items=json.loads(raw)["message"]["items"]
        records=[]
        for i in items:
            doi=i.get("DOI","")
            if not re.fullmatch(r"10\.\d{4,9}/[^\s]+",doi):continue
            title=(i.get("title") or [""])[0]
            if not title:continue
            records.append({"doi":doi,"title":title[:350],"year":(i.get("published",{}).get("date-parts") or [[None]])[0][0],"url":"https://doi.org/"+doi,"status":"METADATA_CANDIDATE_RELEVANCE_AND_TEXT_UNVERIFIED"})
        return {"query":query,"source":url,"status":"METADATA_RETRIEVED","records":records}
    except Exception as e:return {"query":query,"source":url,"status":"UNAVAILABLE","error":type(e).__name__,"records":[]}
def practice_transfer(m,n):
    # Different examples across cycles; deterministic check evaluates real tool behavior, not scholarly expertise.
    bad="Dapatan ini diperolehi dari "+("dokumen" if n%2 else "kajian")+" dan ianya menunjukkan bahawa semua responden bersetuju."
    revised="Dapatan ini diperoleh daripada "+("dokumen" if n%2 else "kajian")+" dan menunjukkan persetujuan dalam kalangan responden yang diperiksa."
    before=audit(bad);after=audit(revised)
    return {"original":bad,"revision":revised,"before":before,"after":after,
      "test_pass":{"BM01","BM02","ARG01"}<={x["rule"] for x in before} and not {"BM01","BM02","ARG01"}&{x["rule"] for x in after},
      "limit":"Synthetic transfer check; no independent model reasoning or mastery claimed."}

def stam_reading(m,round_no):
    topics=m["topics"]
    focus=topics[(round_no-1)%len(topics)]
    result={"focus":focus,"reading_targets":m["reading"],"edition_status":"UNVERIFIED_STAM_2008","full_text_reviewed":False,
            "source_questions":["Apakah istilah Arab dan definisi asal?","Siapakah pengarang, apakah edisi dan lokasi teks?","Apakah contoh, batas dan kemungkinan perbezaan pendapat?"]}
    # For the first Nahu session, read a bounded public grammar guide and verify its actual subject headings.
    if m["id"]=="S106A":
        url="https://corpus.quran.com/documentation/grammar.jsp"
        try:
            from html.parser import HTMLParser
            class Text(HTMLParser):
                def __init__(self):super().__init__();self.parts=[];self.skip=0
                def handle_starttag(self,tag,attrs):
                    if tag in ("script","style"):self.skip+=1
                def handle_endtag(self,tag):
                    if tag in ("script","style") and self.skip:self.skip-=1
                def handle_data(self,data):
                    if not self.skip:self.parts.append(data)
            req=urllib.request.Request(url,headers={"User-Agent":"NexusAcademic/3.0"})
            with urllib.request.urlopen(req,timeout=15) as f:raw=f.read(400001)
            if len(raw)>400000:raise ValueError("response limit")
            parser=Text();parser.feed(raw.decode("utf-8",errors="replace"))
            txt=" ".join(" ".join(parser.parts).split()).casefold()
            terms=["subjects and objects","preposition phrases","the verb kāna","adjectives","possessives"]
            matched=[t for t in terms if t.casefold() in txt]
            result["source_reading"]={"url":url,"status":"GUIDE_SECTIONS_CHECKED" if len(matched)>=3 else "GUIDE_CONTENT_NOT_CONFIRMED","matched_headings":matched,"full_text_reviewed":False,
              "note":"The guide describes grammatical roles and case inflection; compare subjects/objects, genitive after prepositions, and kana constructions. No independent mastery inferred." if len(matched)>=3 else "Source headings not sufficiently matched; inspect manually."}
        except Exception as e:result["source_reading"]={"url":url,"status":"UNAVAILABLE","error":type(e).__name__}
    return result

def practice(m):
    # Original worked examples are a reference answer, not generated independent answers.
    check=m.get("checks") or {"alignment":["Masalah","Persoalan","Objektif","Kaedah","Batas"],
           "malay":["diperoleh","daripada"],
           "argument":["P1","P2","K:","contoh balas"],
           "primary":["teks asal","edisi","konteks"],
           "literature":["carian","korpus","jurang"],
           "prose":["korpus","sebab akibat"],
           "citation":["Crossref","halaman"],
           "empirical":["bias","persetujuan","analisis"],
           "induction":["korpus","generalisasi"],
           "integrity":["rujukan","ketidakpastian"],
           "viva":["persoalan","analisis","batas"],
           "synthesis":["dokumen","bukti","rujukan"]}[m["kind"]]
    worked=m["worked"]
    checks={c:c.casefold() in worked.casefold() for c in check}
    return {"exercise":m["exercise"],"reference_answer":worked,"checks":checks,"fixture_pass":all(checks.values()),"audit_before":audit(m["exercise"]),"audit_after":audit(worked),"evaluation":"Checks of reference fixture and rule engine only; not independent model mastery."}
def selftest(c):
    assert len(c["modules"])==49 and len({m["id"] for m in c["modules"]})==49
    stam=[m for m in c["modules"] if m.get("track")=="STAM"]
    assert len(stam)==13 and len({m["exam_code"] for m in stam})==10
    assert all(m.get("arabic") and len(m["topics"])>=5 and m["reading"] and m["checks"] for m in stam)
    assert all(m.get("query") for m in c["modules"])
    assert all(m["refs"] and all(k in c["sources"] for k in m["refs"]) for m in c["modules"])
    assert all(practice(m)["fixture_pass"] for m in c["modules"])
    assert {x["rule"] for x in audit("Ianya diperolehi dari sumber dan di jalankan.")}>={"BM01","BM02","BM03","BM04"}
    assert not any(x["rule"] in {"BM01","BM02","BM03"} for x in audit("Dapatan diperoleh daripada sumber dan dijalankan."))
    assert any(x["rule"]=="ARG01" for x in audit("Semua penduduk bersetuju."))
    assert any(x["rule"]=="LIT01" for x in audit("Ini kajian pertama."))
    assert not audit("Teks itu dibaca.")
    try: metadata("https://invalid.example")
    except ValueError:pass
    else:raise AssertionError("invalid DOI accepted")
    print("NEXUS_ACADEMIC_TESTS_OK; "+str(len(c["modules"]))+" module fixtures validated")
def cycle(c):
    state=read(STATE)
    old=state.get("sessions",[])
    n=len(old);m=c["modules"][n%len(c["modules"])]
    runid=os.environ.get("GITHUB_RUN_ID","local")
    if runid!="local" and any(s["run_id"]==runid for s in old):
        print("NEXUS_SESSION_ALREADY_RECORDED",runid);return
    refs=[source_probe(c["sources"][k]) for k in m["refs"]]
    literature=discover(m["query"])
    transfer=practice_transfer(m,n)
    assert transfer["test_pass"]
    anchor=None
    if not any(x.get("publication_anchor") for x in old):
        try:anchor={"metadata":metadata(c["publication_anchor"]["doi"]),"reading_note":c["publication_anchor"]["reading_note"],"review_status":c["publication_anchor"]["status"]}
        except Exception as e:anchor={"status":"METADATA_UNAVAILABLE","error":type(e).__name__}
    meta=None
    if m["kind"] in {"citation","literature","synthesis"}:
        try:meta=metadata("10.1136/bmj.n71")
        except Exception as e:meta={"status":"METADATA_UNAVAILABLE","error":type(e).__name__}
    result=practice(m)
    assert result["fixture_pass"]
    stam_result=stam_reading(m,n//len(c["modules"])+1) if m.get("track")=="STAM" else None
    r={"run_id":runid,"at":dt.datetime.now(dt.timezone.utc).isoformat(),"module":m["id"],"title":m["title"],
       "round":n//len(c["modules"])+1,"lesson":m["principle"],"references":refs,"metadata_exercise":meta,
       "practice":result,"stam":stam_result,"literature":literature,"transfer":transfer,"publication_anchor":anchor,"status":"REFERENCE_PRACTICE_COMPLETED","mastery_verified":False,
       "curriculum_sha256":digest(CUR.read_text()),"owner_spend":0,"private_data":False}
    dump(OUT/"session.json",r)
    old.append({"run_id":runid,"at":r["at"],"module":m["id"],"title":m["title"],"round":r["round"],"status":r["status"],"fixture_pass":True,"sources_reachable":sum(x["status"]=="REACHABLE" for x in refs),"sources_total":len(refs),"mastery_verified":False,"literature":literature,"transfer_test_pass":transfer["test_pass"],"stam":stam_result,"publication_anchor":anchor if anchor and anchor.get("metadata") else None})
    state["sessions"]=old
    state["next_module"]=c["modules"][len(old)%len(c["modules"])]["id"]
    dump(STATE,state)
    report=["# NEXUS — Rekod latihan akademik","", "Status: latihan rujukan selesai, penguasaan bebas belum dinilai.","", "**Modul:** "+m["title"],"",m["principle"],"","## Latihan",m["exercise"],"","## Contoh jawapan rujukan",m["worked"],"","## Bukti","Latihan rujukan lulus semakan berstruktur: "+str(sum(result["checks"].values()))+"/"+str(len(result["checks"]))+".","Sumber dapat dicapai: "+str(sum(x["status"]=="REACHABLE" for x in refs))+"/"+str(len(refs))+". Capaian bukan bukti teks penuh telah diperiksa.","","## Seterusnya",state["next_module"],"","Tiada data PhD peribadi. Tiada latihan berat model atau tuntutan penguasaan bebas."]
    (OUT/"report.md").write_text("\n".join(report)+"\n",encoding="utf-8")
    if stam_result:
        report.extend(["","## Pengajian STAM","Fokus: "+stam_result["focus"],"Rujukan tambahan (edisi sukatan 2008 belum disahkan):"]+["- "+x for x in stam_result["reading_targets"]])
        if stam_result.get("source_reading"):report.append("Semakan sumber Arab: "+stam_result["source_reading"]["status"])
    if literature["records"]:
        report.extend(["","## Rujukan baharu untuk saringan"]+["- "+x["title"]+" — "+x["url"] for x in literature["records"]])
    report.extend(["","Metadata bukan bacaan teks penuh. Saringan relevansi, akses teks, kaedah dan dapatan diperlukan."])
    if anchor and anchor.get("metadata"):report.extend(["","## Kajian rujukan awal",anchor["reading_note"],"DOI: "+anchor["metadata"]["doi"]])
    (OUT/"report.md").write_text("\n".join(report)+"\n",encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:f.write("\n".join(report)+"\n")
    print("NEXUS_ACADEMIC_SESSION",json.dumps({k:r[k] for k in ("module","title","round","status","mastery_verified")},ensure_ascii=False))
def main():
    p=argparse.ArgumentParser();p.add_argument("--test",action="store_true");p.add_argument("--audit",type=pathlib.Path);p.add_argument("--doi");p.add_argument("--cycle",action="store_true");a=p.parse_args();c=read(CUR)
    if a.audit:
        # Local use only. Do not put real manuscripts in public repository or Actions.
        print(json.dumps(audit(a.audit.read_text(encoding="utf-8")),ensure_ascii=False,indent=2));return
    if a.doi:print(json.dumps(metadata(a.doi),ensure_ascii=False,indent=2));return
    selftest(c)
    if a.cycle:cycle(c)
if __name__=="__main__":main()
