# Change Management & Validation for Environment Edits

**Use when:** editing devcontainer.json, docker-compose.yml, Dockerfiles, justfiles, or any config that defines a shared dev environment.

## Pitfalls
- Diving into edits before understanding scope → architecture rework mid-task.
- Eyeballing config edits → syntax/grammar breakage that only the real tool catches (a single identifier character, e.g. a colon inside a recipe name, silently breaks the entire config file).
- Treating "looks fine" as validated when the real runtime/parser is unavailable.

## Rules
1. Ask 2–4 high-leverage clarifying questions (what to expose, what infra/accounts exist, security posture) BEFORE research — the answers change the architecture. Include: who runs the target process — host or container? If it needs HOST-ONLY resources (e.g. launching the host Chrome), it MUST be a literal host-OS process — never a sidecar/dind container (operator-verified rule).
2. Research in parallel, present a plan with acceptance criteria, get explicit approval before touching the repo.
3. Keep change sets minimal and exactly scoped; verify with `git status --porcelain` + `git diff --stat` that only intended files changed (makes rollback trivial).
4. After every edit, run the tool's own parser/runner: `just --list` / `just -n <recipe>`, `docker compose config`, `python -c yaml/json load`.
5. Follow the target tool's existing naming conventions to avoid syntax surprises.
6. Verify runtime prerequisites (versions/engines — compare `node --version` against the tool engines) BEFORE wiring config: a too-low host tool produces cryptic, often invisible failures.
7. If the change adds an MCP server to the gateway catalog, apply the decision-tree rule: a context-gathering-capable server requires updating the context-gathering skill's references/server-selection.md and references/content-fetch-api.md (mem:docker-mcp-gateway/server-addition).

## Self-check
- [ ] git status/diff show exactly the intended files
- [ ] the real tool's parser/list/dry-run passes

## Related

- Host-launched services from the repo: mem:devcontainer-workflows/host-side-service-launchers (general pattern); mem:devcontainer-workflows/devtools-mcp-host-process (concrete case).
- Hook timing/shell semantics: mem:devcontainer-workflows/lifecycle-hook-semantics.
