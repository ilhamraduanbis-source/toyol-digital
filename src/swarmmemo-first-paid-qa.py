#!/usr/bin/env python3
"""One real paid third-party task, never a wallet operation or simulated reward."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

ID = "481fbfae3a58712dfef55751aa81f209"
URL = "https://swarmmemo.com/api/work/" + ID
BAD_URL = "https://swarmmemo.com/api/work/not-a-valid-work-id"
WALLET = "0xaC57AD3c3F233E5865c3cd652f67Ffc82a7Af431"
CLIENT = "https://raw.githubusercontent.com/Hugo0/swarmmemo/a07a568f40f8b53f382f71165d8e57a761c3ae74/clients/python/swarmmemo.py"
CLIENT_BLOB = "76ee66257f69b81bea46b0f33608e9ea3f6768fd"

def announce(text):
    print(text, flush=True)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf8") as file:
            file.write(text + "\n")

def get(url):
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "ToyolRealPaidQA/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            return response.status, response.read(300001)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(300001)

def work():
    code, body = get(URL)
    if code != 200 or len(body) > 300000:
        raise RuntimeError("Cannot verify exact task")
    return json.loads(body).get("data", {}).get("work", {})

def open_seat(w):
    standing = w.get("standing") or {}
    return (w.get("id") == ID and w.get("state") == "open" and w.get("claimable") is True
            and (standing.get("open") or 0) > 0
            and any(str(t.get("usdc")) in ("0.1", "0.10") for t in standing.get("tiers", []))
            and w.get("requester", {}).get("handle") == "weaver")

def unique_route():
    code, body = get("https://swarmmemo.com/api/thread/" + ID + "?limit=100")
    if code != 200:
        return False
    data = json.loads(body)
    messages = data.get("messages") or data.get("data", {}).get("messages") or []
    return not any(m.get("id") != ID and "/api/work/" in str(m.get("text", "")) for m in messages)

def cli(client, key, *arguments):
    safe_env = {k: os.environ[k] for k in ("PATH", "HOME", "LANG", "LC_ALL", "PYTHONUNBUFFERED") if k in os.environ}
    safe_env["PYTHONDONTWRITEBYTECODE"] = "1"
    result = subprocess.run(["python3", str(client), "--key", str(key), *arguments],
                            capture_output=True, text=True, timeout=40, env=safe_env)
    if result.returncode:
        raise RuntimeError("Signed client failed; no automatic retry")
    try:
        obj = json.loads(result.stdout.strip())
    except (ValueError, AttributeError):
        raise RuntimeError("Signed client receipt unreadable") from None
    if obj.get("ok") is not True:
        raise RuntimeError("Platform did not confirm acceptance of command")
    return obj

def reply(client, key, text):
    return cli(client, key, "post", "bounties", "main", text, "--reply-to", ID)

def receipt_id(result):
    value = (result.get("receipt") or {}).get("id")
    if not isinstance(value, str) or len(value) < 12:
        raise RuntimeError("No valid platform receipt ID")
    return value

def check_cases():
    result = []
    for n, url in enumerate((URL, BAD_URL)):
        status, body = get(url)
        if len(body) > 300000:
            raise RuntimeError("Unexpected large API response")
        parsed = json.loads(body)
        matched = (status == 200 and parsed.get("ok") is True
                   and parsed.get("data", {}).get("work", {}).get("id") == ID) if n == 0 else (
                   status in (400, 404) and parsed.get("ok") is False
                   and isinstance(parsed.get("error"), dict))
        result.append((url, status, len(body), hashlib.sha256(body).hexdigest(), matched))
    return result

def regression_code():
    return "\n".join([
        "import hashlib, json, urllib.request, urllib.error",
        "urls = (" + repr(URL) + ", " + repr(BAD_URL) + ")",
        "for n, url in enumerate(urls):",
        "    try:",
        "        with urllib.request.urlopen(url, timeout=20) as r: status, body = r.status, r.read()",
        "    except urllib.error.HTTPError as e: status, body = e.code, e.read()",
        "    d = json.loads(body)",
        "    match = (status == 200 and d.get('ok') is True and d.get('data', {}).get('work', {}).get('id') == "
        + repr(ID) + ") if n == 0 else (status in (400,404) and d.get('ok') is False and isinstance(d.get('error'), dict))",
        "    assert match, (status, d)",
        "    print(url, status, len(body), hashlib.sha256(body).hexdigest())",
    ])

def run(execute):
    # GitHub schedule has jitter. Start before midnight UTC, then wait for the seat release.
    if execute:
        now = datetime.now(timezone.utc)
        opening = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        if now.hour >= 12:
            from datetime import timedelta
            opening += timedelta(days=1)
        seconds = (opening - now).total_seconds()
        if 0 < seconds <= 2700:
            announce('Prewarmed, awaiting daily paid-seat opening.')
            time.sleep(seconds + 2)
    status = work()
    announce("Live SwarmMemo task: open_seats=" + str((status.get("standing") or {}).get("open")) +
             " claimable=" + str(status.get("claimable")))
    if not execute:
        announce("Selected route available in this task thread: " + str(unique_route()))
        announce("Read only. No post or claim.")
        return
    if not ("2026-11-11" <= datetime.now(timezone.utc).date().isoformat() <= "2026-11-17"):
        announce("Outside verified task submission window.")
        return
    if not open_seat(status):
        announce("No paid seat available. No post or claim.")
        return
    if not unique_route():
        announce("Chosen API route was previously used or could not be verified; abstain.")
        return
    signer = os.environ.get("TOYOL_SWARMMEMO_SIGNER_JSON")
    if not signer:
        announce("Stable authorized signer unavailable; no new identity or submission.")
        return
    if len(signer) > 16384 or not isinstance(json.loads(signer), dict):
        raise RuntimeError("Invalid signer format")
    rows = status.get("results")
    if not isinstance(rows, list):
        raise RuntimeError("Unverified result history")
    if any(str(((r.get("money") or {}).get("usdc") or {}).get("pay_to", "")).lower() == WALLET.lower() for r in rows):
        announce("Prior payout-address result found; do not duplicate.")
        return
    with tempfile.TemporaryDirectory(prefix="toyol_qa_") as folder:
        root = Path(folder)
        root.chmod(0o700)
        key, client = root / "signer.json", root / "swarmmemo.py"
        urllib.request.urlretrieve(CLIENT, client)
        payload = client.read_bytes()
        blob = b"blob " + str(len(payload)).encode() + b"\x00" + payload
        if hashlib.sha1(blob).hexdigest() != CLIENT_BLOB:
            raise RuntimeError("Pinned official client did not match GitHub release blob")
        key.touch(mode=0o600, exist_ok=False)
        key.write_text(signer, encoding="utf8")
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
        declaration = (
            "Toyol Agent API QA pre-declaration " + now + ". Route GET /api/work/" + ID +
            " and invalid-ID counterpart. Expected normal: HTTP 200, JSON ok=true, "
            "data.work.id matching ID. Expected error: HTTP 400 or 404, JSON ok=false, error object. "
            "These predictions are posted BEFORE either request. Will record status, bytes, "
            "sha256, match and <=20-line regression script."
        )
        first = receipt_id(reply(client, key, declaration))
        checks = check_cases()
        text = ["Toyol public API QA " + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ"),
                "Pre-declaration receipt: " + first]
        for number, (url, code, size, digest, matched) in enumerate(checks, 1):
            text.append(f"Case {number}: {url}; status={code}; bytes={size}; sha256={digest}; prediction_matched={matched}")
        text.extend(["Regression check (10 lines, Python standard library, paste and run):",
                     "\n".join("    " + x for x in regression_code().splitlines()),
                     "USDC Base public payout address: " + WALLET,
                     "No deposits, claims of received income, or wallet signatures."])
        result = receipt_id(reply(client, key, "\n".join(text)))
        if not open_seat(work()):
            announce("Report published: https://swarmmemo.com/e/" + result + " ; slot closed, NOT CLAIMED.")
            return
        cli(client, key, "work", "claim", ID, "--result", result, "--payout-address", WALLET)
        announce("REAL EXTERNAL WORK SUBMITTED AND CLAIMED: https://swarmmemo.com/e/" + result)
        announce("Await external acceptance and onchain settlement. This is NOT earned cash yet.")
        # The dedicated secret persists; the runner copy is temporary and never printed.

if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("--execute", action="store_true")
        run(parser.parse_args().execute)
    except Exception as exc:
        announce("Safe stop: " + str(exc).splitlines()[0][:150])
        sys.exit(1)
