#!/usr/bin/env bash
# Opt-in execution after verified NO-COST TestMu promotional credits and owner login.
set -euo pipefail
if [[ "${KANE_FREE_CREDITS_CONFIRMED:-}" != "YES" ]]; then
  echo "BLOCKED: confirm the TestMu account has adequate FREE credits, then export KANE_FREE_CREDITS_CONFIRMED=YES"
  exit 3
fi
if ! command -v kane-cli >/dev/null; then
  echo "BLOCKED: install npm package @testmuai/kane-cli. Do not use a paid plan."
  exit 3
fi
LAB="${1:-}"
if [[ ! -f "$LAB/web/index.html" ]]; then
  echo "Usage: bash run_free_only.sh PATH_TO_EXTRACTED/toyol-five-track-lab"
  exit 3
fi
cd "$LAB"
python3 -m http.server 8765 --bind 127.0.0.1 --directory web >/tmp/toyol-kane-http.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 2
# Genuine Kane CLI invocation. Requires prior interactive kane-cli login by owner.
kane-cli run --url http://127.0.0.1:8765 "Verify ProofDesk five tracks, Smart glasses filter, HUD next button, empty-input error and device-only cloud block" --agent
