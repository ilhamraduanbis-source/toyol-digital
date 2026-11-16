"""NEXUS academic practice. Public, synthetic examples only; no thesis uploads."""
import argparse, datetime as dt, hashlib, json, os, pathlib, re, urllib.request
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
def practice(m):
    # Original worked examples are a reference answer, not generated independent answers.
    check={"alignment":["Masalah","Persoalan","Objektif","Kaedah","Batas"],
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
    assert len(c["modules"])==12 and len({m["id"] for m in c["modules"]})==12
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
    print("NEXUS_ACADEMIC_TESTS_OK 9; 12 module fixtures validated")
def cycle(c):
    state=read(STATE)
    old=state.get("sessions",[])
    n=len(old);m=c["modules"][n%len(c["modules"])]
    runid=os.environ.get("GITHUB_RUN_ID","local")
    if runid!="local" and any(s["run_id"]==runid for s in old):
        print("NEXUS_SESSION_ALREADY_RECORDED",runid);return
    refs=[source_probe(c["sources"][k]) for k in m["refs"]]
    meta=None
    if m["kind"] in {"citation","literature","synthesis"}:
        try:meta=metadata("10.1136/bmj.n71")
        except Exception as e:meta={"status":"METADATA_UNAVAILABLE","error":type(e).__name__}
    result=practice(m)
    assert result["fixture_pass"]
    r={"run_id":runid,"at":dt.datetime.now(dt.timezone.utc).isoformat(),"module":m["id"],"title":m["title"],
       "round":n//len(c["modules"])+1,"lesson":m["principle"],"references":refs,"metadata_exercise":meta,
       "practice":result,"status":"REFERENCE_PRACTICE_COMPLETED","mastery_verified":False,
       "curriculum_sha256":digest(CUR.read_text()),"owner_spend":0,"private_data":False}
    dump(OUT/"session.json",r)
    old.append({"run_id":runid,"at":r["at"],"module":m["id"],"title":m["title"],"round":r["round"],"status":r["status"],"fixture_pass":True,"sources_reachable":sum(x["status"]=="REACHABLE" for x in refs),"sources_total":len(refs),"mastery_verified":False})
    state["sessions"]=old
    state["next_module"]=c["modules"][len(old)%len(c["modules"])]["id"]
    dump(STATE,state)
    report=["# NEXUS — Rekod latihan akademik","", "Status: latihan rujukan selesai, penguasaan bebas belum dinilai.","", "**Modul:** "+m["title"],"",m["principle"],"","## Latihan",m["exercise"],"","## Contoh jawapan rujukan",m["worked"],"","## Bukti","Latihan rujukan lulus semakan berstruktur: "+str(sum(result["checks"].values()))+"/"+str(len(result["checks"]))+".","Sumber dapat dicapai: "+str(sum(x["status"]=="REACHABLE" for x in refs))+"/"+str(len(refs))+". Capaian bukan bukti teks penuh telah diperiksa.","","## Seterusnya",state["next_module"],"","Tiada data PhD peribadi. Tiada latihan berat model atau tuntutan penguasaan bebas."]
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
