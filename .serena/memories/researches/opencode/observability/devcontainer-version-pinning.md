# Devcontainer OpenCode Version Pinning

opencode is installed in the devcontainer via ghcr.io/devcontainers-extra/features/opencode:1 with “version” = exact release tag (no v prefix), e.g. “1.18.18”; the feature delegates to gh-release.

`opencode upgrade <version> --method curl` exists for non-interactive in-place upgrade, but feature-installed binaries report method “unknown” and prompt interactively without --method. A pin change requires a container rebuild to take effect.

Verified: bumped 1.18.13 → 1.18.18 on 2026-08-19; bugfix-only release, no telemetry change.