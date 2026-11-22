#!/data/data/com.termux/files/usr/bin/bash
# One zero-deposit, TAP-verified submission to TaskMarket's open weather riddles bounty.
# Uses existing phone-based TAP wallet. Does not expose private keys or authorize x402 fees.
set -euo pipefail
TASK='0x25de63657a62037da1338318a20f55354ae184c0829712da5af661e59c7395a7'
BASE='https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/967497e41c7b8729e94a84df3281b0cec7555f54/ops/taskmarket-tap/2026-11-22'
DIR="$HOME/toyol-tap-free"
mkdir -p "$DIR"
cd "$DIR"
if [[ -e ".attempted-weather-riddles" ]]; then echo "Already attempted. Never send duplicate contest entries."; exit 0; fi
command -v taskmarket >/dev/null || { echo "Taskmarket CLI missing"; exit 1; }
taskmarket --network tempo tap show > status-weather.json
node --input-type=module -e '
import {readFileSync} from "node:fs";
const j=JSON.parse(readFileSync("status-weather.json","utf8"));
const v=j.data||{};
if(!j.ok||v.enrolled!==true||v.chainId!==4217||v.status?.resolves!==true||v.status?.trust!=="verified"||v.status?.matches!==true){
console.error("STOP: TAP not currently verified");process.exit(1)
} console.log("TAP_VERIFIED",v.keyId)
'
rm status-weather.json
node --input-type=module -e '
const id="0x25de63657a62037da1338318a20f55354ae184c0829712da5af661e59c7395a7";
const r=await fetch("https://api.taskmarket.dev/api/tasks/"+id,{signal:AbortSignal.timeout(16000)});
if(!r.ok)process.exit(1);
const j=await r.json();
if(!(j.id===id && j.status==="open" && j.chainId===4217 &&
 j.mode==="bounty" && j.reward==="100000" && j.stakeRequired===false &&
 j.hasAccessPassword!==true && j.verifiedBy?.includes("tap:identity:verified") &&
 Number(j.submissionCount)<75 && Date.parse(j.expiryTime)>Date.now()+120000)) {
 console.error("STOP: closed/changed/too crowded/spend gate",j.status,j.submissionCount);process.exit(1)
}
console.log("FREE_ENTRY_CHECKED_0_10_OUSD",j.submissionCount)
'
curl -fsSL --retry 2 --connect-timeout 15 --max-time 40 \
 "$BASE/five-weather-riddles.txt" -o five-weather-riddles.txt
[[ $(grep -c "^Answer:" five-weather-riddles.txt) -eq 5 ]] || { echo "STOP: content incomplete"; exit 1; }
# Forbid any paid x402 policy on this process.
printf '%s\n' '{ "version": "DENY_ALL_PAID_ACTIONS" }' > .deny-fees-policy.json
chmod 600 .deny-fees-policy.json
export TASKMARKET_X402_POLICY_PATH="$PWD/.deny-fees-policy.json"
date -u +%FT%TZ > .attempted-weather-riddles
if taskmarket --network tempo task submit "$TASK" --file five-weather-riddles.txt > receipt-weather-riddles.json 2> error-weather-riddles.log; then
 echo "SUBMISSION_ACCEPTED_BY_API";cat receipt-weather-riddles.json
else
 echo "SUBMISSION_FAILED_OR_UNCONFIRMED (no automatic retries)"
 cat error-weather-riddles.log
 exit 1
fi
echo 'Prize is winner-only; no payment is confirmed until award settles.'
