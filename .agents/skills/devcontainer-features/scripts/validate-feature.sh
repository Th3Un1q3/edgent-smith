#!/usr/bin/env bash
# Validate a devcontainer Feature at src/<feature-id>
# Checks: JSON schema, install.sh executable, POSIX sh, shellcheck
set -eu

FEATURE_ID="${1:-}"
if [ -z "${FEATURE_ID}" ]; then
  echo "usage: $0 <feature-id>" >&2
  exit 1
fi

FEATURE_DIR="src/${FEATURE_ID}"
FEATURE_JSON="${FEATURE_DIR}/devcontainer-feature.json"
INSTALL_SH="${FEATURE_DIR}/install.sh"
SCHEMA_URL="https://raw.githubusercontent.com/devcontainers/spec/main/schemas/devContainerFeature.schema.json"
SCHEMA_FILE="${SCHEMA_FILE:-/tmp/devContainerFeature.schema.json}"

if [ ! -f "${FEATURE_JSON}" ]; then
  echo "missing ${FEATURE_JSON}" >&2
  exit 1
fi

if [ ! -f "${INSTALL_SH}" ]; then
  echo "missing ${INSTALL_SH}" >&2
  exit 1
fi

# 1. Executable check
if [ ! -x "${INSTALL_SH}" ]; then
  echo "not executable: ${INSTALL_SH} (run chmod +x ${INSTALL_SH})" >&2
  exit 1
fi
echo "ok: executable ${INSTALL_SH}"

# 2. Shebang check — prefer POSIX sh
if ! head -n1 "${INSTALL_SH}" | grep -qE '^#!/usr/bin/env sh|^#!/bin/sh'; then
  echo "warn: ${INSTALL_SH} shebang should be #!/usr/bin/env sh for Alpine compatibility" >&2
fi

# 3. JSON syntax check with python3
if command -v python3 >/dev/null 2>&1; then
  if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "${FEATURE_JSON}"; then
    echo "invalid JSON: ${FEATURE_JSON}" >&2
    exit 1
  fi
  echo "ok: JSON parses ${FEATURE_JSON}"
fi

# 4. Schema validation with ajv when available
if command -v ajv >/dev/null 2>&1 || command -v npx >/dev/null 2>&1; then
  # cache schema
  if [ ! -f "${SCHEMA_FILE}" ]; then
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "${SCHEMA_URL}" -o "${SCHEMA_FILE}" || echo "warn: could not fetch schema" >&2
    elif command -v wget >/dev/null 2>&1; then
      wget -q "${SCHEMA_URL}" -O "${SCHEMA_FILE}" || echo "warn: could not fetch schema" >&2
    fi
  fi
  if [ -f "${SCHEMA_FILE}" ]; then
    if command -v ajv >/dev/null 2>&1; then
      if ! ajv validate -s "${SCHEMA_FILE}" -d "${FEATURE_JSON}" --strict=false; then
        echo "schema validation failed: ${FEATURE_JSON}" >&2
        exit 1
      fi
    elif command -v npx >/dev/null 2>&1; then
      if ! npx --yes ajv-cli validate -s "${SCHEMA_FILE}" -d "${FEATURE_JSON}" --strict=false; then
        echo "schema validation failed: ${FEATURE_JSON}" >&2
        exit 1
      fi
    fi
    echo "ok: schema ${FEATURE_JSON}"
  fi
else
  echo "skip: ajv not found, syntax check only"
fi

# 5. shellcheck when available
if command -v shellcheck >/dev/null 2>&1; then
  if ! shellcheck -S warning -s sh "${INSTALL_SH}"; then
    echo "shellcheck failed: ${INSTALL_SH}" >&2
    exit 1
  fi
  echo "ok: shellcheck ${INSTALL_SH}"
else
  echo "skip: shellcheck not found"
  # fallback: check for bashisms
  if grep -qE '\[\[|\(\(|\<\(|function |source ' "${INSTALL_SH}"; then
    echo "warn: possible bashism in ${INSTALL_SH}" >&2
  fi
fi

echo "done: ${FEATURE_ID} valid"
