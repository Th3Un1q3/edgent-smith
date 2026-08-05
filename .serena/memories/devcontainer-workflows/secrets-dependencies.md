# Secrets & Dependency Hygiene

**Use when:** introducing credentials, tokens, images, or third-party services into an environment.

## Pitfalls
- Committing secrets / forgetting the environment .env is gitignored.
- Relying on `git check-ignore` to prove committability (often blocked in sandboxes).
- Unpinned `:latest` images and unverified version numbers.
- Auto-updating long-running connectors silently changing behavior.

## Rules
1. Credentials go in a gitignored `.env`; ship a committed `.env.example` with exact variable names.
2. Prove committability with `git status --porcelain` — ignored files don't appear as untracked.
3. Pin image/tag versions and verify the tag exists against a real registry (Docker Hub API, GitHub releases); never `:latest`.
4. Disable auto-update for long-running connectors (`--no-autoupdate`); document secret rotation.
