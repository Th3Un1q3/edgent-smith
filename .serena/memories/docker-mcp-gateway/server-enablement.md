# Server Enablement — Auto-Start vs Agent-Add

**Symptom**: a container-backed (`type: server`) catalog server fails with `No such image` and/or `calling "initialize": EOF` while remote (`type: remote`) servers keep working.

**Cause**: the gateway spawns container-backed servers only when they have been ADDED (pull-on-mcp-add) OR when they auto-start via `--enable-all-servers`. Creating a code-mode sandbox does not pull or spawn the server by itself — an un-added server has no image and no container. A commented-out `--enable-all-servers` is not itself the cause; the cause is that the server is neither added nor auto-started.

**Two working configurations**:

| Path | How it works | Requirement |
|---|---|---|
| Auto-start all servers | `--enable-all-servers` starts every catalog server (and provisions its image) on gateway startup; the operator activates it via the Dev Container setup | Reliable default; no agent action needed |
| Agent calls `mcp-add` first | The `mcp-add` call triggers the image pull, then the agent creates the code-mode sandbox | The agent MUST have the `mcp-add` tool in its toolset |

**Agent-tooling requirement**: if the agent's toolset lacks the `mcp-add` tool, it cannot add servers — then the gateway must auto-start all servers via `--enable-all-servers`.

**Triage**: confirm the sandbox was attempted without adding the server first; check the agent toolset for `mcp-add`; check the gateway launch flags for `--enable-all-servers`.

See mem:docker-mcp-gateway/image-pull-mechanics for the pull/start mechanism.