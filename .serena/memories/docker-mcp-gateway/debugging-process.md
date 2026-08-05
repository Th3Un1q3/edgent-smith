# Debugging Process — Research Tool Mechanics Before Theorizing

Infra failures in a chained stack progress DOWNSTREAM after each fix — an error chain can move from `No such image` to `calling "initialize": EOF`, where each stage is a new failure with its own cause. Re-diagnose from scratch at each stage; a fix that merely changes the error does not complete the chain.

**Rules**:

- Research the ACTUAL tool mechanics FIRST: read the tool's documented behavior (docs, reference Q&A such as Deep Wiki, or ask the operator how their system is configured) before building low-level infrastructure theories (image stores, volumes, transports).
- A root-cause explanation must match how the tool actually behaves. The authoritative incident: the mechanism — images pull at `mcp-add` time; servers start via `--enable-all-servers` or after an agent calls `mcp-add` — was found by querying how the gateway actually works. The pre-pull/volume and HTTP-only-transport theories did not fix the failure because they targeted the wrong layer.
- Verify a "fix" against the documented mechanism before accepting it — a workaround that does not change the mechanism cannot resolve a spawn failure.
- Pair each observed error with the check that would have found its cause before deep-diving internals.

Related failure modes: mem:docker-mcp-gateway/image-pull-mechanics, mem:docker-mcp-gateway/server-enablement.