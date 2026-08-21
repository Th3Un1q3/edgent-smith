# Dependabot Configuration Best Practices (2026)

Verified against: official JSON schema (json.schemastore.org/dependabot-2.0.json, fetched 2026-08-20), GitHub Docs configuration-options + options-reference + supported-ecosystems pages, GitHub Changelog.

## Schema (dependabot.yml, version: 2)
- Top-level keys: version (required, 2), updates (required, array), enable-beta-ecosystems (boolean; docs say "Not currently in use"), registries, multi-ecosystem-groups (NEW: object defining groups spanning ecosystems).
- Per-update keys (24): package-ecosystem, directory | directories (NEW array; supports globs/wildcards, directory does not), name (NEW), schedule, groups, open-pull-requests-limit (default 5), labels (default ["dependencies"]), assignees, reviewers, milestone, target-branch, versioning-strategy, commit-message, ignore, allow, rebase-strategy (auto|disabled, default auto), vendor, insecure-external-code-execution (allow|deny; bundler, mix, pip), registries (array of names or "*"), exclude-paths (NEW), cooldown (NEW: default-days/semver-major-days/semver-minor-days/semver-patch-days/include/exclude; version updates only; default cooldown 3 days after release), pull-request-branch-name (separator: -|_|/), patterns + multi-ecosystem-group (for multi-ecosystem groups).
- schedule.interval enum: daily | weekly | monthly | quarterly | semiannually | yearly | cron. day enum: monday..sunday. time hh:mm, timezone IANA. cron adds cronjob property.
- versioning-strategy enum: auto | increase | increase-if-necessary | lockfile-only | widen. Supported by: bundler, cargo, composer, helm, mix, npm, pip, pub, uv (NOT docker/github-actions).
- commit-message: prefix, prefix-development (bundler, composer, mix, maven, npm, pip, uv), include (scope|none).
- groups: no maxProperties in schema (old docs cap of 10 groups no longer present). Per-group keys: patterns (with * wildcard), exclude-patterns (wins on conflict), dependency-type (development|production), update-types (major|minor|patch; default all), applies-to (version-updates|security-updates), group-by (const dependency-name; merges updates for same dependency across multiple directories in monorepos).
- ignore: dependency-name, versions, update-types (major|minor|patch). allow: dependency-name, dependency-type (direct|indirect|all), update-types, patterns.

## Ecosystems (exact strings)
- docker (Dockerfile; v1 manifests; metadata via org.opencontainers.image.source label).
- docker-compose (separate ecosystem, v2/v3 compose files).
- devcontainers (separate ecosystem; updates Features in devcontainer.json + lockfile; GA per devcontainers.github.io/guide/dependabot).
- npm (covers npm/yarn/pnpm v7-v11; monorepo via multiple directories entries or directories list + group-by).
- pip (covers pip requirements*.txt, pipenv, pip-compile, poetry v2, pyproject.toml per PEP 621).
- uv (GA 2025-03-13 for version updates; security updates 2025-12-16; use package-ecosystem: uv NOT pip for uv projects with uv.lock).
- github-actions (updates owner/repo@ref syntax incl. action version comments; ignores local ./.github/actions; directory "/" recommended).
- gitsubmodule (updates git submodule commits). Others: bundler, cargo, composer, conda, deno, dotnet-sdk, elm, gomod, gradle, helm, julia, maven, mix, nix, nuget, opentofu, pre-commit, pub, rust-toolchain, sbt, swift, terraform, vcpkg.

## Schedule & limits
- schedule.interval required per update entry. Weekly with day+time (IANA timezone) recommended for solo maintainers.
- open-pull-requests-limit default 5 (version updates only; security updates exempt).
- registries: top-level + per-update; per-update value: array of registry names or "*".
- multi-ecosystem-groups: single PR spanning ecosystems; per-update patterns + multi-ecosystem-group identifier.

## Cached sources
- mem:cache/fetch/json.schemastore.org/dependabot-2-0-json
- mem:cache/fetch/docs.github.com/en-code-security-dependabot-dependabot-version-updates-configuration-options-for-the-dependabot-yml-file
- mem:cache/fetch/docs.github.com/en-code-security-reference-supply-chain-security-dependabot-options-reference
- mem:cache/fetch/docs.github.com/en-code-security-reference-supply-chain-security-supported-ecosystems-and-repositories
- mem:cache/tavily/dependabot/dependabot-uv-package-ecosystem-github-changelog
- mem:cache/tavily/dependabot/dependabot-devcontainers-ecosystem-devcontainer-json-package
- mem:cache/tavily/dependabot/dependabot-maximum-number-of-groups-per-configuration-file-l