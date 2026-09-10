# Workflow: Test a Feature

When to load: you verify src/<id>/ before publish, debug a failing scenario, or add Alpine, Debian, or non-root coverage. Load this workflow after implement-feature.md creates src/<id>/devcontainer-feature.json and install.sh.

## Prerequisites

- Implement-feature.md produced src/<id>/ with valid JSON and POSIX install.sh.
- Read [testing-matrix](../references/testing-matrix.md) for scenario shape.
- Read [platform-compatibility](../references/platform-compatibility.md) for OS differences.
- Install devcontainers CLI 0.56 or later. Confirm `devcontainer features test --help` prints usage.
- Create test/<id>/ directory for scenarios and test.sh.

## Order of Operations

1. Scaffold test structure. 2. Define scenario matrix. 3. Run tests per base image. 4. Verify non-root and installsAfter ordering. 5. Gate publish on green. Follow the order. Do not publish when any scenario fails.

## Steps

### 1. Scaffold test/<id>/ structure

Create test/<id>/scenarios.json and test/<id>/test.sh. Keep 1 test.sh per Feature. Make test.sh executable with chmod +x. Cover the default scenario with 1 install check and 1 version check.

Require chmod 755 on test.sh. Limit test.sh to 50 lines for the default scenario.

```sh
mkdir -p test/mytool
cat > test/mytool/test.sh << 'EOS'
#!/bin/bash
set -e
command -v mytool
mytool --version | grep -q "1.2.3"
echo "mytool test passed"
EOS
chmod +x test/mytool/test.sh
```

Done when: test/<id>/scenarios.json exists, test/<id>/test.sh exists and is executable, default test.sh has 2 assertions. Gate: missing test.sh or not executable, no test run.

### 2. Define the scenario matrix

Define 4 scenarios minimum. Include 1 Debian, 1 Alpine, 1 non-root, and 1 installsAfter ordering scenario. Set image to a pinned digest or tag. Set features to include the Feature under test with option values.

Keep scenarios.json to 4 to 8 scenarios. Name scenarios with lowercase and underscores, 3 to 20 characters.

```json
{
  "default": {
    "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
    "features": {
      "mytool": {
        "version": "1.2.3"
      }
    }
  },
  "debian": {
    "image": "mcr.microsoft.com/devcontainers/base:debian",
    "features": {
      "mytool": {
        "version": "1.2.3"
      }
    }
  },
  "alpine": {
    "image": "mcr.microsoft.com/devcontainers/base:alpine",
    "features": {
      "mytool": {
        "version": "1.2.3"
      }
    }
  },
  "nonroot": {
    "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
    "remoteUser": "vscode",
    "features": {
      "mytool": {
        "version": "1.2.3"
      }
    }
  }
}
```

Add ordering scenario in a second fence to cover installsAfter with 2 Features:

```json
{
  "with_common_utils": {
    "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
    "features": {
      "common-utils": {
        "installZsh": true
      },
      "mytool": {
        "version": "1.2.3"
      }
    }
  },
  "alpine_minimal": {
    "image": "mcr.microsoft.com/devcontainers/base:alpine",
    "features": {
      "mytool": {
        "version": "latest"
      }
    }
  }
}
```

Wrap multi-doc example as array when you document 2 files in 1 fence. Keep each fence as 1 valid JSON value.

Done when: scenarios.json parses, has 4 to 8 scenarios, includes Alpine, Debian, non-root, and ordering cases. Gate: fewer than 4 scenarios or missing Alpine, expand.

### 3. Run tests per base image

Run 1 command per scenario. Run default first. Run Alpine second to catch musl failures early. Capture exit codes. Require 0 for pass.

Run 4 commands for the 4 core scenarios. Add --project-folder when you run from a subdirectory.

```sh
devcontainer features test --base-image mcr.microsoft.com/devcontainers/base:ubuntu --project-folder .
devcontainer features test --base-image mcr.microsoft.com/devcontainers/base:debian --project-folder .
devcontainer features test --base-image mcr.microsoft.com/devcontainers/base:alpine --project-folder .
devcontainer features test --base-image mcr.microsoft.com/devcontainers/base:ubuntu --remote-user vscode --project-folder .
```

Run with scenarios.json filter when you test 1 scenario:

```sh
devcontainer features test --base-image mcr.microsoft.com/devcontainers/base:alpine --project-folder . --filter mytool
```

Done when: you execute 4 test commands, default exits 0, logs show install.sh output. Gate: default fails, stop and fix install.sh before you publish.

### 4. Verify non-root and installsAfter ordering

Check 2 conditions. Verify _REMOTE_USER owns its home tool directory with 1 ls -ld check. Verify installsAfter order with 1 log grep that shows dependency installs before the Feature.

Add 2 assertions to test.sh for non-root:

```sh
#!/bin/bash
set -e
# installed as _REMOTE_USER vscode
ls -ld /home/vscode/.mytool | grep -q vscode
mytool --version
# check ordering: common-utils log appears before mytool
grep -q "common-utils" /tmp/devcontainer-features.log
grep -q "mytool" /tmp/devcontainer-features.log
```

Done when: non-root test shows owned home directory, ordering test shows dependency before Feature. Gate: ownership check fails or ordering reverses, fix install.sh or installsAfter.

### 5. Gate publish on green

Publish only when default scenario and 3 additional scenarios exit 0. Require 4 greens minimum. Block publish when default fails. Document 1 flake retry maximum before you mark red as real failure.

Record results in 1 summary line per scenario: name, image, exit code.

```sh
echo "default ubuntu 0"
echo "debian 0"
echo "alpine 0"
echo "nonroot 0"
# publish only when all 4 are 0
devcontainer features publish --namespace ghcr.io/myorg/features --project-folder .
```

Done when: 4 scenarios report exit 0, summary has 4 lines, publish command runs only after green. Gate: no green test.sh for default scenario, no publish. Fewer than 4 greens, no publish.

## Acceptance Criteria

- test/<id>/ contains scenarios.json (parses, 4 to 8 scenarios) and test.sh (executable, 2 assertions).
- Matrix covers Alpine, Debian, non-root user, installsAfter ordering with 4 distinct images or configs.
- devcontainer features test runs for 4 scenarios, default exits 0, logs captured.
- Non-root check verifies 1 owned path, ordering check verifies 1 dependency-before-Feature log order.
- Publish blocked when default fails or fewer than 4 greens, 1 retry max for flakes.

## References

- [testing-matrix](../references/testing-matrix.md)
- [platform-compatibility](../references/platform-compatibility.md)
- [feature-anatomy](../references/feature-anatomy.md)
