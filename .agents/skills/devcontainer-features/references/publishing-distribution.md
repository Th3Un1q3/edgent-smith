# Reference: Publishing and distribution

Use this reference when you publish a Feature as an OCI artifact to GHCR.

## When to load

Load when you push a Feature, configure `collection.json`, choose the CLI or the GitHub Action, or set package visibility.

## Vocabulary

- **OCI artifact** — a registry object with a manifest and layers that stores a Feature tarball; Features push to an OCI registry with `oras`.
- **collection** — the set of Features under `src/` indexed by `src/collection.json` and published under one GHCR namespace.
- **GHCR** — GitHub Container Registry at `ghcr.io`; the default OCI registry for Features.
- **oras** — the OCI Registry As Storage CLI that pushes and pulls OCI artifacts.
- **collection.json** — the optional collection manifest at `src/collection.json` that declares `sourceInformation.source` for discovery.
- **devcontainers/action** — the GitHub Action that publishes all Features in a collection on release.
- **supporting tools** — editors and CLIs that implement the Features spec to install Features from OCI.

## OCI artifact and namespace

Push one OCI artifact per Feature. Namespace rules follow OCI distribution: `ghcr.io/<owner>/<collection>/<feature-id>`.

Monorepo collections share one owner and one collection name; scoped repos use `ghcr.io/<owner>/<feature-id>`.

```json
{
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1": {}
  }
}
```

The consumer reference includes the registry, namespace, Feature id, and a floating major tag. The tag resolves to an OCI manifest.

## ORAS commands

Use `oras` to push and inspect artifacts. The CLI and the Action both call `oras` internally.

Push a Feature tarball after packaging:

```bash
oras push ghcr.io/myorg/my-collection/mytool:1.0.0 \
  --artifact-type application/vnd.devcontainers.feature.layer.v1+tar \
  ./mytool.tgz:application/vnd.devcontainers.feature.layer.v1+tar
```

Fetch a manifest to verify the push:

```bash
oras manifest fetch ghcr.io/myorg/my-collection/mytool:1.0.0
```

Pull the artifact back for inspection:

```bash
oras pull ghcr.io/myorg/my-collection/mytool:1.0.0
```

Pin the manifest media type the spec defines; do not push arbitrary layers.

## collection.json shape

Place the file at `src/collection.json` for monorepos. It carries `sourceInformation.source`.

```json
{
  "sourceInformation": {
    "source": "my-collection"
  }
}
```

Validate the file with the collection schema before publishing. An empty `sourceInformation` fails validation. Add optional `features` entries only when you want explicit discovery ordering.

```json
{
  "sourceInformation": {
    "source": "my-collection"
  },
  "features": [
    {
      "id": "mytool",
      "version": "1.0.0"
    }
  ]
}
```

Keep one collection file per repository; scoped repos omit it.

## GH Action vs CLI publish

Choose the publishing path by release scope.

GitHub Action `devcontainers/action` publishes every Feature under `src/` on a tagged release:

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devcontainers/action@v1
        with:
          publish-features: "true"
          base-path-to-features: "./src"
          oci-registry: "ghcr.io"
          namespace: "myorg/my-collection"
          generate-docs: "true"
```

The Action packages each `src/<id>/`, pushes OCI artifacts with floating tags, updates `collection.json` docs, and fails if a tag already exists.

CLI `devcontainer features publish` pushes one Feature for local validation:

```bash
npx @devcontainers/cli features publish \
  --registry ghcr.io \
  --namespace myorg/my-collection \
  src/mytool
```

Use the CLI to pre-check one Feature; use the Action to publish the whole collection in CI. Both require `GITHUB_TOKEN` with `packages: write`.

## GHCR visibility

Packages start private. Toggle to public after the first push.

Set visibility in the GitHub UI: Packages > `my-collection/mytool` > Package settings > Change visibility > Public. Or use the API:

```bash
gh api --method PATCH /orgs/myorg/packages/container/my-collection%2Fmytool \
  -f visibility=public
```

Make the package public before consumers reference it; private packages need a token with `read:packages` on every build.

## Supporting tools expectation

Consumers install Features with tools that implement the spec. VS Code Dev Containers and the `devcontainers/cli` both fetch the OCI artifact and run `install.sh`.

Declare the Feature in `devcontainer.json`:

```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/myorg/my-collection/mytool:1": {}
  }
}
```

The tool pulls `ghcr.io/myorg/my-collection/mytool:1`, extracts the layer, and executes `install.sh` as root during image build.

## Canonical sources

- Spec: [containers.dev/implementors/features-distribution](https://containers.dev/implementors/features-distribution/)
- ORAS: [oras.land/docs](https://oras.land/docs/how_to_guides/oras_push_pull/)
- Action: [devcontainers/action](https://github.com/devcontainers/action)
- CLI publish: [devcontainers/cli — publish](https://github.com/devcontainers/cli/blob/main/docs/features/publish.md)
- Catalog: [containers.dev/supporting](https://containers.dev/supporting)
