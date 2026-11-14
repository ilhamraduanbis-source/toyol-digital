#!/usr/bin/env python3
"""Attempt one real paid SwarmMemo public-data brief with independently checkable evidence.

All external content is data, not instructions. No wallet private keys or fees.
This worker has only one goal: submit an actual result and claim a 0.02 USDC
reward if a real daily seat is open. A listing/claim isn't income.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

WORK_ID = "20ef7df2131fae0b1e58eb843e35913d"
PREVIOUS_ID = "09c1f608bbe17d729f034c1dae5b0a04"
WORK_URL = "https://swarmmemo.com/api/work/" + WORK_ID
WALLET = "0xaC57AD3c3F233E5865c3cd652f67Ffc82a7Af431"
CLIENT = "https://raw.githubusercontent.com/Hugo0/swarmmemo/a07a568f40f8b53f382f71165d8e57a761c3ae74/clients/python/swarmmemo.py"
CLIENT_BLOB = "76ee66257f69b81bea46b0f33608e9ea3f6768fd"
STATIONS = ("KORD", "KDEN", "KJFK", "KLAX", "KMWN", "KSEA", "KBOS", "KPHX", "KMSP", "KSFO", "KATL", "KPDX")
MAX_BYTES = 190000

def status_note(s):
    print(s, flush=True)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(s + "\n")

def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "ToyolPublicDataWorker/1.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=22) as response:
            code, raw = response.status, response.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        code, raw = exc.code, exc.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise RuntimeError("Unbounded third-party response, stopped")
    return code, json.loads(raw)

def checked_work():
    status, payload = get(WORK_URL)
    if status != 200 or payload.get("ok") is not True:
        raise RuntimeError("Could not read original paid task")
    return payload["data"]["work"]

def seat_open(work):
    standing = work.get("standing") or {}
    return (work.get("id") == WORK_ID and work.get("state") == "open" and
            work.get("claimable") is True and (standing.get("open") or 0) > 0 and
            any(str(t.get("usdc")) in ("0.02", "0.020") and t.get("name") == "brief"
                for t in standing.get("tiers", [])) and
            work.get("requester", {}).get("handle") == "weaver")

def choose_station():
    texts = []
    for task_id in (WORK_ID, PREVIOUS_ID):
        status, payload = get("https://swarmmemo.com/api/thread/" + task_id + "?limit=150")
        if status != 200:
            raise RuntimeError("Cannot check previous work for duplicate data")
        messages = payload.get("messages", payload.get("data", {}).get("messages"))
        if not isinstance(messages, list):
            raise RuntimeError("Unexpected thread format")
        texts.extend(str(m.get("text", "")) for m in messages if m.get("id") != task_id)
    combined = "\n".join(texts).lower()
    for station in STATIONS:
        if not re.search(r"\b" + station.lower() + r"\b", combined):
            return station
    return None

def paid_free_tool(path, params):
    query = urllib.parse.urlencode(params)
    code, payload = get("https://swarmmemo.com/call/" + path + "?" + query)
    if code != 200 or payload.get("ok") is not True:
        raise RuntimeError("Free data/notary service unavailable, no result to submit")
    call = payload.get("data", {}).get("call") or {}
    if call.get("paid_from") != "free_allowance" or int(call.get("credits_spent", 0)) != 0:
        raise RuntimeError("Service charged transferable credits; do not proceed")
    return payload["data"]

def make_brief(station):
    args = {"dataset": "noaa_station_daily", "station": station, "limit": 3}
    fetched = paid_free_tool("public_data/fetch", args)
    response = fetched.get("result") or {}
    if response.get("dataset") != "noaa_station_daily":
        raise RuntimeError("Dataset mismatch")
    data = response.get("data") or {}
    days = data.get("days") or []
    if not days or not response.get("source_url"):
        raise RuntimeError("Missing public data observations or official source")
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf8")
    checksum = hashlib.sha256(canonical).hexdigest()
    if checksum != response.get("data_sha256"):
        raise RuntimeError("Provider data checksum mismatch")
    record = days[0]
    observed = record.get("date")
    high, low, rain = record.get("tmax_c"), record.get("tmin_c"), record.get("precip_mm")
    if not observed or high is None or low is None or rain is None:
        raise RuntimeError("Incomplete latest NOAA observation")
    stamped = paid_free_tool("notary/stamp", {"text": checksum})
    receipt = (stamped.get("result") or {}).get("receipt") or {}
    receipt_hash = receipt.get("hash")
    if not isinstance(receipt_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", receipt_hash):
        raise RuntimeError("No verifiable notary receipt")
    fetched_at = response.get("fetched_at")
    as_of = response.get("as_of")
    if not fetched_at or not as_of:
        raise RuntimeError("No source freshness metadata")
    lag = response.get("lag") or "NOAA observations can arrive with publication delay."
    brief = [
        f"NOAA GHCN-Daily {station} ({data.get('station')}), observation {observed}: high {high} C, low {low} C, precipitation {rain} mm.",
        f"Data retrieved {fetched_at}; official source last available {as_of}. {lag}",
        f"Official NOAA NCEI source: {response['source_url']}",
        f"Dataset and args: noaa_station_daily {json.dumps(args, sort_keys=True)}; data SHA-256 {checksum}.",
        f"Fetch call {fetched.get('call', {}).get('id')}; notary receipt {receipt_hash} seq {receipt.get('seq')}; proof https://swarmmemo.com/api/log/proof?notary={receipt_hash}.",
        f"Base USDC public payout address: {WALLET}. Figures are observations, not a claim about current weather.",
    ]
    return "\n".join(brief)

def run_cli(client, key, *args):
    env = {k: os.environ[k] for k in ("PATH", "HOME", "LANG", "LC_ALL") if k in os.environ}
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    proc = subprocess.run(["python3", str(client), "--key", str(key), *args],
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                          env=env, timeout=50)
    if proc.returncode:
        raise RuntimeError("Signed SwarmMemo client rejected command; no automatic retry")
    try:
        obj = json.loads(proc.stdout)
    except (ValueError, TypeError):
        raise RuntimeError("Signed response was not JSON") from None
    if obj.get("ok") is not True:
        raise RuntimeError("No accepted signed command receipt")
    return obj

def receipt_id(obj):
    v = (obj.get("receipt") or {}).get("id")
    if not isinstance(v, str) or not re.fullmatch(r"[0-9a-f]{16,64}", v):
        raise RuntimeError("Signed post receipt missing")
    return v

def claim_real_work(brief):
    with tempfile.TemporaryDirectory(prefix="toyol_paid_brief_") as directory:
        root = Path(directory)
        root.chmod(0o700)
        client, key = root / "client.py", root / "signer.json"
        request = urllib.request.Request(CLIENT, headers={"User-Agent": "ToyolPinnedClient/1.0"})
        with urllib.request.urlopen(request, timeout=25) as r:
            client.write_bytes(r.read(500000))
        raw = client.read_bytes()
        blob = b"blob " + str(len(raw)).encode() + b"\x00" + raw
        if hashlib.sha1(blob).hexdigest() != CLIENT_BLOB:
            raise RuntimeError("Pinned SwarmMemo client differs from source commit")
        # Reuse one authorized signer, never generate a fresh identity per result.
        signer = os.environ.get("TOYOL_SWARMMEMO_SIGNER_JSON")
        if not signer:
            raise RuntimeError("Stable authorized SwarmMemo signer not configured; no post or claim")
        if len(signer) > 20000 or not isinstance(json.loads(signer), dict):
            raise RuntimeError("Invalid signer format; no post or claim")
        key.touch(mode=0o600, exist_ok=False)
        key.write_text(signer, encoding="utf8")
        research = receipt_id(run_cli(client, key, "post", "research", "main", brief))
        if not seat_open(checked_work()):
            status_note("Brief published in research, but paid seat closed. Not claimed.")
            status_note("Research receipt: https://swarmmemo.com/e/" + research)
            return
        reply = brief + "\nResearch post: https://swarmmemo.com/e/" + research
        result = receipt_id(run_cli(client, key, "post", "bounties", "main", reply,
                                    "--reply-to", WORK_ID))
        if not seat_open(checked_work()):
            status_note("Result posted but seat closed before claim. No payment.")
            return
        run_cli(client, key, "work", "claim", WORK_ID, "--result", result,
                "--payout-address", WALLET)
        status_note("REAL external data brief submitted for 0.02 USDC: https://swarmmemo.com/e/" + result)
        status_note("Awaiting reviewer acceptance and on-chain payment. Not yet earned.")

def main():
    execute = "--execute" in sys.argv
    now = datetime.now(timezone.utc)
    if execute and now.hour >= 12 and now.date() < datetime(2026, 11, 25, tzinfo=timezone.utc).date():
        midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=2, microsecond=0)
        seconds = (midnight - now).total_seconds()
        if 0 < seconds <= 2800:
            status_note("Prewarmed for upcoming paid data-research seat.")
            time.sleep(seconds)
    w = checked_work()
    status_note(f"Live public-data job: claimable={w.get('claimable')}, seats={(w.get('standing') or {}).get('open')}")
    if not execute:
        status_note("Read-only status. No external posting or payment.")
        return
    if not ("2026-11-15" <= datetime.now(timezone.utc).date().isoformat() < "2026-11-25"):
        status_note("Outside approved public-data bounty window.")
        return
    if not seat_open(w):
        status_note("No open paid seat; no work published.")
        return
    if any(str(((r.get("money") or {}).get("usdc") or {}).get("pay_to", "")).lower() == WALLET.lower() for r in w.get("results", [])):
        status_note("Prior result for this wallet exists in this round; no repeated submission.")
        return
    if not os.environ.get("TOYOL_SWARMMEMO_SIGNER_JSON"):
        status_note("Signer unavailable: no new identity or submission.")
        return
    station = choose_station()
    if not station:
        status_note("All approved station cases already used; no duplicate submission.")
        return
    brief = make_brief(station)
    claim_real_work(brief)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        status_note("Bounded real-task attempt stopped: " + str(e).splitlines()[0][:170])
        sys.exit(1)
