# Troubleshooting

Diagnosis and root-causing knowledge for opencode plugin runtime failures: live-vs-unit divergence, log-based diagnosis, and robust detection patterns.

## Scope

- Diagnosing opencode plugin live failures: runtime-log correlation, log location and format, hook-level evidence (a typed hook is a contract, not a guarantee).
- Robust detection patterns: precise token shapes (UUID-v4 ids, full self-closing tags) over substring matching.
- Plugin runtime gotchas: restart-to-apply for plugin changes, per-plugin log attribution.

## Boundaries (out of scope)

- Mechanism design and refactoring knowledge - see mem:refactoring/about (envelope mechanism, hook lifecycle, imports).
- Testing methodology and test-writing - see mem:testing/about.
- Docker MCP gateway diagnostics - see mem:docker-mcp-gateway/host-side-diagnostics.
- Research-process probing - see mem:research-process/about.

## Related Domains

- mem:refactoring/about - plugin mechanisms and their runtime behavior
- mem:testing/about - what tests can and cannot prove
