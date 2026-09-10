# Workflow: Configure a Feature in devcontainer.json

When to load: you consume a published Feature in devcontainer.json, pin versions, pass options, order installs, or reference a local or tarball Feature. Load this workflow when you edit features in devcontainer.json or debug install order.

## Prerequisites

- Read [configuring](../references/configuring.md) for pinning and options shape.
- Read [publishing-distribution](../references/publishing-distribution.md) for OCI ref shape.
- Identify the Feature ref: ghcr.io/<owner>/features/<id>:<version> or local ./path or https tarball URL.
- Verify 1 installed tool: `devcontainer --version` ≥0.56 for build validation and `python3 --version` for JSON checks.
- Confirm devcontainer.json exists and parses, base image declared.

## Order of Operations

1. Pin the version. 2. Pass options. 3. Wire ordering with dependsOn and installsAfter. 4. Use local or tarball refs when needed. 5. Validate schema and build. 6. Confirm install order. Follow the order. Fix pinning before you tune ordering.

## Steps

### 1. Pin the version with floating or exact tags

Pin 1 tag per Feature. Use :1 for major floating, :1.0 for minor floating, :1.0.0 for exact. Prefer :1 or :1.0 for auto-patches, use exact for frozen builds.

Require 1 tag per Feature. Never omit the tag when you pin to production.

```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/myorg/features/mytool:1": {},
    "ghcr.io/myorg/features/go:1.0": {},
    "ghcr.io/myorg/features/node:1.0.0": {}
  }
}
```

Done when: every Feature ref has a tag, tag matches :1, :1.0, or :1.0.0 shape, no bare ref without version. Gate: bare ref found, add tag before build.

### 2. Pass options as env vars in the features object

Set 1 option per key inside the Feature value object. Pass 1 to 5 options, each with the type the Feature declares. Options surface as env vars $VERSION, $INSTALL_EXTRAS inside install.sh.

Require each option key to match the Feature schema. Require 0 to 5 options, defaults apply when you omit.

```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/myorg/features/mytool:1": {
      "version": "1.2.3",
      "installExtras": true
    },
    "ghcr.io/myorg/features/go:1": {
      "version": "1.22",
      "installTools": true
    }
  }
}
```

Show 3 options at the limit with enum and boolean:

```json
{
  "features": {
    "ghcr.io/myorg/features/mytool:1": {
      "version": "1.2.3",
      "channel": "stable",
      "enableCache": true
    }
  }
}
```

Expose how options map to env vars inside install.sh with 1 check:

```sh
#!/bin/sh
echo "VERSION=$VERSION"
echo "INSTALL_EXTRAS=$INSTALL_EXTRAS"
# Feature with channel stable maps to $CHANNEL=stable
```

Done when: features object parses, each key matches the Feature options schema, option count ≤5, build log shows env vars set. Gate: unknown option key or type mismatch, fix key name before build.

### 3. Wire ordering with dependsOn, installsAfter, and overrideFeatureInstallOrder

Order 0 to 3 dependencies per Feature. Use installsAfter for soft ordering, dependsOn for hard requirements that must install first and pass inputs, overrideFeatureInstallOrder to reorder the final build when soft ordering fails.

Require acyclic graph. Require 0 to 3 installsAfter entries. Set overrideFeatureInstallOrder at the top level only.

```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/devcontainers/features/common-utils:1": {
      "installZsh": true
    },
    "ghcr.io/myorg/features/mytool:1": {
      "version": "1.2.3"
    }
  },
  "overrideFeatureInstallOrder": [
    "ghcr.io/devcontainers/features/common-utils",
    "ghcr.io/myorg/features/mytool"
  ]
}
```

A second example shows hard dependency with inputs via dependsOn declared in the Feature metadata, not devcontainer.json, and soft ordering in devcontainer.json:

```json
{
  "id": "mytool",
  "version": "1.3.0",
  "dependsOn": {
    "ghcr.io/devcontainers/features/common-utils:1": {
      "installZsh": true
    }
  },
  "installsAfter": [
    "ghcr.io/devcontainers/features/docker-in-docker:2"
  ]
}
```

Pair with devcontainer.json that respects the same order:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/common-utils:1": {
      "installZsh": true
    },
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/myorg/features/mytool:1": {
      "version": "1.2.3"
    }
  }
}
```

Done when: install log shows common-utils before mytool, graph has no cycles, overrideFeatureInstallOrder lists 2 or more Features when present. Gate: cycle detected or order reversed, fix installsAfter or overrideFeatureInstallOrder.

### 4. Use local path and HTTPS tarball refs when needed

Use local paths for development and HTTPS tarballs for frozen or air-gapped installs. Local path starts with ./ or ../, tarball ends with .tgz.

Use 1 ref style per Feature entry. Keep local paths under 100 characters. Keep tarball URLs under 200 characters.

```json
{
  "features": {
    "./my-feature": {
      "version": "1.2.3"
    },
    "../other-feature": {
      "installExtras": true
    },
    "https://example.com/features/mytool-1.2.3.tgz": {
      "version": "1.2.3"
    }
  }
}
```

A second example shows mixed OCI and local for testing before publish:

```json
{
  "features": {
    "ghcr.io/myorg/features/go:1": {
      "version": "1.22"
    },
    "./src/mytool": {
      "version": "latest"
    }
  }
}
```

Done when: local path resolves to a directory with devcontainer-feature.json, tarball URL returns 200 and contains install.sh, OCI refs still pinned. Gate: path missing or tarball 404, fix path before build.

### 5. Validate via devcontainer.json schema and build

Validate schema before you build. Run 1 JSON parse, 1 schema check, and 1 devcontainer build or features test. Schema lives at <https://raw.githubusercontent.com/devcontainers/spec/main/schemas/devContainer.schema.json.>

Require 3 checks: parse, schema, build. Require build exit 0.

```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/myorg/features/mytool:1": {
      "version": "1.2.3"
    }
  },
  "overrideFeatureInstallOrder": [
    "ghcr.io/devcontainers/features/common-utils",
    "ghcr.io/myorg/features/mytool"
  ]
}
```

Validate in 1 sequence:

```sh
python3 -c "import json; json.load(open('.devcontainer/devcontainer.json')); print('parse ok')"
npx --yes ajv-cli validate -s <https://raw.githubusercontent.com/devcontainers/spec/main/schemas/devContainer.schema.json> -d .devcontainer/devcontainer.json --strict=false
devcontainer build --workspace-folder . 2>&1 | tail -n 20
```

Done when: JSON parses, schema validation reports valid, build exits 0. Gate: schema fails or build fails, fix pin or options before merge.

### 6. Confirm install order resolves without circular failure

Check 2 conditions after build. Verify log shows Features in overrideFeatureInstallOrder sequence, and no circular dependency error. Require 1 log grep per Feature in order.

Search build log for 1 marker per Feature. Expect common-utils before mytool when override requests it.

```sh
# inspect build log for order
devcontainer build --workspace-folder . --log-level trace 2>&1 | grep -E "common-utils|mytool"
# expected: common-utils install line appears before mytool install line

# check for circular error (should return no lines)
devcontainer build --workspace-folder . 2>&1 | grep -qi "circular" && echo "circular failure" || echo "no circular failure"
```

Done when: log shows Features in requested order, no circular failure line, build exits 0. Gate: circular failure or order mismatch, fix dependsOn or installsAfter and rebuild.

## Acceptance Criteria

- Every Feature ref has a tag :1, :1.0, or :1.0.0, no bare refs, 3 pin strengths demonstrated.
- Features object passes 1 parse, 0 to 5 options per Feature with correct types, env vars visible in log.
- Ordering uses installsAfter ≤3, dependsOn for hard deps, overrideFeatureInstallOrder lists 2 or more when present, graph acyclic.
- Local path ./my-feature resolves and https tarball returns 200 with install.sh, mixed OCI and local builds succeed.
- Schema validation via devcontainer.json schema exits 0, devcontainer build exits 0.
- Build log shows ordered installs, no circular failure, 1 grep per Feature matches sequence.

## References

- [configuring](../references/configuring.md)
- [publishing-distribution](../references/publishing-distribution.md)
- [feature-anatomy](../references/feature-anatomy.md)
- [containers.dev/implementors/features](https://containers.dev/implementors/features/)
- [containers.dev/implementors/json_reference](https://containers.dev/implementors/json_reference/)
