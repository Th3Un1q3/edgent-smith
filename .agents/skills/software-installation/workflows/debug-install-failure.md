# Workflow: Debug an Install Failure

Diagnose a failing or silently-broken install by classifying the failure, then apply the fix the class dictates. Each class names its signal, cause, fix, and outcome.

**Tools:** bash, npm, node, uv, and devcontainer logs (devcontainer CLI output or `docker compose logs`). **Prerequisites:** the failing install command and its exact error text.

**Order of operations:** capture the error → classify → fix → re-verify with one bounded smoke.

## Classification 1 — Version mismatch

**Signal:** the installed version differs from the pinned string, or a reinstall silently skipped. **Cause:** a moving dist-tag (`latest`, `rc`) or a bare `command -v` guard. **Fix:** pin the exact version and guard with a version check (pattern: [workflows/install-cli-tool.md](../workflows/install-cli-tool.md) Step 2). **Outcome:** the tool's `--version` returns the pinned string.

## Classification 2 — Native-load failure

**Signal:** `node -e "require('<native-pkg>')"` throws MODULE_NOT_FOUND or a binding error. **Cause:** postinstall skipped by the npm allow-scripts gate, or no prebuild for the platform/arch. **Fix:** whitelist the script (`--allow-scripts=<pkg>`) or confirm a prebuild exists for the arch (arm64) before relying on the package. **Outcome:** the require resolves.

## Classification 3 — ABI mismatch

**Signal:** a native module throws an ABI version error after a node major bump. **Cause:** the node FEATURE version bumped the ABI. **Fix:** reinstall the native dep against the actual node — confirm with `node -p process.versions.modules` — or rebuild the module. **Outcome:** the module ABI matches the running node.

## Classification 4 — Permission / volume ownership (EACCES)

**Signal:** EACCES reading or writing a home-directory path. **Cause:** a fresh named volume mounts root-owned (root:root 755). **Fix:** `mkdir -p <mount>` plus `sudo chown -R $(id -u):$(id -g) <mount>` in postCreate (canonical block: [references/devcontainer-lifecycle-and-persistence.md](../references/devcontainer-lifecycle-and-persistence.md)). **Outcome:** the dev user reads and writes the mount.

## Classification 5 — Schema rejection

**Signal:** the tool rejects or silently ignores config it loaded — a `patch:` error or an unread config key. **Cause:** config written from a blog example instead of the installed package's schema. **Fix:** regenerate the config from the installed package via `--dump-config`-style introspection or the package's own types/docs. **Outcome:** the tool parses its config and applies every row (schema rules: [references/plugin-systems-and-config.md](../references/plugin-systems-and-config.md)).

## Classification 6 — External blocker

**Signal:** registry or upstream failure outside the config — HTTP 403 quota, missing upstream metadata, network error. **Cause:** external service state. **Fix:** retry once after a delay, or record the blocker and classify PASS-WITH-CAVEAT. **Outcome:** the caveat is documented and no config changes.

## Acceptance criteria

- Every failure lands in exactly one class with a fix and an outcome.
- Re-verification runs one bounded smoke, then a classification — no retry loops.

## Example application: dsh --dump-config EACCES

dsh failed `--dump-config` with EACCES because a fresh `~/.dsh` named volume mounted root-owned. The fix followed Classification 4: postCreate chowned the mount, and `--dump-config` then parsed the restored config.
