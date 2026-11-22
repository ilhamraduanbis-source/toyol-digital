#!/usr/bin/env bash
# One isolated, zero-deposit, contest-facing Toyol clone. NO wallet keys, trades, transfers or entry submissions.
set -euo pipefail
if [ "$(date -u +%Y%m%d%H%M)" -ge 202612141000 ]; then
  echo "TOKEN_RADAR_CLOSED: official 2026-12-14T10:00Z deadline has passed."
  exit 0
fi
root="$RUNNER_TEMP/tokenradar"
kit="$root/token-radar-01-kit"
entry="$root/entry"
evidence="$root/public-evidence"
tools="$root/tools"
mkdir -p "$root" "$entry" "$evidence"
# Preserve safe reproducible code and captured browser diagnostics on failure.
# Never upload plaintext model sessions, prompt stores, wallet material or API secrets.
toyol_radar_exit() {
  local result=$?
  if [ "$result" -ne 0 ]; then
    echo "TOKEN_RADAR_FAILURE_DIAGNOSTIC exit=$result"
    if [ -f "$entry/main.ts" ]; then
      tar -czf "$evidence/failed-source-debug.tar.gz" \
        --exclude='.git' --exclude='.makefun' --exclude='opencode.json' \
        -C "$entry" main.ts lib dashboard screenshots 2>/dev/null || true
    fi
    if [ -f "$entry/screenshots/capture-debug.jpg" ]; then
      cp "$entry/screenshots/capture-debug.jpg" "$evidence/capture-debug.jpg" || true
    fi
  fi

  # Preserve ORIGINAL OpenCode records encrypted with the owner's public certificate.
  # Never expose plaintext session records or a private decryption key in GitHub.
  if [ -d "$root/isolated-home/.local/share/opencode" ] || [ -s "$root/agent-turn-1.jsonl" ]; then
    local session_dir="$root/native-records"
    mkdir -p "$session_dir"
    for f in agent-turn-1.jsonl agent-turn-2.jsonl agent-turn-1.stderr agent-turn-2.stderr bundle-dryrun.log; do
      if [ -f "$root/$f" ]; then cp "$root/$f" "$session_dir/$f"; fi
    done
    if [ -d "$root/isolated-home/.local/share/opencode" ]; then
      cp -a "$root/isolated-home/.local/share/opencode" "$session_dir/opencode-native-data"
    fi
    if [ -d "$root/isolated-home/.local/state/opencode" ]; then
      cp -a "$root/isolated-home/.local/state/opencode" "$session_dir/opencode-native-state"
    fi
    if [ -f "$entry/opencode.json" ]; then cp "$entry/opencode.json" "$session_dir/opencode-config.json"; fi
    cat > "$root/recipient-cert.pem" <<'TOKENRADAR_PUBLIC_CERT'
-----BEGIN CERTIFICATE-----
MIIEMzCCApugAwIBAgIUG9UD31Qoend00i0D/1wneYHVgv8wDQYJKoZIhvcNAQEL
BQAwKTEnMCUGA1UEAwweVG95b2wgVG9rZW5SYWRhciBFdmlkZW5jZSBPbmx5MB4X
DTI2MTEyMjEyMDQxN1oXDTI4MTEyMTEyMDQxN1owKTEnMCUGA1UEAwweVG95b2wg
VG9rZW5SYWRhciBFdmlkZW5jZSBPbmx5MIIBojANBgkqhkiG9w0BAQEFAAOCAY8A
MIIBigKCAYEAuRh3pGsxdciKJsu28+7dDG4uFfqiRcF6NLHjkxpmX2U2UlTa72Jm
t7iOwBOqJYA7aoqD6VRhz6t/n19AzZri8hHZNmNjsJrR1tUmoFH6A3geU5T9aOdI
7x460FgPu79a0DzKeN/EhhgLyOmgAdX5ENuGfuZ3F++p7Sow06sZIawkhmEQgLDH
3L1QG3yvSEMOGaiRbE16m0ucfugnrg7SOhLFTwseUhneGAuLVHDHFglG+hWxEi+y
1nrLMaSbqgPBKAGTrxA1+YUHTygoojngCBXk+EXb43YMWR4Bj75pElp6jkBfg/kI
P0sAPhPiKhrEPVjEkckLTAnTrtYTxZZQ0jj+D9TdujevREA6/kjTN5m2JBvj6O4d
MafECPA+/Jor3wk/wl66lvaZZssAvhwaElUQGzC/TLPmST/Nv65oYIvcv90OjpNa
fyJ4m03H11LfKU4Vk9Mn18NkcdJFxutavLMjHqxEuMTGlV8uBB71PwokNaM/wNF0
hCD0RsaxFLvdAgMBAAGjUzBRMB0GA1UdDgQWBBQQkVR28Q+svbII/rZtD8lt8Udm
sTAfBgNVHSMEGDAWgBQQkVR28Q+svbII/rZtD8lt8UdmsTAPBgNVHRMBAf8EBTAD
AQH/MA0GCSqGSIb3DQEBCwUAA4IBgQApi+b8oXZC+SlYAhDUEO4X/vOIKuIb1Jsc
TF3zr+zbtRzQjKyG13+/Um7L2r52PWerza8zAMADsyoP3gfuaDTMj+BeZJ2cAbGs
HtzSkkPQYKDfY0xbP2nq13azNcOrvzk9iGKlAOZYmRpkumTdKCpgIvQnzcMgbnkU
jk/yBip3PBFFrO1k7Z1GTAwXpp2LolHANc2JXFR7iO1le3OHBCuI1bXPOpeB6uvo
KdJyXVOX4oXxYq7JwI35AyathDkLFogrrk/TkzBbci9kSl7YUJhcA3h/KodCa/fs
sI2WT+3cg8+nDVwmE15m9mkd/+EvMhcVCtwGoaMeJxdpmlvukJy9JXql7MUSAJzi
K0HjgQx5fSBJC8vZzxh5Rh6+L/EK/AbXEuurkw+b5SxKKlYY6Ei4kPvPUr0nbiil
wSUDBz2BUMtsIJ0e9npLp73KrV81bRdVS7m/8dCE9Lxi2R9eTDbjgcHrz49QHcRo
IFtv3SpIeJaDi0e2lOamhbnI+RaToCw=
-----END CERTIFICATE-----
TOKENRADAR_PUBLIC_CERT
    tar -czf "$root/native-records.tar.gz" -C "$root" native-records
    if openssl cms -encrypt -aes-256-gcm -binary -outform DER \
      -in "$root/native-records.tar.gz" \
      -out "$evidence/tokenradar-authentic-sessions.p7m" \
      -recip "$root/recipient-cert.pem"; then
      echo 'AUTHENTIC_AGENT_RECORDS_ENCRYPTED true (eligibility still needs official bundle verification)'
    else
      echo 'AUTHENTIC_AGENT_RECORDS_ENCRYPTION_FAILED'
      return 1
    fi
    rm -f "$root/native-records.tar.gz"
    rm -rf "$session_dir"
  else
    echo 'AUTHENTIC_AGENT_RECORDS_ABSENT; no paid-entry eligibility established'
  fi
}
trap toyol_radar_exit EXIT
export TOYOL_TOOLS_DIR="$tools"
echo "PRECONDITION Node $(node -v)"
node -e "let [a,b]=process.versions.node.split('.').map(Number); if(a<22 || (a===22 && b<18)) process.exit(1)"
command -v git >/dev/null
export CHROME_BIN="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
test -x "$CHROME_BIN"
echo "PRECONDITION CHROME_BIN_PRESENT"

# Fetch official live kit, validate every archive member before extraction.
curl -fsSL --retry 2 --connect-timeout 15 --max-time 75 \
  https://make.fun/c/token-radar-01/kit -o "$root/kit.tar.gz"
python3 - "$root" <<'PY'
import pathlib,tarfile,sys
root=pathlib.Path(sys.argv[1])
with tarfile.open(root/'kit.tar.gz','r:gz') as t:
    members=t.getmembers()
    total=sum(m.size for m in members)
    if total>100_000_000 or any(m.name.startswith('/') or '..' in pathlib.PurePosixPath(m.name).parts or not(m.isfile() or m.isdir()) for m in members):
        raise SystemExit('UNSAFE_KIT')
    t.extractall(root,filter='data')
print('KIT_MEMBERS',len(members),'KIT_UNPACKED_BYTES',total)
PY
test -f "$kit/starter/main.ts"
test -f "$kit/input/snapshot.json"
test -f "$kit/cli/makefun.mjs"

# Source-bundle route needs an official fresh git anchor before any entry code is edited.
cd "$entry"
node "$kit/cli/makefun.mjs" init \
  --competition token-radar-01 \
  --wallet At7TxA4e81Ai8X2TWZq944NSSbP1HaJB9iRug4vD1uQ \
  --license MIT | tee "$evidence/init.log"
find "$kit/starter" -mindepth 1 -maxdepth 1 ! -name LICENSE -exec cp -r {} "$entry/" \;
git add main.ts lib dashboard screenshots vendor LICENSE
git -c user.name='Toyol Digital' -c user.email='toyol@users.noreply.github.com' \
  commit -qm 'Official kit baseline after anchored creation'
baseline="$(git rev-parse HEAD)"
echo "KIT_BASELINE_COMMIT $baseline"

# Model catalog and actual local availability must BOTH confirm zero-priced coding model.
export HOME="$root/isolated-home"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_STATE_HOME="$HOME/.local/state"
export XDG_CACHE_HOME="$HOME/.cache"
export OPENCODE_DISABLE_AUTOSHARE=true
mkdir -p "$HOME"
unset OPENAI_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY GOOGLE_API_KEY OPENROUTER_API_KEY OPENCODE_API_KEY GITHUB_TOKEN GH_TOKEN || true
npm install --prefix "$tools" --no-audit --no-fund \
  @opencode/cli@2.3.0 playwright@1.56.1 > "$evidence/npm-install.log" 2>&1
export PATH="$tools/node_modules/.bin:$PATH"
timeout 65s opencode models --standalone > "$root/models.txt" 2> "$root/models.stderr" || true
echo "MODEL_LIST_LINE_COUNT $(wc -l < "$root/models.txt")"
grep '^opencode/' "$root/models.txt" | head -n 12 || true
curl -fsSL --retry 1 --connect-timeout 10 --max-time 40 \
  https://models.dev/api.json -o "$root/prices.json"
python3 - "$root/models.txt" "$root/prices.json" > "$root/zero-price-models.txt" <<'PY'
import json,re,sys
seen=set(re.findall(r'opencode/[A-Za-z0-9_.-]+',open(sys.argv[1]).read()))
catalog=json.load(open(sys.argv[2])).get('opencode',{}).get('models',{})
free=[]
for k,v in catalog.items():
    c=v.get('cost',{})
    if ('opencode/'+k in seen and (k.endswith('-free') or k=='big-pickle')
        and c.get('input')==0 and c.get('output')==0):
        free.append(k)
preferred=['big-pickle','glm-5.3-flash-free','deepseek-v4.1-flash-free','minimax-m3.1-flash-free']
free.sort(key=lambda x:(preferred.index(x) if x in preferred else 99,x))
print('\n'.join('opencode/'+x for x in free[:5]))
PY
echo "ZERO_PRICE_CANDIDATES $(wc -l < "$root/zero-price-models.txt")"
model="$(head -n 1 "$root/zero-price-models.txt" || true)"
agent_changed=false
if [ -n "$model" ]; then
  echo "VERIFIED_ADVERTISED_ZERO_PRICE_MODEL $model"
  # Native Opencode sessions are written by the real coding harness. Do not edit/reconstruct logs.
  cat > "$entry/opencode.json" <<EOF
{"\$schema":"https://opencode.ai/config.json","model":"$model","small_model":"$model","share":"disabled","autoupdate":false,"permission":{"edit":"allow","read":"allow","bash":"allow","webfetch":"deny","websearch":"deny","external_directory":"allow"}}
EOF
  prompt="You are exactly one dedicated Toyol TokenRadar coding clone, working on the official make.fun token-radar-01 bounty. User mandate verbatim: Hantar 1 klon untuk build the best token launch radar. Boleh bina kemahiran bina token tu. FIRST run node $kit/cli/makefun.mjs init --competition token-radar-01 --wallet At7TxA4e81Ai8X2TWZq944NSSbP1HaJB9iRug4vD1uQ --license MIT and see its fresh-anchor result in your own recorded tool output, before code edits. Read $kit/RULES.txt, $kit/input/README.md, main.ts, lib/model.ts and dashboard. Make material changes NOW to the value model and/or dashboard to improve rank quality and transparency, not just narrative. Prioritize all 40 watchlist slugs, at least 100 ranked rows, explicit risk, costed farm steps, and genuinely offline board/detail/filter. Model is not token price or guaranteed airdrop. Only edit this fresh entry. No wallet keys, spending, swaps, launches or submission. Keep one codebase with honest tests."
  set +e
  timeout --kill-after=8s 390s opencode run --standalone --model "$model" \
    --format json "$prompt" </dev/null > "$root/agent-turn-1.jsonl" 2> "$root/agent-turn-1.stderr"
  rc1=$?
  set -e
  echo "ACTUAL_AGENT_TURN_1_EXIT $rc1"
  if [ "$rc1" -eq 0 ]; then
    set +e
    timeout --kill-after=8s 230s opencode run --standalone --continue \
      --model "$model" --format json \
      'Make a second substantive code revision. Audit formula sensitivity to growth and age, show uncertainty and reasoned farm costs, verify data and dashboard agree. Run the program with the sealed snapshot. Do not submit or imply a paid award.' \
      </dev/null > "$root/agent-turn-2.jsonl" 2> "$root/agent-turn-2.stderr"
    rc2=$?
    set -e
    echo "ACTUAL_AGENT_TURN_2_EXIT $rc2"
  fi
  git diff --check
  git add main.ts lib dashboard
  if ! git diff --cached --quiet; then
    git -c user.name='Toyol Digital' -c user.email='toyol@users.noreply.github.com' \
      commit -qm 'Recorded agent code and dashboard revisions'
    agent_changed=true
    echo 'ACTUAL_AGENT_SOURCE_CHANGE true'
  else
    echo 'ACTUAL_AGENT_SOURCE_CHANGE false — only baseline is available'
  fi
else
  echo 'NO_ADVERTISED_ZERO_PRICE_MODEL; baseline only, not a contest submission'
fi

# Official session evidence preflight: the contest does not pay entries
# built from reconstructed/handed-over logs. Never fake this gate.
# The original opencode session database is kept only in the ephemeral runner.
set +e
(cd "$kit" && node cli/makefun.mjs bundle --repo "$entry" --dry-run) \
  > "$root/bundle-dryrun.log" 2>&1
bundle_preflight_rc=$?
set -e
echo "OFFICIAL_BUNDLE_DRYRUN_EXIT $bundle_preflight_rc"
if [ "$bundle_preflight_rc" -eq 0 ]; then
  echo 'OFFICIAL_BUNDLE_DISCOVERY_COMPLETED; real transcript completeness and run context STILL unverified'
else
  echo 'OFFICIAL_BUNDLE_DISCOVERY_FAILED; no entry permitted without authentic complete sessions'
fi
# Print no raw transcript or source-path payload; those can contain private data.

# Generate the program's output using the real sealed snapshot.
mkdir -p "$entry/out" "$entry/out-replay"
node "$entry/main.ts" --input "$kit/input/snapshot.json" --output "$entry/out"

# Genuine screenshots from the actual output, not copied from the starter.
node "$GITHUB_WORKSPACE/ops/token-radar/capture.mjs" \
  "$entry/out" "$entry/screenshots"
# Replace starter screenshot files and stale output files: dossier caps allow at most four images.
find "$entry/screenshots" -maxdepth 1 -type f ! -name '*.jpg' -delete
rm -rf "$entry/out" "$entry/out-replay"
mkdir -p "$entry/out" "$entry/out-replay"
# The official program copies screenshots into freshly empty outputs and creates its dossier.
node "$entry/main.ts" --input "$kit/input/snapshot.json" --output "$entry/out"
node "$entry/main.ts" --input "$kit/input/snapshot.json" --output "$entry/out-replay"
python3 "$GITHUB_WORKSPACE/ops/token-radar/evaluate.py" \
  "$kit/input/snapshot.json" "$entry/out" | tee "$evidence/quality.json"
cmp "$entry/out/board.json" "$entry/out-replay/board.json"
cmp "$entry/out/dossier.json" "$entry/out-replay/dossier.json"
echo 'DETERMINISTIC_OUTPUT true'

# Keep entry source in a public-safe artifact, never raw native agent logs or wallet material.
git add screenshots
if ! git diff --cached --quiet; then
  git -c user.name='Toyol Digital' -c user.email='toyol@users.noreply.github.com' \
    commit -qm 'Captured real offline dashboard screenshots'
fi
mkdir -p "$evidence/screenshots"
cp "$entry/screenshots/"*.jpg "$evidence/screenshots/"
cp "$entry/out/board.json" "$evidence/board.json"
cp "$entry/out/dossier.json" "$evidence/dossier.json"
tar -czf "$evidence/source.tar.gz" --exclude=.git --exclude=opencode.json \
  --exclude=out --exclude=out-replay -C "$entry" .
# Native Git bundle is also saved for the kit's supported source-bundle route.
git bundle create "$evidence/source.bundle" HEAD
git bundle verify "$evidence/source.bundle"
echo 'SOURCE_GIT_BUNDLE_VERIFIED true'
printf 'competition=token-radar-01\nsource_commit=%s\nactual_agent_edits=%s\nsubmission=NO\nreward_paid=NO\n' \
  "$(git rev-parse HEAD)" "$agent_changed" | tee "$evidence/status.txt"
echo 'TOKEN_RADAR_BUILD_FINISHED; no on-chain transaction and no contest submission.'
