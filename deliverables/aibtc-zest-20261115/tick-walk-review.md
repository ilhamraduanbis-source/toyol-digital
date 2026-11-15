# Zest router v6 — independent bounded tick-walk review

Date: 2026-11-15
Bounty: https://aibtc.com/bounties/mwaypr0sa4d1d6ca1f6a
Source pin: https://github.com/Rapha-btc/jing-contracts-v3/blob/9dab9bd/contracts/stx-usdcx/swap-router-stx-usdcx-jing-v6.clar
Scope: v6 Zest additions, not a general audit of the deployed pool.

## Verdict

No new bounty-eligible vulnerability established. The observed boundary behavior overlaps public submissions and must not be represented as novel. This is a static arithmetic model, not a Clarity VM or mainnet-fork execution.

## Reproducible checks

The integer model below follows the pinned source's zest-log2-bit, zest-log2, zest-tick, zest-tick-step and zest-ticks helpers. Constants were read from the pinned source. The review executed 231,842 tick-walk cases with 0 length, direction or endpoint-invariant failures; 53,478 empty walks; and 246 cases supplying at least one out-of-range tick. A further 30,000 ordered uint128 samples produced no tick monotonicity failures. This is bounded testing, not a proof over all uint128 inputs.

```python
ONE=2**60
STEP=16550525978195695
LOG_WAD=68938602072359301496
MAX=4458
def log2_fixed(x):
    n=x.bit_length()-1
    m=x>>(n-60) if n>=60 else x<<(60-n)
    f=0
    for bit in (2**i for i in range(59,43,-1)):
        sq=m*m//ONE
        if sq>=2*ONE:
            m=sq//2
            f+=bit
        else:
            m=sq
    return n*ONE+f
def tick(x):
    return max(-MAX,min(MAX,(log2_fixed(x)-LOG_WAD)//STEP))
def walk(a,b,up):
    t=a+(-2 if up else 2)
    end=b+(1 if up else -1)
    out=[]
    for _ in range(32):
        if (t>end if up else t<end):
            break
        out.append(t)
        t+=1 if up else -1
    return out
cases=invalid=empty=0
for a in range(-MAX,MAX+1):
    for d in (-5000,-35,-32,-3,-2,-1,0,1,2,3,32,35,5000):
        b=max(-MAX,min(MAX,a+d))
        for up in (True,False):
            xs=walk(a,b,up)
            cases+=1
            empty+=not xs
            invalid+=any(abs(t)>MAX for t in xs)
            assert len(xs)<=32
            assert all(y-x==(1 if up else -1) for x,y in zip(xs,xs[1:]))
            assert all(t<=b+1 if up else t>=b-1 for t in xs)
assert (cases,invalid,empty)==(231842,246,53478)
prev=-MAX-1
for i in range(30000):
    x=1+i*(2**128-2)//29999
    t=tick(x)
    assert t>=prev
    prev=t
print("231842 walk cases; 30000 monotonicity samples; all stated invariants pass")
```

## Boundary observations and limits

At midTick=boundTick=-4458, x-to-y provides [-4460,-4459,-4458,-4457]; at +4458, y-to-x provides [4460,4459,4458,4457]. Clamping tick estimates does not clamp the margin-expanded walk. The public bounty history already discusses invalid tick inputs and router errors. This review does not establish a distinct exploitable impact: zest-swap maps a router error to zero fill, and other venues continue. No transactions were broadcast, no external accounts contacted, and no payment claimed.

## Eligibility

The official bounty documentation requires a registered Bitcoin/Stacks identity, one submission per agent, and poster selection of a single winner; there is no escrow. https://aibtc.com/docs/bounties.txt
No submission made; no reward or settlement recorded. Do not submit this as a new security finding without further original evidence.
