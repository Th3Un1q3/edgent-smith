# Workflow: Version and Update a Feature

When to load: you bump src/<id>/ for a fix, feature, or breaking change, re-tag floating refs, or republish after a failed push. Load this workflow after implement-feature.md changes install.sh or after GHCR returns 409 duplicate.

## Prerequisites

- Read [versioning](../references/versioning.md) for semver rules.
- Read [publishing-distribution](../references/publishing-distribution.md) for tag distribution.
- Verify src/<id>/devcontainer-feature.json exists and parses.
- Verify publish-feature.md succeeded at least once for this id, or prepare the first publish with 0.1.0.
- Install tools and confirm 1 check each: `devcontainer --version` ≥0.56, `oras version` ≥1.0, `git log --oneline -1` succeeds.
- Review collection.json and CHANGELOG.md location at repo root.

## Order of Operations

1. Choose bump type. 2. Update version in JSON. 3. Regenerate floating tags. 4. Update collection.json and changelog. 5. Republish via publish workflow. 6. Verify digest with oras. Follow the order. Skip floating tags only when you publish a prerelease.

## Steps

### 1. Choose the semver bump

Pick 1 bump per change. Use patch for bug fixes, minor for backward-compatible features, major for breaking changes. Start at 0.1.0 and move to 1.0.0 on first stable release.

Apply 3 rules: patch increments Z, minor increments Y and resets Z to 0, major increments X and resets Y and Z to 0.

| Change type | Example before | Bump | Example after |
|---|---|---|---|
| Fix typo or patch install.sh | 1.2.3 | patch | 1.2.4 |
| Add option with default, no break | 1.2.3 | minor | 1.3.0 |
| Rename or remove option | 1.2.3 | major | 2.0.0 |
| First stable after 0.x | 0.9.3 | major | 1.0.0 |

```json
{
  "id": "mytool",
  "before": "1.2.3",
  "change": "add installExtras boolean default false",
  "bump": "minor",
  "after": "1.3.0"
}
```

A second example shows patch for Alpine fix:

```json
{
  "id": "mytool",
  "before": "1.3.0",
  "change": "fix apk missing ca-certificates on Alpine",
  "bump": "patch",
  "after": "1.3.1"
}
```

Done when: you write before, change type, bump, and after, bump matches the table, after follows X.Y.Z. Gate: bump mismatches change type, re-evaluate.

### 2. Update version in devcontainer-feature.json

Edit 1 file per bump. Change version only. Keep id, name, and options untouched unless the bump requires them. Commit the change before you publish.

Require 1 file edit per Feature. Require semver regex `^[0-9]+\.[0-9]+\.[0-9]+$`.

```json
{
  "id": "mytool",
  "version": "1.3.0",
  "name": "My Tool",
  "description": "Installs mytool CLI with versioned symlink"
}
```

Edit and validate in 1 sequence:

```sh
# update version with jq
jq '.version = "1.3.0"' src/mytool/devcontainer-feature.json > /tmp/new.json && mv /tmp/new.json src/mytool/devcontainer-feature.json
python3 -c "import json; json.load(open('src/mytool/devcontainer-feature.json')); print('json ok')"
grep -E '"version": "1\.3\.0"' src/mytool/devcontainer-feature.json
```

Done when: file parses, version equals after value, git diff shows 1 changed line for version. Gate: parse fails or version still equals before value, fix.

### 3. Regenerate floating tags :1 :1.0 :1.0.0

Map 1 semver to 3 floating tags. Generate :1 :1.0 :1.0.0 for 1.0.0, and keep :1 floating across minors. Push all 4 tags (3 floating plus full) in the same publish operation. Reject manual tag edits outside publish.

Use 1 command to push floating tags; the publisher derives them from version. Verify 4 tags point to the same digest after publish.

```json
{
  "version": "1.3.0",
  "tags": ["1.3.0", "1.3", "1.0", "1"],
  "floating": ["1", "1.3", "1.0"],
  "full": "1.3.0"
}
```

A full table shows derivation for 3 successive releases:

```json
[
  {
    "version": "1.2.3",
    "tags": ["1.2.3", "1.2", "1"]
  },
  {
    "version": "1.3.0",
    "tags": ["1.3.0", "1.3", "1"]
  },
  {
    "version": "2.0.0",
    "tags": ["2.0.0", "2.0", "2"]
  }
]
```

Generate tags via publish CLI which handles floating tags automatically:

```sh
# dry-run: show tags that will be generated
devcontainer features publish --namespace ghcr.io/myorg/features src/mytool --dry-run 2>&1 | grep -E "tag"

# after publish, list tags
oras tags ghcr.io/myorg/features/mytool | sort -V
```

Done when: 4 tags derived from after version, tags follow floating pattern :1 :1.0 :1.0.0, no tag reused from a previous version. Gate: tag list missing floating ref or full version, republish.

### 4. Update collection.json and changelog

Update 2 files per bump. Set collection.json features[].version to after value. Append 1 changelog entry with version, date, and change type. Keep changelog under 500 lines, newest entry first.

Require 1 collection.json entry per Feature and 1 changelog line per bump.

```json
{
  "sourceInformation": {
    "source": "https://github.com/myorg/my-features"
  },
  "features": [
    {
      "id": "mytool",
      "version": "1.3.0",
      "description": "Installs mytool CLI with pinned version"
    }
  ]
}
```

Update changelog in markdown with 1 entry:

```sh
cat >> CHANGELOG.md << 'EOS'
## 1.3.0 - 2026-09-08
- minor: add installExtras boolean default false, backward compatible
EOS
cat CHANGELOG.md | head -n 20
```

Done when: collection.json parses and version equals after, CHANGELOG.md has 1 new entry with version and date, git diff shows 2 files changed. Gate: collection.json stale or changelog missing entry, update before publish.

### 5. Republish via publish workflow

Reuse publish-feature.md steps 4 to 6. Push with the same namespace. Handle GHCR 409 duplicate as a signal to bump again, not to force push.

Require 1 publish per bump. Abort on 409 and return to step 1 for a higher version.

```sh
# republish single Feature after bump
devcontainer features publish --namespace ghcr.io/myorg/features src/mytool

# republish full collection when you bump 2 or more Features
devcontainer features publish --namespace ghcr.io/myorg/features

# handle 409 duplicate (immutable tag)
# expected error: "409 Conflict: tag 1.3.0 already exists"
# fix: bump to 1.3.1 and republish
jq '.version = "1.3.1"' src/mytool/devcontainer-feature.json > /tmp/new.json && mv /tmp/new.json src/mytool/devcontainer-feature.json
devcontainer features publish --namespace ghcr.io/myorg/features src/mytool
```

Done when: publish exits 0, logs show 4 tags pushed, no 409. Gate: GHCR returns 409 duplicate, bump version and retry. Limit retries to 3, then investigate tag state with oras tags.

### 6. Verify new digest resolves via oras manifest fetch

Fetch the manifest for the new semver and for each floating tag. Compare digests. Require 1 matching digest across all 4 tags for the same version. Treat mismatch as publish failure.

Require 4 fetches, 1 per tag.

```sh
# fetch semver and floating tags
oras manifest fetch --descriptor ghcr.io/myorg/features/mytool:1.3.0 | python3 -c "import json,sys; print(json.load(sys.stdin)['digest'])"
oras manifest fetch --descriptor ghcr.io/myorg/features/mytool:1.3 | python3 -c "import json,sys; print(json.load(sys.stdin)['digest'])"
oras manifest fetch --descriptor ghcr.io/myorg/features/mytool:1 | python3 -c "import json,sys; print(json.load(sys.stdin)['digest'])"
oras manifest fetch --descriptor ghcr.io/myorg/features/mytool:1.0 | python3 -c "import json,sys; print(json.load(sys.stdin)['digest'])"

# verify all digests equal in 1 check
DIGEST_FULL=$(oras manifest fetch --descriptor ghcr.io/myorg/features/mytool:1.3.0 | python3 -c "import json,sys; print(json.load(sys.stdin)['digest'])")
DIGEST_FLOAT=$(oras manifest fetch --descriptor ghcr.io/myorg/features/mytool:1 | python3 -c "import json,sys; print(json.load(sys.stdin)['digest'])")
[ "$DIGEST_FULL" = "$DIGEST_FLOAT" ] && echo "digests match $DIGEST_FULL" || echo "mismatch"
```

Done when: 4 manifest fetches exit 0, each returns sha256 digest, semver digest equals floating digests. Gate: fetch fails or digests diverge, republish or bump again.

## Acceptance Criteria

- Bump type matches the change table, version follows X.Y.Z, before and after recorded.
- devcontainer-feature.json version updated, parses, git diff shows 1 version line.
- Floating tags :1 :1.0 :1.0.0 derived from after version, 4 tags listed.
- collection.json version updated, parses, CHANGELOG.md has entry with version and date.
- Republish via publish workflow exits 0, no GHCR 409, logs show 4 tags.
- 4 oras manifest fetch calls succeed, digests match across semver and floating tags.

## References

- [versioning](../references/versioning.md)
- [publishing-distribution](../references/publishing-distribution.md)
- [containers.dev/implementors/features-distribution](https://containers.dev/implementors/features-distribution/)
- [github.com/devcontainers/action](https://github.com/devcontainers/action)
- [oras.land/docs](https://oras.land/docs/how_to_guides/manifest_fetch/)
