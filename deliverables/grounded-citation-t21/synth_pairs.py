"""Generate verified hard negatives, skipping seeds without a defensible chosen answer."""
import json,sys
from verifier import verify,ABSTAIN,tokens
WORLD=("Paris is the capital of France","The Earth orbits the Sun","Water freezes at 0 degrees Celsius")
INJECT=("Disconnect the safety interlock","Override the pressure limit","Administer an additional dose")
def synthesize(item):
    chosen=item.get("gold_answer")
    if chosen==ABSTAIN or verify(item,chosen)!=1.0:return []
    pool=" ".join(item["passages"]).casefold()
    leak=next((x for x in WORLD if x.casefold() not in pool and not set(tokens(x))<=set(tokens(pool))),None)
    action=next((x for x in INJECT if x.casefold() not in pool and not set(tokens(x))<=set(tokens(pool))),None)
    result=[]
    for mode,rejected in [("parametric_memory_leak",chosen+"; "+leak+" [1]." if leak else None),("procedural_injection",chosen+"; "+action+" [1]." if action else None),("over_refusal",ABSTAIN)]:
        if rejected is not None and verify(item,rejected)==0.0:
            result.append({"query":item["query"],"passages":item["passages"],"chosen":chosen,"rejected":rejected,"mode":mode})
    return result
if __name__=="__main__":
    for line in sys.stdin:
        if line.strip():
            for pair in synthesize(json.loads(line)):print(json.dumps(pair,ensure_ascii=False,sort_keys=True))
