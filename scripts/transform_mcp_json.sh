#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 [INPUT_JSON] [OUTPUT_JSON]

Transforms an input mcp.json (with top-level "servers") into the copilot-style
mcp-config format (top-level "mcpServers").

Defaults:
  INPUT_JSON  -> .vscode/mcp.json
  OUTPUT_JSON -> .copilot/mcp-config.json

Requires: jq
EOF
  exit 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

INFILE="${1:-.vscode/mcp.json}"
OUTFILE="${2:-.copilot/mcp-config.json}"

command -v jq >/dev/null 2>&1 || { echo "Error: jq not found. Install jq and retry." >&2; exit 2; }

if [[ ! -f "$INFILE" ]]; then
  echo "Error: input file '$INFILE' not found" >&2
  exit 3
fi

mkdir -p "$(dirname "$OUTFILE")"

# jq filter:
# - take .servers (or {})
# - convert to entries and for each server ensure a default tools:["*"] when missing
# - rebuild object and place under top-level mcpServers
jq '
  .servers as $s
  | { mcpServers: ( ($s // {})
      | to_entries
      | map(
          . as $entry
          | ($entry.value) as $v
          # Extract headers that reference env vars like ${env:NAME}
          | ($v.headers // {}) as $hdrs
          | ($hdrs
              | to_entries
              | map(select(.value | test("^\\$\\{env:[A-Za-z0-9_]+\\}$"))
                    | { (.key): ( .value | capture("^\\$\\{env:(?<n>[A-Za-z0-9_]+)\\}$") | .n | "$"+.) })
              | add // {}) as $env_from_headers
            # Transform headers: replace ${env:NAME} -> "$NAME"
            | ($hdrs
              | to_entries
              | map( { (.key): ( if (.value | test("^\\$\\{env:[A-Za-z0-9_]+\\}$"))
                      then ( .value | capture("^\\$\\{env:(?<n>[A-Za-z0-9_]+)\\}$") | .n | "$"+.)
                      else .value end ) } )
              | add // {}) as $transformed_headers
            # Build new server object: copy original, set transformed headers, ensure tools present
            | ($v + ( if ($v|type=="object" and ($v|has("tools"))) then {} else { tools: ["*"] } end )) as $with_tools
            | ( if ($transformed_headers | length) > 0 then $with_tools + { headers: $transformed_headers } else ($with_tools | del(.headers)) end )
            | { ($entry.key): . }
        )
      | add // {} ) }
' "$INFILE" >"$OUTFILE".tmp && mv "$OUTFILE".tmp "$OUTFILE"

echo "Wrote $OUTFILE"
