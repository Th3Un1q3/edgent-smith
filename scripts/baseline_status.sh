#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 BASELINE_ID" >&2
  exit 2
fi

baseline_id="$1"
baseline_path="${baseline_id}.baseline.json"
candidate_path="${baseline_id}.baseline-candidate.json"

if [ ! -f "${candidate_path}" ]; then
  echo "Candidate file not found: ${candidate_path}" >&2
  exit 1
fi

candidate_score=$(python3 -c 'import json,sys; print(int(json.load(open(sys.argv[1]))["score"]))' "${candidate_path}")
if [ -f "${baseline_path}" ]; then
  baseline_score=$(python3 -c 'import json,sys; print(int(json.load(open(sys.argv[1]))["score"]))' "${baseline_path}")
else
  baseline_score=0
fi

passed=false
improved=false
if [ "${candidate_score}" -ge "${baseline_score}" ]; then
  passed=true
fi
if [ "${candidate_score}" -gt "${baseline_score}" ]; then
  improved=true
fi

cat <<EOF
{
  "baseline_id": "${baseline_id}",
  "score": ${candidate_score},
  "baseline": ${baseline_score},
  "passed": ${passed},
  "improved": ${improved}
}
EOF
