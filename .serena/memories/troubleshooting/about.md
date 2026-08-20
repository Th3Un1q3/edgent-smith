# Troubleshooting

Diagnosis and root-causing knowledge: opencode plugin runtime failures (live-vs-unit divergence, log-based diagnosis, robust detection patterns) plus web/frontend gotchas and no-build static-HTML visualization recipes (subdomain `web/`).

## Scope

- Diagnosing opencode plugin live failures: runtime-log correlation, log location and format, hook-level evidence (a typed hook is a contract, not a guarantee).
- Robust detection patterns: precise token shapes (UUID-v4 ids, full self-closing tags) over substring matching.
- Plugin runtime gotchas: restart-to-apply for plugin changes, per-plugin log attribution.
- Session-review subdomain (`session-review/`): session_parts.py CLI resilience gotchas and opencode restart-verification status.

- Web/frontend gotchas and no-build static-HTML visualization recipes (subdomain `web/`): script-tag JSON embedding escapes, standalone graph rendering.

## Boundaries (out of scope)

- Mechanism design and refactoring knowledge - see mem:refactoring/about (envelope mechanism, hook lifecycle, imports).
- Testing methodology and test-writing - see mem:testing/about.
- Docker MCP gateway diagnostics - see mem:docker-mcp-gateway/host-side-diagnostics.
- Research-process probing - see mem:research-process/about.

## Related Domains

- mem:refactoring/about - plugin mechanisms and their runtime behavior
- mem:testing/about - what tests can and cannot prove
