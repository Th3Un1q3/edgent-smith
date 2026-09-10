# Workflow: Design a Feature

When to load: you plan a new Feature, choose its scope, or decide between Feature vs Template vs Dockerfile before you write install.sh. Load this workflow before you scaffold src/<id>/.

## Prerequisites

- Read [feature-anatomy](../references/feature-anatomy.md) for file layout.
- Read [platform-compatibility](../references/platform-compatibility.md) for OS and arch matrix.
- Read [configuring](../references/configuring.md) for options pinning.
- Review [containers.dev/implementors/features](https://containers.dev/implementors/features/) and [containers.dev/guide/feature-authoring-best-practices](https://containers.dev/guide/feature-authoring-best-practices).
- Identify the target tool, its versions, and 3 example consumer projects.

## Order of Operations

1. Validate Feature fit. 2. Draft options schema. 3. Define platform matrix. 4. Map lifecycle and containerEnv. 5. Map dependency graph. Follow the order. Skip a step only when you document why.

## Steps

### 1. Decide if a Feature is correct

Choose a Feature when 1 install repeats across 3 or more devcontainers and the tool installs with a shell script. Prefer a Template when you scaffold a full project. Prefer a Dockerfile when you build a single image with no reuse.

Create 1 Feature per tool. Bundle 2 tools only when they share a release cycle and a single binary.

```json
{
  "decision": "feature",
  "reason": "installs mytool across 5 services, script-based, reused",
  "alternativesRejected": ["template: scaffolds project not tool", "dockerfile: single image, no reuse"]
}
```

Done when: you write 1 sentence that names Feature, Template, or Dockerfile and lists 1 concrete reuse count. Gate: no decision with reuse count, no scaffold.

### 2. Draft the options schema

Limit options to 5 or fewer. Define 1 option per distinct install dimension. Require type, default, and description for each option.

Use string for versions with proposals. Use boolean for toggles. Use enum when you have 2 to 6 discrete values. Set defaults to the safe production value.

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "name": "My Tool",
  "description": "Installs mytool with pinned version",
  "options": {
    "version": {
      "type": "string",
      "default": "latest",
      "description": "Version to install",
      "proposals": ["latest", "1.2.3", "1.2.2"]
    },
    "installExtras": {
      "type": "boolean",
      "default": false,
      "description": "Install optional extras"
    }
  }
}
```

Add a second example that shows 3 options at the limit with valid enum:

```json
{
  "id": "mytool",
  "version": "1.0.0",
  "name": "My Tool",
  "options": {
    "version": {
      "type": "string",
      "default": "1.2.3",
      "description": "Version to install"
    },
    "channel": {
      "type": "string",
      "enum": ["stable", "beta", "nightly"],
      "default": "stable",
      "description": "Release channel"
    },
    "enableCache": {
      "type": "boolean",
      "default": true,
      "description": "Enable local cache"
    }
  }
}
```

Done when: devcontainer-feature.json options parse, each option declares type and default, total options ≤5. Gate: no parse, no next step.

### 3. Define the platform matrix

Test 4 images minimum. Include 1 Debian, 1 Ubuntu, 1 Alpine, and 1 additional (fedora or rockylinux). Cover 2 architectures: amd64 and arm64 when the tool ships both.

Declare unsupported platforms explicitly. Document the fallback or error for Alpine musl.

```json
{
  "platforms": [
    "mcr.microsoft.com/devcontainers/base:ubuntu",
    "mcr.microsoft.com/devcontainers/base:debian",
    "mcr.microsoft.com/devcontainers/base:alpine",
    "mcr.microsoft.com/devcontainers/base:fedora"
  ],
  "architectures": ["amd64", "arm64"],
  "unsupported": ["alpine: musl build missing, exit 1 with message"]
}
```

Done when: matrix lists 4 images and 2 arch values, unsupported list has 0 or more entries with a reason. Gate: fewer than 3 images, no proceed.

### 4. Map lifecycle and containerEnv

Set id to match directory name src/<id>/. Set version to semver X.Y.Z. Set containerEnv only for PATH or runtime vars the tool requires. Keep containerEnv to 3 keys or fewer.

Expose multi-version binaries via symlink. Add containerEnv PATH entry once.

```json
{
  "id": "mytool",
  "version": "0.1.0",
  "containerEnv": {
    "MYTOOL_HOME": "/usr/local/mytool",
    "PATH": "/usr/local/mytool/bin:${PATH}"
  },
  "installsAfter": []
}
```

Done when: id equals src directory name, version matches semver regex, containerEnv ≤3 keys. Gate: id mismatch, no proceed.

### 5. Map the dependency graph

List 0 to 3 entries in installsAfter. Order Feature after its dependencies. Declare dependsOn only for hard requirements that block install.

Keep the graph acyclic. Document 1 conflict resolution per shared PATH entry.

```json
{
  "id": "mytool",
  "installsAfter": [
    "ghcr.io/devcontainers/features/common-utils:1",
    "ghcr.io/devcontainers/features/docker-in-docker:2"
  ],
  "dependsOn": {
    "ghcr.io/devcontainers/features/common-utils:1": {
      "installZsh": true
    }
  }
}
```

Done when: dependency graph has ≤3 installsAfter entries and parses, no cycles. Gate: cycle detected or >3 entries without justification, revise.

## Clarification Triggers

Ask the user when:

- Tool has 2 distribution methods (binary vs package manager) and you cannot pick 1.
- Options exceed 5 and you cannot merge or drop 1.
- Platform requires privileged or capAdd and you lack the use case.
- Version source is ambiguous (latest tag floats vs pinned digest).

Stop and document the assumption when the user does not answer within the design turn.

## Acceptance Criteria

- Decision record names Feature, Template, or Dockerfile with a reuse count ≥3 for Features.
- Options schema has 1 to 5 options, each with type, default, description, parses as JSON.
- Platform matrix lists 4 images and 2 architectures, unsupported list is explicit.
- id matches src/<id>/, version follows semver X.Y.Z, containerEnv ≤3 keys.
- Dependency graph has ≤3 installsAfter entries, is acyclic, resolves PATH conflicts.
- All JSON fences parse with json.loads, no comments, multi-doc wrapped in array if needed.

## References

- [feature-anatomy](../references/feature-anatomy.md)
- [platform-compatibility](../references/platform-compatibility.md)
- [configuring](../references/configuring.md)
- [containers.dev/implementors/features](https://containers.dev/implementors/features/)
- [containers.dev/guide/feature-authoring-best-practices](https://containers.dev/guide/feature-authoring-best-practices)
