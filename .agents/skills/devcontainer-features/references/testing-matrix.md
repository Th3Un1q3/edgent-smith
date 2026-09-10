# Reference: Testing matrix

Use this reference when you test Features across base images and option combos.

## When to load

Load when you write `scenarios.json`, run `devcontainer features test`, or configure CI.

## Vocabulary

- **scenario** — a named test case in `test/<id>/scenarios.json` with its own `image`, `features`, and `options`.
- **base image** — the container image under test, set by `image` in a scenario or `--base-image` on the CLI.

## CLI flags

Run `devcontainer features test` with explicit flags. Pass one collection root per invocation.

```bash
devcontainer features test \
  --collection-root ./src/mytool \
  --base-image mcr.microsoft.com/devcontainers/base:ubuntu
```

Add `--skip-autogenerate` to reuse existing `scenarios.json` without regeneration.

## Scenarios file shape

Place scenarios at `test/<id>/scenarios.json`. Each key is a scenario name; each value sets `image` and `features`.

```json
{
  "debian_default": {
    "image": "mcr.microsoft.com/devcontainers/base:debian",
    "features": {
      "mytool": {
        "version": "latest"
      }
    }
  },
  "ubuntu_with_options": {
    "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
    "features": {
      "mytool": {
        "version": "1.2.3",
        "installDependencies": true
      }
    }
  }
}
```

Cover one idea per scenario — default install, pinned version, or option toggle.

## One idea per scenario

Keep scenarios atomic; combine at most two option variations per scenario.

```json
{
  "default_install": {
    "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
    "features": {
      "mytool": {}
    }
  },
  "custom_version": {
    "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
    "features": {
      "mytool": {
        "version": "1.2.3"
      }
    }
  }
}
```

Name scenarios with `<base>_<variation>` format.

## Scenarios map versus --base-image

Prefer `scenarios.json` for multi-image coverage; use `--base-image` for a quick single-image check.

```bash
# Matrix via file covers 3 bases in one run
devcontainer features test --collection-root ./src/mytool

# Override to a single image for fast local iteration
devcontainer features test --collection-root ./src/mytool --base-image alpine:3.19
```

The CLI runs every scenario; `--base-image` filters to one image without editing the file.

## CI matrix

Fan out across base images and Feature options with a GitHub Actions matrix.

```yaml
jobs:
  test:
    strategy:
      matrix:
        image: ["mcr.microsoft.com/devcontainers/base:ubuntu", "mcr.microsoft.com/devcontainers/base:debian", "alpine:3.19"]
    steps:
      - uses: actions/checkout@v4
      - run: devcontainer features test --collection-root ./src/mytool --base-image ${{ matrix.image }}
```

Limit the matrix to 3 images and 4 scenarios per job to keep runtime under 15 minutes.

## Canonical sources

- CLI: [devcontainers/cli — features test](https://github.com/devcontainers/cli/blob/main/docs/features/test.md)
- Starter: [devcontainers/feature-starter](https://github.com/devcontainers/feature-starter)
