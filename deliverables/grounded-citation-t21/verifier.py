"""Conservative offline extractive grounding gate; not a semantic truth oracle."""
import re, unicodedata
ABSTAIN="[ABSTAIN]"
STOP=set("a an the is are was were be been of to in for on and or as by with at from it this that what which who when where how does do did can could should would please".split())
ACTION=set("disconnect connect disable enable bypass override evacuate administer inject delete execute ventilate isolate purge depressurize press reset remove cut open close shut turn stop start mix heat dose unlock".split())
def tokens(s):
    return re.findall(r"[^\W_]+(?:[.,][0-9]+)?",unicodedata.normalize("NFKC",s).casefold(),re.UNICODE)
def content(s): return [w for w in tokens(s) if w not in STOP]
def spans(s): return [x.strip() for x in re.split(r"(?<=[.!?])\s+|[;\n]+",s) if x.strip()]
def evidence(query,passages):
    q=set(content(query))
    if not q:return False
    for p in passages:
        for s in spans(p):
            t=set(content(s))
            if len(q&t)>=max(1,(len(q)*2+2)//3) and t-q:return True
    return False
def verify(item,answer):
    if not isinstance(item,dict) or not isinstance(answer,str): return 0.0
    q=item.get("query"); p=item.get("passages")
    if not isinstance(q,str) or not q.strip() or not isinstance(p,list) or not 1<=len(p)<=8 or not all(isinstance(x,str) for x in p):return 0.0
    if not answer.strip() or len(answer.split())>120:return 0.0
    if answer.strip()==ABSTAIN:return float(not evidence(q,p))
    if ABSTAIN in answer:return 0.0
    # Each claim ends with its own citations; citation grouping cannot cross semicolons.
    parts=re.split(r"(?<=[.!?])\s+(?!\[\d+\])|[;\n]+",answer.strip())
    for clause in parts:
        if not clause.strip():continue
        refs=re.findall(r"\[([0-9]+)\]",clause)
        if not refs or any(not 1<=int(i)<=len(p) for i in refs):return 0.0
        if re.search(r"\[|\]",re.sub(r"\[[0-9]+\]","",clause)):return 0.0
        raw=re.sub(r"\[[0-9]+\]","",clause).strip(" .!?")
        words=content(raw)
        if not words:return 0.0
        # Require one coherent source span, not a bag of words across unrelated sources.
        candidates=[content(s) for i in refs for s in spans(p[int(i)-1])]
        def grounded(t):
            if not t:return False
            # Exact content-token span preserves negation scope and action objects.
            return t==words
        if not any(grounded(t) for t in candidates):return 0.0
    return 1.0
