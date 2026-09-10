# Reference: Platform compatibility

Use this reference when you make `install.sh` portable across distros and architectures.

## When to load

Load when you write install logic, choose base images, or handle lifecycle scope.

## Vocabulary

- **base image** — the container image tested in `scenarios.json` or `--base-image`.
- **POSIX sh** — `/bin/sh` with no bashisms; Alpine `ash` implements this strict subset.
- **containerEnv** — env vars declared in `devcontainer-feature.json` injected into all container processes.
- **lifecycle scope** — the execution context of `install.sh` (root, image build) versus `postCreateCommand` (user, container start).

## Detect OS

Source `/etc/os-release` and read `ID`, `VERSION_ID`, and `VERSION_CODENAME`. Fail with a clear error on unsupported IDs.

```bash
set -e
. /etc/os-release
case "${ID}" in
  debian|ubuntu) echo "supported: ${ID} ${VERSION_ID}" ;;
  *) echo "unsupported OS: ${ID}" >&2; exit 1 ;;
esac
```

Exit code `1` with a message that names the supported base images.

## Detect architecture

Run `uname -m` and normalize to `amd64` or `arm64`. Map `x86_64` to `amd64` and `aarch64` to `arm64`.

```bash
arch="$(uname -m)"
case "${arch}" in
  x86_64) arch="amd64" ;;
  aarch64|arm64) arch="arm64" ;;
  *) echo "unsupported arch: ${arch}" >&2; exit 1 ;;
esac
echo "${arch}"
```

Use the normalized value to select release artifacts.

## Shell portability

Write `install.sh` with `#!/usr/bin/env sh` and POSIX constructs only. Alpine images lack `bash` by default.

```bash
#!/usr/bin/env sh
set -eu
if [ -z "${VERSION:-}" ]; then
  echo "VERSION not set" >&2
  exit 1
fi
```

Avoid `[[`, `((`, `source`, and `function` keywords.

## Package managers

Detect the manager from the OS; never invoke both `apt-get` and `apk` unconditionally.

```bash
. /etc/os-release
if [ "${ID}" = "alpine" ]; then
  apk add --no-cache curl ca-certificates
else
  apt-get update && apt-get install -y curl ca-certificates
  rm -rf /var/lib/apt/lists/*
fi
```

Clean the apt cache (`rm -rf /var/lib/apt/lists/*`) to keep image layers small.

## Base-image matrix

Test at least three bases: Ubuntu, Debian, and Alpine. Use current LTS releases.

| Base image | Manager | Shell | Notes |
|---|---|---|---|
| `mcr.microsoft.com/devcontainers/base:ubuntu` | `apt-get` | `bash` + `sh` | Default; broadest compatibility |
| `mcr.microsoft.com/devcontainers/base:debian` | `apt-get` | `bash` + `sh` | Smaller than Ubuntu |
| `alpine:3.19` | `apk` | `ash` (POSIX `sh`) | Requires POSIX script |

Pin scenario `image` fields to digests for reproducibility when possible.

## Lifecycle scope

Run privileged install work in `install.sh` as `root`. Reserve `postCreateCommand` for user-scoped setup that needs `_REMOTE_USER`.

```bash
# install.sh runs as root
echo "installing to /usr/local/bin as $(whoami)"
# postCreateCommand runs as remote user — do not install system packages there
```

Use `_REMOTE_USER` and `_REMOTE_USER_HOME` when writing to the non-root home.

## Canonical source

- Guide: [Feature authoring best practices](https://containers.dev/guide/feature-authoring-best-practices)
