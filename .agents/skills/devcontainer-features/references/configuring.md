# Reference: Configuring

Use this reference when you consume a Feature in `devcontainer.json`.

## When to load

Load when you declare `features` in `devcontainer.json`, set options, resolve install order, or reference a local or remote tarball.

## Vocabulary

- **consumer** — the `devcontainer.json` that lists Features under `features`.
- **Feature Equality** — deduplication rule that treats two entries with the same id, version, and registry as one install.
- **dependency graph** — the directed graph built from `dependsOn` and `installsAfter` that determines install order.
- **round** — one batch of Features with no remaining dependencies; the engine installs a round in parallel, then advances.
- **roundPriority** — an optional string hint that orders Features within a round before the stable-sort fallback.
- **overrideFeatureInstallOrder** — the `devcontainer.json` array that forces a full install order; the engine fails if it conflicts with the graph.
- **local Feature** — a Feature referenced by a relative path `./local-features/myFeat` instead of a registry.
- **HTTPS tarball** — a Feature referenced by `https://.../devcontainer-feature.tgz` instead of a registry.

## Consumer feature references

Declare each Feature as a key under `features`. The key is registry, local path, or HTTPS URL; the value sets options.

Registry reference with a floating major tag:

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1": {
      "version": "1.2.3"
    }
  }
}
```

Local path reference for development before publishing:

```json
{
  "features": {
    "./local-features/mytool": {
      "version": "latest"
    }
  }
}
```

HTTPS tarball reference for ad-hoc sharing:

```json
{
  "features": {
    "https://example.com/mytool/devcontainer-feature.tgz": {
      "version": "1.0.0"
    }
  }
}
```

Local and HTTPS refs still pass `devcontainer-feature.json` validation and run `install.sh`.

## Options

Pass Feature options as the value object. Keys match `options` in `devcontainer-feature.json`.

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1": {
      "version": "1.2.3",
      "installDependencies": true
    }
  }
}
```

Unspecified options use the Feature default. Unknown keys fail at build start. Keep option values JSON primitives only.

## Feature Equality deduplication

The engine deduplicates Features before building. Two entries with the same registry, id, and version count as one install even when they appear with different option maps.

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1": {
      "version": "1.2.3"
    },
    "ghcr.io/myorg/my-collection/mytool:1.0.0": {
      "version": "1.2.3"
    }
  }
}
```

The second entry is ignored when the id and version match the first. Duplicate entries with different options do not merge; the first wins. Declare each Feature once.

## Dependency graph and install order

The engine builds a graph from `dependsOn` and `installsAfter` and installs Features in rounds.

Algorithm per the spec:

- Collect all Features and their edges.
- Each round installs every Feature whose dependencies already installed.
- Within a round sort by `roundPriority` then by stable insertion order.
- Advance to the next round until the graph empties.

Example graph:

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "dependsOn": {
    "ghcr.io/devcontainers/features/common-utils:1": {}
  },
  "installsAfter": ["ghcr.io/devcontainers/features/docker-in-docker:1"]
}
```

`common-utils` installs in round 1, `docker-in-docker` installs in round 1 when present, `mytool` installs in round 2. `dependsOn` guarantees presence; `installsAfter` orders only when the target exists.

Round priority hint:

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/b:1": {
      "roundPriority": "10"
    },
    "ghcr.io/myorg/my-collection/a:1": {
      "roundPriority": "20"
    }
  }
}
```

Higher `roundPriority` runs earlier within the same round. Without the hint the engine preserves the `features` insertion order.

## overrideFeatureInstallOrder

Set `overrideFeatureInstallOrder` in `devcontainer.json` to force a full manual order. The array lists every Feature key in install order.

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/a:1": {},
    "ghcr.io/myorg/my-collection/b:1": {}
  },
  "overrideFeatureInstallOrder": [
    "ghcr.io/myorg/my-collection/b:1",
    "ghcr.io/myorg/my-collection/a:1"
  ]
}
```

The engine validates the override against the graph. If the override conflicts with a `dependsOn` edge or omits a Feature the engine fails fast and prints the inconsistent edge. Keep overrides short; prefer graph edges over manual ordering.

## Local and HTTPS details

Use local and HTTPS refs for iteration and review, not for published consumers.

Local path resolves relative to `devcontainer.json`:

```json
{
  "features": {
    "./local-features/mytool": {}
  }
}
```

HTTPS URL must serve a gzipped tarball that contains `devcontainer-feature.json` and `install.sh` at the root:

```json
{
  "features": {
    "https://cdn.example.com/features/mytool-1.0.0.tgz": {}
  }
}
```

Both forms skip OCI resolution and download directly; caching follows HTTP headers.

## Canonical sources

- Spec: [containers.dev/implementors/features — dependency algorithm](https://containers.dev/implementors/features/)
- Spec: [containers.dev/implementors/features-distribution](https://containers.dev/implementors/features-distribution/)
- Schema: [devContainerFeature.schema.json](https://github.com/devcontainers/spec/blob/main/schemas/devContainerFeature.schema.json)
