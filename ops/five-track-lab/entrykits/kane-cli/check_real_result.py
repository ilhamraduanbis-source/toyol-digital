#!/usr/bin/env python3
"""Fail closed. Never turn NDJSON logs into a fake Kane success."""
import json
import os
from pathlib import Path
import sys

p=Path(sys.argv[1])
if not p.is_file() or p.stat().st_size < 20:
    raise SystemExit("AUTHENTIC_KANE_OUTPUT_MISSING")
events=[]
for line in p.read_text(encoding="utf-8",errors="replace").splitlines():
    try:
        obj=json.loads(line)
        if isinstance(obj,dict):
            events.append(obj)
    except json.JSONDecodeError:
        continue
last=next((e for e in reversed(events) if e.get("type")=="run_end"), None)
if not last:
    raise SystemExit("AUTHENTIC_KANE_RUN_END_MISSING")
exit_code=int(os.environ.get("KANE_RUN_RC","2"))
print("AUTHENTIC_KANE_RUN_END_FOUND", "EXIT_CODE", exit_code, "STATUS", str(last.get("status","unknown")))
if exit_code != 0:
    raise SystemExit("GENUINE_KANE_TEST_FAILED")
print("GENUINE_KANE_TEST_EXIT_ZERO, see original run_end for quality/result")
