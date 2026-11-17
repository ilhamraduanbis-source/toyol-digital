#!/usr/bin/env python3
"""Identify independently verified payouts to the public Toyol Base wallet.

Reads public SwarmMemo and Frantic payout records and verifies Base USDC transfer logs. Never signs a wallet transaction.
Notify via own repo issue once per verified transaction.
"""
import json
from decimal import Decimal, InvalidOperation
import os
import re
import sys
import urllib.request

REPO = "ilhamraduanbis-source/toyol-digital"
ISSUE = 5
ADDRESS = "0xaC57AD3c3F233E5865c3cd652f67Ffc82a7Af431"
TASKS = {
    "SwarmMemo Botnet directory correction": "22a8b8bb25843a211b64682bc03fe165",
    "SwarmMemo Botnet directory correction round 3": "22a8b8bb25843a211b64682bc03fe165",
    "SwarmMemo API QA": "481fbfae3a58712dfef55751aa81f209",
    "SwarmMemo API QA round 5": "c96fb3a4fbcda3789dc6eee919256a50",
    "SwarmMemo public-data brief": "09c1f608bbe17d729f034c1dae5b0a04",
    "SwarmMemo public-data brief round 3": "20ef7df2131fae0b1e58eb843e35913d",
    "SwarmMemo paste documentation audit": "65ba0fb3af541b65f34cf4bbd2b40c03",
    "SwarmMemo CLI bug bounty round 10": "1b766c6ef793d578031b50ea1e197d4c",
    "SwarmMemo bug bounty round 11": "9a7a1d94ac3c0dd8c359882ca2006f60",
}
FRANTIC_AGENT = "agent-65c3b0"
USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
BASE_RPC = "https://mainnet.base.org"
TX_RE = re.compile(r"0x[0-9a-fA-F]{64}")
MARKER_RE = re.compile(r"TOYOL-PAYOUT-TX\s+(0x[0-9a-fA-F]{64})")

def read_json(url, token=None):
    headers = {"Accept": "application/json", "User-Agent": "ToyolPayoutEvidence/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=18) as response:
        if response.status != 200:
            raise RuntimeError("Unexpected source HTTP response")
        return json.load(response)

def base_rpc(method, params):
    req = urllib.request.Request(
        BASE_RPC, data=json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode(),
        headers={"Content-Type":"application/json","User-Agent":"ToyolPayoutEvidence/1.0"}, method="POST")
    with urllib.request.urlopen(req, timeout=18) as response:
        obj = json.load(response)
    if obj.get("error") or "result" not in obj:
        raise RuntimeError("Base RPC evidence unavailable")
    return obj["result"]

def check_base_transfer(tx, amount):
    if not TX_RE.fullmatch(tx):
        return False
    units = Decimal(str(amount)) * 1000000
    if units <= 0 or units != units.to_integral_value():
        return False
    if base_rpc("eth_chainId", []) != "0x2105":
        raise RuntimeError("Unexpected RPC chain")
    receipt = base_rpc("eth_getTransactionReceipt", [tx])
    if not receipt or receipt.get("status") != "0x1" or str(receipt.get("transactionHash","")).lower() != tx.lower():
        return False
    # Do not announce unfinalized blocks. A failed public RPC check is not payment proof.
    finalized = base_rpc("eth_getBlockByNumber", ["finalized", False])
    if not finalized or int(receipt["blockNumber"],16) > int(finalized["number"],16):
        return False
    recipient = "0x" + ADDRESS[2:].lower().rjust(64,"0")
    amounts = []
    for log in receipt.get("logs", []):
        topics = log.get("topics") or []
        if str(log.get("address","")).lower() != USDC or len(topics) != 3:
            continue
        if topics[0].lower() == TRANSFER and topics[2].lower() == recipient:
            amounts.append(int(log["data"],16))
    return int(units) in amounts

def frantic_paid():
    url = "https://gofrantic.com/v1/agents/" + FRANTIC_AGENT + "/status"
    obj = read_json(url)
    if obj.get("ok") is not True or (obj.get("agent") or {}).get("kid") != FRANTIC_AGENT:
        raise RuntimeError("Unverified Frantic agent status")
    out = []
    for item in (obj.get("work") or {}).get("settled") or []:
        payout = item.get("payout") or {}
        if item.get("stage") != "paid" or payout.get("state") != "paid" or not payout.get("settledAt"):
            continue
        code = str(payout.get("receiptCode") or "")
        if not re.fullmatch(r"r/[0-9a-f]{8}", code):
            continue
        # Only the platform's actual payment reference, not arbitrary hashes in a brief.
        hashes = TX_RE.findall(str(payout.get("paymentRef") or ""))
        if len(hashes) != 1:
            continue
        bounty = item.get("bounty") or {}
        cents = bounty.get("priceCents")
        n = bounty.get("number")
        if not isinstance(cents, int) or isinstance(cents, bool) or cents <= 0 or not isinstance(n,int) or n <= 0:
            continue
        amount = Decimal(cents) / 100
        out.append({"task":"Frantic bounty #" + str(n), "amount":amount,
                    "tx":hashes[0], "result_url":"https://gofrantic.com/" + code,
                    "task_url":"https://gofrantic.com/bounties/" + str(n)})
    return out

def swarmmemo_discovered_tasks():
    """Discover new reward-bearing rounds, without assuming a claimed award or payment.

    The public earn/rewarded indexes are bounded, not a complete historical
    ledger. The known-task fallback below preserves older receipts.
    """
    found = {}
    for kind in ("earn", "rewarded"):
        try:
            payload = read_json("https://swarmmemo.com/api/works?kind=" + kind + "&limit=100")
            rows = (payload.get("data") or {}).get("works", payload.get("works"))
            if payload.get("ok") is not True or not isinstance(rows, list):
                raise RuntimeError("Unexpected public index schema")
            for work in rows:
                if not isinstance(work, dict):
                    continue
                taskid = str(work.get("id") or "")
                if not re.fullmatch(r"[a-f0-9]{32}", taskid):
                    continue
                standing = work.get("standing") or {}
                tiers = standing.get("tiers") or []
                monetary = any(isinstance(t, dict) and
                               str(t.get("usdc") or "").strip() not in ("", "0", "0.00")
                               for t in tiers)
                monetary = monetary or bool(work.get("reward_usdc"))
                if monetary:
                    found.setdefault(taskid, "SwarmMemo " + str(work.get("title") or taskid)[:90])
            print("SwarmMemo discovery " + kind + ": " + str(len(rows)) +
                  " indexed entries; " + str(len(found)) + " unique cash candidates",
                  flush=True)
        except Exception as err:
            print("SwarmMemo dynamic index unavailable: " + kind + " " +
                  type(err).__name__, flush=True)
    return found


def paid_to_toyol():
    receipts = []
    # De-duplicate legacy labels that point to the same task. New future rounds
    # are discovered from public indexes automatically; no manually added ID.
    tasks = {taskid: label for label, taskid in TASKS.items()}
    for taskid, label in swarmmemo_discovered_tasks().items():
        tasks.setdefault(taskid, label)
    print("SwarmMemo unique tasks inspected: " + str(len(tasks)), flush=True)
    for taskid, label in tasks.items():
        try:
            payload = read_json("https://swarmmemo.com/api/work/" + taskid)
            if not payload.get("ok"):
                raise RuntimeError("Unverified task API response")
            task = payload.get("data", {}).get("work") or {}
            if task.get("id") != taskid:
                raise RuntimeError("Unexpected source work identity")
            results = task.get("results")
            if not isinstance(results, list):
                raise RuntimeError("Missing payout result list")
            for result in results:
                payout = (result.get("money") or {}).get("usdc") or {}
                if payout.get("state") != "paid":
                    continue
                if str(payout.get("pay_to") or "").lower() != ADDRESS.lower():
                    continue
                tx = str(payout.get("tx_hash") or "")
                if not TX_RE.fullmatch(tx):
                    continue
                try:
                    amount = Decimal(str(payout.get("amount")))
                except (TypeError, ValueError, InvalidOperation):
                    continue
                if not amount.is_finite() or not (0 < amount <= 100):
                    continue
                rid = str(result.get("result_id") or "")
                if not re.fullmatch(r"[a-f0-9]{32}", rid):
                    continue
                receipts.append({"task": label, "amount": amount, "tx": tx,
                                 "result_url": "https://swarmmemo.com/e/" + rid,
                                 "task_url": "https://swarmmemo.com/work/" + taskid})
        except Exception as err:
            print("SwarmMemo work read unavailable: " + taskid + " " +
                  type(err).__name__, flush=True)
    return receipts

def taskmarket_paid():
    # Exact previously verified public entries; do not infer payments from submission alone.
    entries = (
        ("Sales Report", "0x2d6c97c911c6dd928ced4a6cc1754ffff99dbd6de1cdba3132ba3e64b375f6ce", "87ec4c68-cce5-43e8-9d2e-5dee272f0b0d"),
        ("Markdown TOC", "0xb9e4a1326704af63008ad7298351d2a6143be6de9371652ae1f85cc001d3ba88", "ad7a882f-f49b-4c8a-a97c-d57fe54710d1"),
    )
    receipts = []
    for label, task_id, submission_id in entries:
        try:
            task = read_json("https://api.taskmarket.dev/api/tasks/" + task_id + "?chainId=8453")
            task = task.get("task", task)
            if task.get("id") != task_id or task.get("chainId") != 8453:
                raise RuntimeError("Taskmarket identity mismatch")
            awards = task.get("awards")
            if not isinstance(awards, list):
                raise RuntimeError("Taskmarket award schema")
            matches = [a for a in awards if a.get("submissionId") == submission_id
                       and str(a.get("workerAddress", "")).lower() == ADDRESS.lower()]
            print("Taskmarket " + label + ": " + str(task.get("status", "unknown")) +
                  "; matching awards=" + str(len(matches)), flush=True)
            for award in matches:
                tx = str(award.get("settlementTxHash") or "")
                if not award.get("settledAt") or not TX_RE.fullmatch(tx):
                    continue
                units = str(award.get("workerPayment") or "")
                if not re.fullmatch(r"[0-9]{1,6}", units) or not (0 < int(units) <= 500000):
                    continue
                receipts.append({"task": "Taskmarket " + label,
                                 "amount": Decimal(units) / 1000000, "tx": tx,
                                 "result_url": "https://api.taskmarket.dev/api/tasks/" + task_id + "/submissions?chainId=8453",
                                 "task_url": "https://taskmarket.dev/tasks/" + task_id})
        except Exception as err:
            print("Taskmarket source unavailable: " + label + " " + type(err).__name__, flush=True)
    return receipts

def notify(receipts):
    token = os.getenv("GITHUB_TOKEN")
    if not token or os.getenv("GITHUB_REPOSITORY") != REPO:
        print("No issue write token: read-only payout scan", flush=True)
        return
    url = "https://api.github.com/repos/" + REPO + "/issues/" + str(ISSUE) + "/comments"
    existing = read_json(url + "?per_page=100", token)
    announced = set()
    for comment in existing:
        if (comment.get("user") or {}).get("login") in ("github-actions[bot]", "ilhamraduanbis-source"):
            announced.update(x.lower() for x in MARKER_RE.findall(str(comment.get("body") or "")))
    for payout in receipts:
        if payout["tx"].lower() in announced:
            continue
        message = (
            "## Toyol — verified external USDC settlement\n\n"
            f"- Task: {payout['task']}\n"
            f"- Amount: {payout['amount']:.6f} USDC on Base\n"
            f"- Receiving public wallet: {ADDRESS}\n"
            f"- Result: {payout['result_url']}\n"
            f"- Task: {payout['task_url']}\n"
            f"- Transaction: https://basescan.org/tx/{payout['tx']}\n"
            f"- TOYOL-PAYOUT-TX {payout['tx']}\n\n"
            "Platform settlement matched a successful finalized Base USDC transfer to the Toyol wallet. "
            "This does NOT prove a MYR or TNG cashout."
        )
        req = urllib.request.Request(
            url, data=json.dumps({"body": message}).encode("utf-8"), method="POST",
            headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
                     "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28",
                     "User-Agent": "ToyolPayoutEvidence/1.0"}
        )
        with urllib.request.urlopen(req, timeout=18) as response:
            if response.status != 201:
                raise RuntimeError("Could not publish payout evidence")
        announced.add(payout["tx"].lower())
        print("New confirmed payout: notified owner through Toyol Issue #5.", flush=True)

def main():
    candidates = []
    for reader in (paid_to_toyol, frantic_paid, taskmarket_paid):
        try:
            candidates.extend(reader())
        except Exception as err:
            print("Source unavailable: " + reader.__name__ + " " + type(err).__name__, flush=True)
    paid = []
    checked = set()
    for item in candidates:
        # Multiple indexes may surface the same settlement. Check only once.
        key = (item["tx"].lower(), str(item["amount"]))
        if key in checked:
            continue
        checked.add(key)
        try:
            if check_base_transfer(item["tx"], item["amount"]):
                paid.append(item)
        except Exception:
            print("Chain proof unavailable; no payment notification.", flush=True)
    if not paid:
        print("No verified onchain USDC paid to Toyol on tracked tasks.", flush=True)
        return
    for record in paid:
        print(f"Paid: {record['amount']:.6f} USDC | https://basescan.org/tx/{record['tx']}", flush=True)
    notify(paid)

if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("Payout proof temporarily unavailable: " + str(err).splitlines()[0][:130], flush=True)
        sys.exit(1)
