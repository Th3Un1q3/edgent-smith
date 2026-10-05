# Devcontainer OpenCode Installation

OpenCode is installed in the devcontainer via the official v2 installer:

```bash
curl -fsSL https://opencode.ai/v2/install | bash
```

This runs in `.devcontainer/setup-dev.sh`. The installer is non-interactive by construction (no read/prompt/tty) and installs to `$HOME/.opencode/bin` without touching PATH; devcontainer.json containerEnv PATH supplies that directory.

## Always-latest by design

The installer's `VERSION` env var is left UNSET, which resolves latest. This is a deliberate choice over the previous exact pin (`opencode-ai@1.18.32`).

## Install-only-when-missing

The installer is skipped when opencode is already present; no TTL, no re-run on every start.

## No npm fallback

On failure the script warns and continues.

## GOTCHA: env var through pipe

`VERSION=x curl ... | bash` sets the variable for curl only, NOT for bash. To pass an env var through a pipe you must `export` it first.

## Why the change

The old npm path existed because a devcontainer Feature hit unauthenticated GitHub REST API 403 rate limits on shared CI runner IPs; the v2 latest lookup goes through `https://opencode.ai/update/api/latest/cli/npm` instead.

## Historical context

Previously installed via `ghcr.io/devcontainers-extra/features/opencode:1` with exact release tag (e.g. "1.18.18"). A pin change required a container rebuild.