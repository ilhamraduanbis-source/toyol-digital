#!/usr/bin/env python3
"""Deterministic packaging-only check. DOES NOT call a model, Kaggle, or submit."""
import argparse
from pathlib import Path
import re
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

FILES = ("agent.yaml", "eval_config.yaml", "configs/sampling.yaml", "prompts/system.md")
MODEL = "gemma-4-31b-it-qat-w4a16-ct"
TOOLS = ("run_command", "read_file", "edit_file", "write_file", "get_status",
         "submit_patch", "get_code_neighbors", "search_similar_code", "get_code_subgraph")
BASE = Path(__file__).resolve().parent

def preflight(base=BASE):
    data = {}
    for name in FILES:
        path = base / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Missing/unsafe file " + name)
        contents = path.read_bytes()
        if not contents or len(contents) > 100000:
            raise ValueError("Invalid size " + name)
        data[name] = contents
    agent = data["agent.yaml"].decode()
    assert re.findall(r"^model:\s*([^\s]+)\s*$", agent, re.M) == [MODEL], "Wrong model"
    for tool in TOOLS:
        assert re.search(r"^\s*-\s*" + re.escape(tool) + r"\s*$", agent, re.M), tool
    for f in ("prompts/system.md", "configs/sampling.yaml"):
        assert "!include " + f in agent
    if any(b"PRIVATE KEY" in x or b"sk-proj-" in x for x in data.values()):
        raise ValueError("Potential credential")
    return data

def package(dest, base=BASE):
    data = preflight(base)
    dest=Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(dest, "w") as z:
        for name, contents in sorted(data.items()):
            entry=ZipInfo(name, date_time=(2026,11,23,0,0,0))
            entry.compress_type=ZIP_DEFLATED
            entry.external_attr=0o644 << 16
            z.writestr(entry, contents)
    with ZipFile(dest) as z:
        assert sorted(z.namelist()) == sorted(FILES)
    return dest

if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out", default="dist/submission.zip")
    args=p.parse_args()
    print("CONFIG_PACKAGE_OK",package(args.out))
    print("KAGGLE_RULES_ACCEPTED=UNVERIFIED EVALUATOR_NOT_RUN SUBMISSION=NO")
