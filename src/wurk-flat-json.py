#!/usr/bin/env python3
"""Bounded conversion of customer-supplied, non-sensitive flat JSON. No network."""
import csv
import io
import json
import re
import sys
from decimal import Decimal

def unique(pairs):
    d = {}
    for k, v in pairs:
        if k in d:
            raise ValueError("duplicate key")
        d[k] = v
    return d

def safe_cell(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int) or isinstance(v, Decimal):
        s = str(v)
        if len(s) > 40 or (isinstance(v, Decimal) and not v.is_finite()):
            raise ValueError("numeric range")
        return s
    if isinstance(v, str):
        if len(v) > 200 or any(ord(c) < 32 for c in v) or re.match(r"^[\s\ufeff]*[=+@\-]", v):
            raise ValueError("unsupported text or spreadsheet formula")
        return v
    raise ValueError("nested data")

def convert(raw):
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > 1600:
        raise ValueError("input size")
    rows = json.loads(raw, object_pairs_hook=unique, parse_float=Decimal, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite")))
    if not isinstance(rows, list) or not 1 <= len(rows) <= 20 or any(not isinstance(r, dict) or not r for r in rows):
        raise ValueError("expected 1-20 nonempty flat objects")
    fields = list(dict.fromkeys(k for r in rows for k in r))
    if not 1 <= len(fields) <= 8 or any(not k.strip() or len(k) > 80 for k in fields):
        raise ValueError("columns")
    for k in fields:
        safe_cell(k)
    expected = [fields] + [[safe_cell(r.get(k)) for k in fields] for r in rows]
    out = io.StringIO(newline="")
    csv.writer(out, lineterminator="\r\n").writerows(expected)
    result = out.getvalue()
    if len(result.encode("utf-8")) > 3000 or list(csv.reader(io.StringIO(result, newline=""))) != expected:
        raise ValueError("output size or roundtrip mismatch")
    return {"csv": result, "rows": len(rows), "columns": len(fields)}

def selftest():
    assert convert('[{"name":"A","count":2},{"name":"B","count":3}]')["csv"] == "name,count\r\nA,2\r\nB,3\r\n"
    assert convert(r'[{"a":"a,b","b":null},{"a":"a\"b","c":true}]')["rows"] == 2
    assert convert('[{"x":0.1234567890123456789}]')["csv"] == "x\r\n0.1234567890123456789\r\n"
    assert convert('[{"x":-12}]')["csv"] == "x\r\n-12\r\n"
    for raw in ('[]', '{}', '[{"x":1,"x":2}]', '[{"x":{"y":1}}]', '[{"x":"=1+1"}]', '[{"x":" +1"}]', '[{"x":NaN}]', '[{"x":1},{"":2}]'):
        try:
            convert(raw)
        except ValueError:
            continue
        raise AssertionError("invalid input accepted")
    print("WURK_CONVERSION_TESTS_OK 12")

if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        try:
            raw = sys.stdin.buffer.read(1601).decode("utf-8")
            sys.stdout.write(json.dumps(convert(raw), ensure_ascii=False))
        except Exception:
            # Never echo customer input or its exception text.
            print("INPUT_NOT_SUPPORTED", file=sys.stderr)
            sys.exit(2)
