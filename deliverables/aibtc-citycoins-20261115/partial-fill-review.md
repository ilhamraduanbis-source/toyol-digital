# CCD015 partial-fill arithmetic: bounded independent review

Bounty: https://aibtc.com/bounties/mw4761qx68024266725f
Source: https://github.com/Rapha-btc/citycoins-protocol/blob/223bced455d94e0c9b6a08d6606d9db785538106/contracts/extensions/ccd015-redemption-book-mia-stx.clar
Scope: settle-step arithmetic only; not a complete CCIP-028 audit. No new vulnerability claimed.

For a positive offer amount A, ask P, and available budget 0 <= B < P, the contract computes T = floor(A*B/P). If T > 0, it pays B and retains A-T MIA at ask P-B. The invariants are:
- exact token and STX conservation across this local transition;
- positive retained amount and ask;
- retained unit price cannot increase, since P*T <= A*B;
- exact rounding remainder 0 <= A*B-P*T < P.
Consequently the extra payment relative to ideal fractional pro-rata burn is strictly less than one micro-MIA at the original unit price per partial fill. This is a local rounding bound, not a cumulative economic bound or a proof of all cross-book behavior.

Independent integer model executed 2026-11-15:
```python
cases=rounding=0
for a in range(1,97):
    for p in range(1,97):
        for b in range(p):
            t=a*b//p
            if t:
                la,lp=a-t,p-b
                assert la>0 and lp>0
                assert la+t==a and lp+b==p
                assert lp*a<=p*la
                err=a*b-t*p
                assert 0<=err<p
                rounding+=err>0
            else:
                assert a*b<p
            cases+=1
assert (cases,rounding)==(446976,399147)
print(cases,rounding)
```
Observed: 446,976 cases; 399,147 nonzero rounding remainders among positive-taken cases; zero invariant failures.

At the publicly reported snapshot par=204249 (scale 1e8), a minimum-size offer of 100,000 MIA at par has A=100000000000 micro-MIA and P=204249000 micro-STX. B=1 micro-STX yields T=489 micro-MIA, remainder numerator 122239000. This illustrates the already reported partial-fill rounding effect; it is not a fresh finding. A live contract call, Clarinet VM run, and the full audit were not performed.

Prior reports on the bounty page include partial-fill rounding, sub-minimum remainder repricing and FIFO behavior. Do not claim novelty or submit this narrow review as a completed full audit. No bounty submission or payment was made.
