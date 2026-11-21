# AUREN Bug Bounty — duplicate canonical ticker drops position value

Status: reproducible; NOT SUBMITTED upstream; no payout claimed.
Target: https://github.com/Ayush441-python/AUREN/blob/main/api.py
Program: https://github.com/Ayush441-python/AUREN/blob/main/BOUNTY.md

## Summary
AUREN's `api.py::_normalize_and_validate_weights` uses
`clean_weights = {k.strip().upper(): v for k, v in weights.items()}`.
Two different JSON property names such as `"NVDA"` and `" NVDA "` both map to `"NVDA"` and the latter silently overwrites the former.

## Local reproducible result
Using Python with pandas 2.2.3 to mirror the function exactly:

```python
import pandas as pd

def norm(weights):
    cleaned = {k.strip().upper(): v for k, v in weights.items()}
    w = pd.Series(cleaned, dtype=float)
    if (w <= 0).any() or w.sum() <= 0:
        raise ValueError("rejected")
    return (w / w.sum()).to_dict()

print(norm({"NVDA": 80, " NVDA ": 1, "MSFT": 19}))
# {'NVDA': 0.05, 'MSFT': 0.95}

print(norm({"NVDA": 80, "MSFT": 19}))
# {'NVDA': 0.8080808080808081, 'MSFT': 0.1919191919191919}
```

Expected: either reject aliases with HTTP 400 or explicitly aggregate canonical duplicates (the complete input represents 81 NVDA / 19 MSFT). Actual: 5 NVDA / 95 MSFT with no error. Mixed case aliases have the same effect.

This can misstate the leading asset and skew sector and stress risk outputs. Test cases should cover uppercase/lowercase and whitespace aliases, distinct tickers and one lowercase ticker. Fix by normalizing in a loop, rejecting collisions before calculating the weight series.

This report is a minimal offline reproduction of the genuine normalization expression, not proof of a live API call. Review the upstream issue tracker for duplicates and verify any published payout pool before representing it as a payable award.
