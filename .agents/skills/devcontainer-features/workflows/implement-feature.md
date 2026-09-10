# Workflow: Implement a Feature

When to load: you scaffold src/<id>/, author devcontainer-feature.json, or write install.sh for a new or existing Feature. Load this workflow after design-feature.md approves the options schema.

## Prerequisites

- Design-feature.md approved decision, options (≤5), and platform matrix (4 images).
- Read [repo-layout](../references/repo-layout.md) for monorepo vs scoped layout.
- Read [feature-anatomy](../references/feature-anatomy.md) for install.sh contract.
- Read [platform-compatibility](../references/platform-compatibility.md) for OS detection.
- Install devcontainers CLI 0.56 or later and verify `devcontainer --version` returns a value.

## Order of Operations

1. Choose repo layout and scaffold. 2. Author devcontainer-feature.json. 3. Write POSIX install.sh. 4. Wire multi-version and PATH. 5. Validate locally. Follow the order. Do not write install.sh before the JSON passes schema validation.

## Steps

### 1. Choose repo layout and scaffold

Use a monorepo when you ship 3 or more Features. Use a scoped repo when you ship 1 Feature. Create src/<id>/ where id uses lowercase, digits, and hyphens, matches `^[a-z0-9][a-z0-9-]*$`.

Scaffold with feature-starter for monorepo. Scaffold with CLI for scoped repo. Create 2 files minimum: devcontainer-feature.json and install.sh.

```sh
# monorepo from feature-starter
gh repo clone devcontainers/feature-starter my-features
cd my-features
cp -R src/go src/mytool

# scoped repo via devcontainers CLI
npx @devcontainers/cli features create --id mytool --version 1.0.0
ls src/mytool/
```

Done when: src/<id>/ exists, id matches directory name, 2 files exist. Gate: id mismatch or missing install.sh, no proceed.

### 2. Author devcontainer-feature.json

Set id to match directory name. Set version to semver X.Y.Z starting at 0.1.0. Set name to 3 to 30 characters. Set description to 10 to 100 characters. Set options to 1 to 5 entries. Set installsAfter to 0 to 3 entries.

Validate JSON with json.loads before you commit. Keep the file under 100 lines.

```json
{
  "id": "mytool",
  "version": "0.1.0",
  "name": "My Tool",
  "description": "Installs mytool CLI with pinned version and PATH setup",
  "options": {
    "version": {
      "type": "string",
      "default": "latest",
      "description": "Version to install",
      "proposals": ["latest", "1.2.3"]
    },
    "installExtras": {
      "type": "boolean",
      "default": false,
      "description": "Install optional extras"
    }
  },
  "containerEnv": {
    "MYTOOL_HOME": "/usr/local/mytool"
  },
  "installsAfter": [
    "ghcr.io/devcontainers/features/common-utils:1"
  ]
}
```

Show a second valid variant with 1 option at minimum:

```json
{
  "id": "mytool",
  "version": "0.1.0",
  "name": "My Tool",
  "description": "Minimal valid Feature metadata",
  "options": {
    "version": {
      "type": "string",
      "default": "1.2.3",
      "description": "Version tag"
    }
  }
}
```

Done when: file parses, id equals dir name, version matches semver, options ≤5. Gate: parse failure or id mismatch, no proceed.

### 3. Write POSIX install.sh

Use `#!/bin/sh` with `set -e`. Source /etc/os-release. Detect ID and VERSION_ID. Handle apt, apk, and yum. Check `_REMOTE_USER` and own home files once. Make the script idempotent. Exit 0 on re-run when the requested version already exists.

Support 2 package managers minimum. Fail fast with message on unsupported OS.

```sh
#!/bin/sh
set -e

# source OS data
. /etc/os-release

VERSION="${VERSION:-latest}"
USERNAME="${_REMOTE_USER:-vscode}"

echo "Installing mytool ${VERSION} on ${ID} ${VERSION_ID}"

# idempotency: skip when version already installed
if command -v mytool >/dev/null 2>&1; then
  INSTALLED="$(mytool --version 2>/dev/null | head -n 1)"
  if [ "${INSTALLED#*${VERSION}}" != "${INSTALLED}" ]; then
    echo "mytool ${VERSION} already installed, skipping"
    exit 0
  fi
fi

# install dependencies per OS
case "${ID}" in
  debian|ubuntu)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update && apt-get install -y curl ca-certificates
    ;;
  alpine)
    apk add --no-cache curl ca-certificates
    ;;
  fedora|rhel|centos)
    yum install -y curl ca-certificates
    ;;
  *)
    echo "Unsupported OS: ${ID}"
    exit 1
    ;;
esac

# handle non-root user home ownership
if id "${USERNAME}" >/dev/null 2>&1; then
  mkdir -p "/home/${USERNAME}/.mytool"
  chown "${USERNAME}": /home/"${USERNAME}"/.mytool || true
fi

# download and install placeholder
curl -fsSL "https://example.com/mytool/${VERSION}/mytool.tar.gz" | tar -xz -C /usr/local/bin
chmod +x /usr/local/bin/mytool
```

Done when: script runs with `sh -n install.sh` with no syntax error, sources /etc/os-release, handles 2 package managers, checks _REMOTE_USER. Gate: shellcheck or sh -n fails, no proceed.

### 4. Wire multi-version and PATH via containerEnv

Support 3 versions via symlinks when version != latest. Link versioned binary to /usr/local/mytool/bin/<version>. Point /usr/local/bin/mytool to the selected version. Set containerEnv PATH to include the tool bin once.

Keep symlink logic idempotent. Create 1 containerEnv entry for PATH, append with `:${PATH}` placeholder.

```sh
#!/bin/sh
set -e
VERSION="${VERSION:-latest}"
TOOL_DIR="/usr/local/mytool"
BIN_DIR="${TOOL_DIR}/bin"

mkdir -p "${BIN_DIR}"

# example: install versioned binary then symlink
# curl -fsSL "https://example.com/mytool/${VERSION}/mytool" -o "${BIN_DIR}/mytool-${VERSION}"
# chmod +x "${BIN_DIR}/mytool-${VERSION}"
# ln -sf "${BIN_DIR}/mytool-${VERSION}" /usr/local/bin/mytool
echo "Symlink mytool ${VERSION} to /usr/local/bin/mytool"
```

Pair with devcontainer-feature.json containerEnv that exposes the path:

```json
{
  "id": "mytool",
  "version": "0.1.0",
  "name": "My Tool",
  "description": "Installs mytool with versioned symlink",
  "containerEnv": {
    "MYTOOL_HOME": "/usr/local/mytool",
    "PATH": "/usr/local/mytool/bin:${PATH}"
  }
}
```

Done when: containerEnv lists 1 PATH entry with :${PATH} suffix, install.sh creates symlinks idempotently, ln -sf runs without error on re-run. Gate: PATH missing or overwrite without append, revise.

### 5. Validate locally

Run json validation and shell syntax check. Run install.sh in 2 base images (debian and alpine). Confirm idempotency with 2 consecutive runs. Confirm non-root ownership with 1 chown check.

```sh
python3 -c "import json,sys; json.load(open('src/mytool/devcontainer-feature.json'))"
sh -n src/mytool/install.sh
shellcheck src/mytool/install.sh || sh -n src/mytool/install.sh

# local build check in 2 images
devcontainer features test --base-image mcr.microsoft.com/devcontainers/base:ubuntu --project-folder .
devcontainer features test --base-image mcr.microsoft.com/devcontainers/base:alpine --project-folder .
```

Done when: JSON parses, sh -n passes, 2 image tests exit 0, second run exits 0. Gate: any local test fails, no publish.

## Acceptance Criteria

- src/<id>/ exists, id matches `^[a-z0-9][a-z0-9-]*$`, version is semver X.Y.Z.
- devcontainer-feature.json has 1 to 5 options, each with type and default, parses, ≤100 lines.
- install.sh uses #!/bin/sh, set -e, sources /etc/os-release, handles 2 package managers, checks _REMOTE_USER, is idempotent, runs sh -n clean.
- Multi-version uses ln -sf symlink, containerEnv sets PATH with :${PATH} once.
- Local validation passes in 2 images, 2 consecutive runs, no error on unsupported OS without message.

## References

- [repo-layout](../references/repo-layout.md)
- [feature-anatomy](../references/feature-anatomy.md)
- [platform-compatibility](../references/platform-compatibility.md)
