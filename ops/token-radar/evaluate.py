#!/usr/bin/env python3
"""Independent read-only quality gate for the sealed make.fun TokenRadar outputs."""
import json
import pathlib
import sys

if len(sys.argv) != 3:
    raise SystemExit("Usage: evaluate.py SNAPSHOT_JSON OUTPUT_DIR")
snapshot = json.loads(pathlib.Path(sys.argv[1]).read_text())
root = pathlib.Path(sys.argv[2])
out = json.loads((root / "board.json").read_text())
rows = out.get("rows")
assert isinstance(rows, list) and len(rows) >= 100, "minimum 100 rows"
assert len({r["slug"] for r in rows}) == len(rows), "no duplicate slugs"
assert [r["rank"] for r in rows] == list(range(1, len(rows) + 1)), "sequential ranks"
values = [r["implied_value_usd"] for r in rows]
assert all(isinstance(v, (int, float)) and v > 0 for v in values), "positive numeric values"
assert values == sorted(values, reverse=True), "descending implied values"
assert max(values) > min(values), "nonconstant model"
expected = set(snapshot["watchlist"])
actual = {r["slug"] for r in rows}
assert expected <= actual, f"missing watchlist slugs: {sorted(expected-actual)[:10]}"
for r in rows:
    assert r.get("token_status") == "pre-token", ("incorrect status", r["slug"])
    steps = r.get("farm_steps")
    assert isinstance(steps, list) and 3 <= len(steps) <= 12, ("farm count", r["slug"])
    assert all(isinstance(s, str) and 20 <= len(s.strip()) <= 600 for s in steps), ("farm detail", r["slug"])
    assert isinstance(r.get("tvl_usd"), int) and r["tvl_usd"] >= 0, ("tvl", r["slug"])
for item in ("index.html", "app.js", "app.css"):
    assert (root / "dashboard" / item).is_file(), ("dashboard", item)
for fname in ("1-board.jpg", "2-detail.jpg", "3-filtered.jpg"):
    f = root / "screenshots" / fname
    assert f.is_file() and 5000 <= f.stat().st_size <= 524288, ("image", fname)
    assert f.read_bytes()[:3] == b"\xff\xd8\xff", ("not jpeg", fname)
assert (root / "dossier.json").is_file() and (root / "dossier.json").stat().st_size <= 1500000
print(json.dumps({
    "quality_gate": "PASS",
    "rows": len(rows),
    "watchlist": len(expected),
    "watchlist_coverage": len(actual & expected),
    "implied_value_max": max(values),
    "implied_value_min": min(values),
    "screenshots": 3,
    "dossier_bytes": (root / "dossier.json").stat().st_size,
}, sort_keys=True))
