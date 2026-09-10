# Recipe: Add a Feature to a collection

Add one Feature to an existing monorepo collection in nine steps.

## When to load

Load when you extend a collection at `src/<id>/` without breaking existing Features.

## Prerequisites

- Starter cloned: `ghcr.io/devcontainers/feature-starter` or existing collection repo.
- Tools: `git`, `bash`, `npx @devcontainers/cli`, `devcontainer` CLI.
- Collection at `src/collection.json` and at least one Feature under `src/`.

## Steps

1. Fork and clone the starter or your collection repo.

```bash
git clone https://github.com/devcontainers/feature-starter my-collection
cd my-collection
rm -rf .git && git init
```

2. Copy the template directory to the new Feature id.

```bash
FEATURE_ID=mytool-extras
cp -r src/helloworld "src/${FEATURE_ID}"
```

3. Edit `src/<newId>/devcontainer-feature.json` — set `id`, `version`, `name`, `description`.

```json
{
  "id": "mytool-extras",
  "version": "1.0.0",
  "name": "My Tool Extras",
  "description": "Extra utilities for mytool"
}
```

Keep `id` equal to the directory name and use semver `1.0.0`.

4. Write `src/<newId>/install.sh` — POSIX `sh`, idempotent, non-interactive.

```bash
#!/usr/bin/env sh
set -eu
echo "Installing ${FEATURE_ID} version ${VERSION:-latest}"
```

Make it executable: `chmod +x src/${FEATURE_ID}/install.sh`.

5. Copy and edit the test scenario for the new Feature.

```bash
mkdir -p "test/${FEATURE_ID}"
cp test/helloworld/scenarios.json "test/${FEATURE_ID}/scenarios.json"
```

Template for `test/<newId>/scenarios.json`:

```json
{
  "debian_default": {
    "image": "mcr.microsoft.com/devcontainers/base:debian",
    "features": {
      "mytool-extras": {}
    }
  },
  "ubuntu_with_version": {
    "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
    "features": {
      "mytool-extras": {
        "version": "1.0.0"
      }
    }
  }
}
```

Add one scenario per base image and one per option.

6. Validate locally with the helper.

```bash
./scripts/validate-feature.sh "${FEATURE_ID}"
```

Fix any `ajv` or `shellcheck` errors before continuing.

7. Run the Feature test matrix locally.

```bash
devcontainer features test --collection-root ./src/mytool-extras
```

Check that every scenario passes on Ubuntu, Debian, and Alpine when you declare those bases.

8. Bump the collection docs when needed. Update `src/collection.json` only when you change `sourceInformation`.

```json
{
  "sourceInformation": {
    "source": "my-collection"
  }
}
```

Do not edit `collection.json` per Feature bump; the publish step regenerates docs.

9. Commit and push; CI publishes via `devcontainers/action`.

```bash
git add "src/${FEATURE_ID}" "test/${FEATURE_ID}"
git commit -m "feat: add ${FEATURE_ID} 1.0.0"
git push origin main
```

The workflow packages `src/<newId>/`, runs scenarios, and pushes OCI artifacts with floating tags.

## Reusable script

Run the full local sequence for one new Feature:

```bash
#!/usr/bin/env bash
set -euo pipefail
FEATURE_ID="${1:?usage: $0 <feature-id>}"
cp -r src/helloworld "src/${FEATURE_ID}"
mkdir -p "test/${FEATURE_ID}"
cp test/helloworld/scenarios.json "test/${FEATURE_ID}/scenarios.json"
chmod +x "src/${FEATURE_ID}/install.sh"
./scripts/validate-feature.sh "${FEATURE_ID}"
devcontainer features test --collection-root "src/${FEATURE_ID}"
echo "done: src/${FEATURE_ID} ready for commit"
```

Edit `devcontainer-feature.json` and `install.sh` between the copy and the validate step.

## Done when

- `src/<newId>/devcontainer-feature.json` validates against the schema.
- `src/<newId>/install.sh` is executable and passes `shellcheck`.
- `test/<newId>/scenarios.json` covers at least the default scenario.
- `devcontainer features test` passes for the new Feature.
- CI push creates `ghcr.io/<owner>/<collection>/<newId>:1.0.0` with floating tags `1` and `1.0`.

## Canonical sources

- Starter: [devcontainers/feature-starter](https://github.com/devcontainers/feature-starter)
- CLI test: [devcontainers/cli — features test](https://github.com/devcontainers/cli/blob/main/docs/features/test.md)
