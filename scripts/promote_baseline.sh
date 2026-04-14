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

if [ ! -f "${baseline_path}" ]; then
  cp "${candidate_path}" "${baseline_path}"
  rm -f "${candidate_path}"
  echo "Baseline created from candidate: ${baseline_path}"
  exit 0
fi

candidate_score=$(python3 -c 'import json,sys; print(int(json.load(open(sys.argv[1]))["score"]))' "${candidate_path}")
baseline_score=$(python3 -c 'import json,sys; print(int(json.load(open(sys.argv[1]))["score"]))' "${baseline_path}")

if [ "${candidate_score}" -gt "${baseline_score}" ]; then
  cp "${candidate_path}" "${baseline_path}"
  rm -f "${candidate_path}"
  echo "Baseline promoted: ${baseline_score} → ${candidate_score}"
else
  echo "Baseline not promoted: candidate score ${candidate_score} ≤ baseline score ${baseline_score}"
fi
