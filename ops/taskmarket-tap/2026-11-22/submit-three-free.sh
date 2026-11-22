#!/data/data/com.termux/files/usr/bin/bash
# One-time, no-deposit attempt for three ORIGINAL text-bounty deliverables.
# The phone's existing, TAP-verified Tempo wallet signs; NO secrets leave this device.
set -euo pipefail
export PATH="$PREFIX/bin:$PATH"
command -v taskmarket >/dev/null || { echo "CLI_MISSING"; exit 1; }
command -v node >/dev/null || { echo "NODE_MISSING"; exit 1; }
command -v curl >/dev/null || { echo "CURL_MISSING"; exit 1; }
mkdir -p "$HOME/toyol-tap-free"
cd "$HOME/toyol-tap-free"

# Do not proceed unless the actual local keystore's TAP key matches a verifier record.
taskmarket --network tempo tap show > tap-status.json
node --input-type=module -e '
import {readFileSync} from "node:fs";
const j=JSON.parse(readFileSync("tap-status.json","utf8"));
const x=j.data||{};
if(j.ok!==true || x.enrolled!==true || !x.keyId || x.chainId!==4217 ||
 x.status?.resolves!==true || x.status?.trust!=="verified" || x.status?.matches!==true){
 console.error("STOP: local TAP is not verified / matched");process.exit(1)
}
console.log("TAP_VERIFIED_FOR_TEMPO",x.keyId)
'
rm -f tap-status.json

raw="https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/main/ops/taskmarket-tap/2026-11-22"
fetch() {
 local file="$1" sha="$2"
 curl --fail --silent --show-error --location --retry 2 --connect-timeout 10 --max-time 25 \
   "$raw/$file" -o "$file"
 echo "$sha  $file" | sha256sum -c --status || { echo "STOP: file hash mismatch $file"; exit 1; }
}

try_one() {
 local id="$1" file="$2" sha="$3" attempt_marker=".attempted-$1"
 if [[ -e "$attempt_marker" ]]; then
   echo "SKIP_ALREADY_ATTEMPTED $id"; return
 fi
 fetch "$file" "$sha"

 # Decline a changed task, unavailable reward, or near-exhausted free capacity.
 if ! TASK_ID="$id" node --input-type=module -e '
const id=process.env.TASK_ID;
const ctrl=AbortSignal.timeout(16000);
const r=await fetch("https://api.taskmarket.dev/api/tasks/"+id,{signal:ctrl});
if(!r.ok){console.error("TASK_LOOKUP_FAILED",r.status);process.exit(1)}
const j=await r.json();
const ok=j.id===id && j.chainId===4217 && j.mode==="bounty" && j.status==="open" &&
 j.reward==="10000" && j.stakeRequired!==true && Array.isArray(j.verifiedBy) &&
 j.verifiedBy.includes("tap:identity:verified") &&
 Number.isInteger(j.submissionCount) && j.submissionCount < 40 &&
 Date.parse(j.expiryTime)>Date.now()+120000;
if(!ok){console.error("SKIP_UNSAFE_OR_CLOSED",id,j.status,j.submissionCount,j.reward);process.exit(1)}
console.log("FREE_ENTRY_PREFLIGHT",id,"submissions="+j.submissionCount,"reward=0.01 OUSD")
'; then
   echo "SKIP_PREFLIGHT $id"; return
 fi
 # A marker is written BEFORE any network mutation. A retry cannot accidentally
 # make extra submissions or pay fees for the same bounty.
 printf '%s\n' "$(date -u +%FT%TZ)" > "$attempt_marker"
 echo "SUBMITTING_ONCE $id"
 if taskmarket --network tempo task submit "$id" --file "$file" > "receipt-$file.json" 2> "error-$file.log"; then
   echo "SUBMISSION_COMMAND_SUCCEEDED $id"
   cat "receipt-$file.json"
 else
   echo "SUBMISSION_UNCONFIRMED_OR_FAILED $id — not retrying automatically"
   cat "error-$file.log"
 fi
}

try_one "0x517d39c0ef45232241e982a241aee10eaf173be86aba5eaf3c06876057805789" \
  "bakery-tagline.txt" "f3d7f63666ec934b443b43ae2466a39253eac9544859d2af060fb081c0bcc18c"
try_one "0x6aa226831709d2be04f1da9aeb787da584e1896748568c13c50c4526a0bb87b9" \
  "rainy-morning-poem.txt" "7c13108ac4ab971c1bbe45fa57a94a9193d438bf3b459a101c1a98bb5e8185da"
try_one "0x41715259edd01389c4d96c6274a8bf14a1d89883c05104c966acfea9cb430344" \
  "candle-tagline.txt" "9bfdc17fb84239e01b94086fb5449a96c14d3df0c6809358b273d45109bfbd46"

echo "DONE. An accepted contest winner is required for OUSD earnings."
echo "Review receipt-*.json. A submission receipt is NOT a payout receipt."
