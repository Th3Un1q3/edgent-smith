# Image Pull & Start Mechanics ("No such image" → EOF)

**Symptom**: a code-mode sandbox for a container-backed (`type: server`) catalog server fails with `No such image: <image>` and then `calling "initialize": EOF` when the container never spawns.

**Cause**: the gateway pulls container images at **mcp-add time** — when a server is added via the `mcp-add` tool — NOT when a code-mode sandbox is created. A code-mode sandbox created for a server that was never added (no `mcp-add` call) finds no image and no container, producing `No such image` followed by `calling "initialize": EOF`.

**Mechanics**:

- Image pull happens during the `mcp-add` call; the gateway provisions no images for servers that were never added.
- Creating a code-mode sandbox does NOT pull or spawn the server by itself.
- With `--enable-all-servers`, servers start — and their images are provisioned — on gateway startup.

**Not the cause**: the container image's transport is NOT the reason for these failures. `mcp/fetch` and similar images work fine once the server is enabled (added or auto-started); do not build image-store, pre-pull, volume, or transport theories to explain a spawn failure.

See mem:docker-mcp-gateway/server-enablement for the two working configurations.