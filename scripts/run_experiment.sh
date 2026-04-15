#!/usr/bin/env bash
# Usage: PROMPT=<prompt> [MODEL=<model>] bash scripts/run_experiment.sh
#
# Inputs (environment variables):
#   MODEL   — Optional; Copilot model name to pass to the CLI (default: gpt-5-mini)
#   PROMPT  — Full prompt string to send to the Copilot CLI
set -euo pipefail

# Default MODEL to gpt-5-mini when not provided
MODEL="${MODEL:-gpt-5-mini}"
: "${PROMPT:?PROMPT environment variable is required}"

# ── Invoke Copilot CLI ────────────────────────────────────────────────────────
copilot \
  --agent implement \
  --autopilot \
  --model "$MODEL" \
  --prompt "$PROMPT" \
  --allow-all-tools \
  --deny-tool='shell(git push)' \
  --deny-tool='shell(git commit)' \
  --deny-tool='shell(git checkout)'

just fix --continue

# -- Check ollama status.
just ollama-status

# ── Run evaluations; generate baseline candidate ───────────────────────────
baseline_id="${BASELINE_ID:-auto_research}"
baseline_path="${baseline_id}.baseline.json"
candidate_path="${baseline_id}.baseline-candidate.json"
base_prompt="${PROMPT}"

# Helper: truthy check for DRY_RUN and similar flags
is_truthy() {
  v="${1:-}"
  # lowercase (bashism) then match common falsy values
  v="${v,,}"
  case "${v}" in
    ""|"0"|"false"|"no") return 1 ;;
    *) return 0 ;;
  esac
}

# Create a dry-run candidate file based on the current baseline (helper).
create_dry_candidate() {
  if [ -f "${baseline_path}" ]; then
    baseline_score=$(python3 -c 'import json,sys; print(int(json.load(open(sys.argv[1]))["score"]))' "${baseline_path}" 2>/dev/null || echo 0)
  else
    baseline_score=0
  fi
  if [ "${baseline_score}" -gt 0 ]; then
    candidate_score=$((baseline_score - 1))
  else
    candidate_score=0
  fi
  env CAND_SCORE="${candidate_score}" BASE_PROMPT="${base_prompt}" python3 - <<'PY' > "${candidate_path}"
import json,datetime,os,sys
score = int(os.environ.get('CAND_SCORE','0'))
prompt = os.environ.get('BASE_PROMPT','')
data = {"score": score, "prompt": prompt, "dry_run": True, "timestamp": datetime.datetime.utcnow().isoformat() + "Z"}
json.dump(data, sys.stdout)
PY
  echo "Dry-run: wrote candidate to ${candidate_path} (score=${candidate_score})"
}

# If DRY_RUN is set, generate a static candidate file and skip the heavy evals.
if is_truthy "${DRY_RUN:-}"; then
  create_dry_candidate
else
  just eval-ci "${baseline_id}"
fi

followup_limit="${FOLLOWUP_LIMIT:-}"
if [ -n "${followup_limit}" ] && [ "${followup_limit}" -gt 0 ]; then
  followup_count=0

  while true; do
    status_json="$(just baseline-status "${baseline_id}")"
    improved="$(python3 - <<'PY'
import json,sys
try:
    data=json.load(sys.stdin)
    print("true" if data.get("improved") else "false")
except Exception:
    sys.exit(1)
PY
<<<"${status_json}")"

    if [ "${improved}" = "true" ]; then
      echo "Baseline improved; no further follow-up required."
      break
    fi

    if [ "${followup_count}" -ge "${followup_limit}" ]; then
      echo "Reached FOLLOWUP_LIMIT=${followup_limit}; stopping follow-up attempts."
      break
    fi

    followup_count=$((followup_count + 1))
    echo "Follow-up attempt ${followup_count}/${followup_limit}: previous candidate did not improve the baseline."

    # Build a concise follow-up prompt that asks the agent to inspect the
    # baseline files rather than embedding a large diff in the CLI args.
    followup_prompt=$'The prior experiment candidate failed to improve the baseline score. Please revise the change using the same task, focusing on improving the generated baseline candidate.\n\n'
    followup_prompt+="Please inspect the baseline and candidate files for scoring details and differences:\n"
    followup_prompt+="Baseline: $(cat "${baseline_path}")\n"
    followup_prompt+="Candidate: $(cat "${candidate_path}")\n\n"

    # Build copilot args and invoke; keep --continue to resume sessions when available.
    copilot_args=( --agent implement --autopilot --continue --model "${MODEL}" )
    copilot_args+=( --prompt "${followup_prompt}" --allow-all-tools \
      --deny-tool='shell(git push)' --deny-tool='shell(git commit)' --deny-tool='shell(git checkout)')

    copilot "${copilot_args[@]}"


    just fix --continue

    # -- Check ollama status.
    just ollama-status

    if is_truthy "${DRY_RUN:-}"; then
      create_dry_candidate
    else
      just eval-ci "${baseline_id}"
    fi
  done
else
  just baseline-status "${baseline_id}"
fi

