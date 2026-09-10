# Reference: Repo layout

Use this reference when you choose between a monorepo and a scoped repo for Features.

## When to load

Load when you create a new collection, add a Feature, or configure CI and GHCR publishing.

## Vocabulary

- **monorepo** — one repository holding many Features under `src/<id>/` and one `src/collection.json`.
- **scoped repo** — one repository for a single Feature with one `src/<id>/` directory.
- **collection.json** — the optional collection manifest that lists Features for discovery.

## Comparison

Choose the layout that matches discovery, CI, and versioning needs.

| Dimension | Monorepo | Scoped repo |
|---|---|---|
| Structure | Many `src/<id>/` folders, one `src/collection.json` | One `src/<id>/` folder, no collection file |
| Discovery | One GHCR namespace, one collection index | One namespace per repo, no index needed |
| CI | Shared workflow, matrix across Features | Single workflow, fastest runs |
| Versioning | Shared release tagging, manual per-Feature bump | Independent semver per repo |
| Ownership | Team owns all Features | One owner per Feature |

Pick monorepo for a team that ships related Features; pick scoped repo for an isolated tool.

## Monorepo structure

Each Feature lives under `src/<id>/` with its own metadata and install script.

```text
my-features/
  src/
    collection.json
    mytool/
      devcontainer-feature.json
      install.sh
    mytool-extras/
      devcontainer-feature.json
      install.sh
  test/
    mytool/
      scenarios.json
    mytool-extras/
      scenarios.json
  .github/workflows/release.yaml
```

Include one collection file at `src/collection.json`.

```json
{
  "sourceInformation": {
    "source": "my-features"
  }
}
```

## Scoped-repo structure

A scoped repo contains one Feature and its tests.

```text
mytool-feature/
  src/mytool/
    devcontainer-feature.json
    install.sh
  test/mytool/
    scenarios.json
  .github/workflows/release.yaml
```

Use the repo name as the GHCR namespace.

## Starter commands

Clone the official starter and rename for either layout.

```bash
git clone https://github.com/devcontainers/feature-starter my-features
cd my-features
rm -rf .git
git init
```

Copy `src/helloworld` to `src/<your-id>` and update `devcontainer-feature.json`.

## CI trade-offs

Run a matrix job for monorepos and a single job for scoped repos.

```yaml
jobs:
  test:
    strategy:
      matrix:
        feature: ["mytool", "mytool-extras"]
    uses: ./.github/workflows/test.yaml
```

Keep monorepo matrix under 8 Features per workflow run to limit GH Actions minutes.

## GHCR namespace

Publish monorepo Features under `ghcr.io/<owner>/<collection>/<id>`; publish scoped Features under `ghcr.io/<owner>/<id>`.

```json
{
  "features": {
    "ghcr.io/myorg/my-features/mytool:1": {}
  }
}
```

Use one GHCR package per Feature; namespace changes require a new major version.

## Canonical sources

- Starter: [devcontainers/feature-starter](https://github.com/devcontainers/feature-starter)
- Spec: [containers.dev/implementors/features-distribution](https://containers.dev/implementors/features-distribution/)
