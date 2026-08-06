# Security Controls: Digest Pinning, --block-secrets, disableNetwork

mcp/* server images must be digest-pinned (`image@sha256:...`): signature verification defaults on in this gateway, and mutable tags violate it — the catalog's `mcp/fetch:latest` and `mcp/youtube-transcript:latest` entries currently do and may fail under verification; the filesystem entry is pinned. Pin any added server image. (Source: gateway docs + catalog inspection.)

`--block-secrets` (set on gateway startup) is value-heuristic: it scans tool-call arguments and text responses for secret-LIKE values, not paths. It does not block a server reading a secret FILE — e.g., `.env` content returned verbatim by a filesystem tool passes through. Do not rely on it as file-level access control. (Source: live probe + gateway startup flags.)

`disableNetwork: true` on a catalog entry is the server-level egress cut-off (set on the filesystem server); it complements — but does not replace — bind allowlists and server-side sandboxing. (Source: catalog inspection + gateway docs.)

Refs: mem:devcontainer-workflows/secrets-dependencies (tag-pinning principle; this adds digest/flag mechanics), mem:docker-mcp-gateway/host-side-diagnostics.
Before finishing an add, run the decision-tree rule: a context-gathering-capable server requires updating the context-gathering references/server-selection.md and references/content-fetch-api.md (mem:docker-mcp-gateway/server-addition).