---
id: ADR-013
title: Native Code Mode for MCP access with the Docker MCP gateway retained
status: accepted
date: 2026-10-23
scope: MCP transport, permissions and attribution across OpenCode, DSH, VS Code and Copilot clients
---

# ADR-013: Native Code Mode for MCP access with the Docker MCP gateway retained

**Note (2026-10-23):** the supersede by ADR-014 was withdrawn on 2026-10-23 because the probe behind it was permission-filtered — a `gateway_*` deny rule had hidden 223 of the 226 gateway tools from the session — so the addressing decision stands.

Status: Accepted
Date: 2026-10-23

## Decision

OpenCode v2 native Code Mode is the only script layer for MCP access: agents call `execute` and address the gateway endpoint's tools directly as `tools.gateway["<tool>"]`. The Docker MCP gateway is retained as the single aggregated endpoint for its nine catalog servers and stays the only holder of upstream credentials and the only enforcer of `disableNetwork` for local servers. The gateway's own wrapper methods (`mcp-exec`, `mcp-find`, `code-mode`) are demoted off the agent-facing path: no permission rule, instruction, or skill teaches or requires them, while the gateway image keeps them for DSH and ad-hoc clients. Every config, permission, and prose change is gated on the validate-first checks in Open questions; this record decides direction, not implementation.

## Considerations

### Context

Today every MCP call traverses two script layers:

```
execute (native) -> gateway_code-mode (JS sandbox in the gateway container)
                 -> gateway_mcp-exec -> upstream server tool
```

- Redundant interpreter hop. The inner sandbox predates native Code Mode and adds a second lifecycle, error surface, and timeout per call. Recorded volume shows it is the dominant path, not an exception: `gateway_mcp-exec` 6300 calls, `gateway_mcp-find` 1441, `gateway_code-mode` 1125 in `opencode.db`.
- Permissions maintained per gateway method. `opencode.jsonc:81-84` denies `gateway_*` then re-allows three methods; the upstream server or tool is not expressible, so one `gateway_mcp-exec` call can reach any of the nine catalog servers. Four agent definitions repeat the coarse pattern.
- Name-only attribution, invisible inner calls. A tool call is one `part` row holding `data.state.input`; no server field exists. Because the inner script runs inside the gateway container, inner server and tool names never reach `opencode.db`, the `.opencode/plugins/sessions/<id>.json` mirror, or the plugin hooks, which see only `event.tool`, `input`, `sessionID`, and `status`.
- Context paid three times. Wrapper schemas, plus a taught find -> code-mode -> exec chain re-enumerated in 22 files under `.agents/skills/` and `.opencode/instructions/`, on top of the native namespace cost.
- The gateway earns retention on grounds independent of transport: one URL aggregates nine servers for four harnesses; `--secrets=/run/secrets/mcp_creds` with `--block-secrets` keeps credentials out of client configs; `disableNetwork: true` on `filesystem` cannot be expressed client-side; `--log-calls` is an out-of-process audit trail.
- Evidence base and full before/after analysis: `docs/plan/2026-10-23-mcp-code-mode-optimization/before-after-proposal.md`.

### Options considered

#### Option A: Keep nested gateway code mode (standardise on the wrapper)

Pros:
- No migration; the path works today.
- The inner sandbox bounds what a script can reach, and `code-mode` requires declaring `servers[]` first.
- One documented call shape for every caller.

Cons:
- Two interpreters, two timeouts, and two error surfaces per call.
- Permissions stay per wrapper method and cannot express server or tool.
- Inner calls stay invisible to attribution, plugins, and the session mirror.
- Prose must keep teaching the chain, so the wrapper remains the default.

#### Option B: Native `execute` with the gateway retained (chosen)

Pros:
- One sandbox, one hop; independent calls can be composed in one script.
- Permission surface becomes tool-shaped (`<server>_<tool>` pattern subject to V4/V5), no longer method-shaped.
- Each MCP call becomes its own `part` row, enabling per-server volume and per-tool timing by group-by.
- One endpoint convention for OpenCode, DSH, VS Code, and Copilot; secret and network policy unchanged.

Cons:
- Permission collapse risk: allowing `execute` is one event, and the grant is broader than today's three-method allowlist if the tool-action mapping fails.
- Subagents lose per-tool gating because MCP reach becomes `execute`-only.
- Multi-tool scripts can lose partial-failure detail unless scripts return keyed results.

#### Option C: Register all nine servers flat in every client, no gateway

Pros:
- True per-server namespaces and per-server permission actions.
- No wrapper terminology anywhere.

Cons:
- Nine entries multiplied by four harnesses, each with its own auth.
- Secrets move into per-harness config files.
- Loses `disableNetwork` enforcement and the out-of-process audit trail; no client config can express either.

#### Option D: Do nothing

Pros:
- Zero effort and zero risk of regression.

Cons:
- Two inventories (catalog and prose) keep drifting.
- No per-server attribution, and context keeps paying for a hop native Code Mode already provides.
- The wrapper remains the de facto standard by inertia rather than decision.

### Scoring

Criteria, each scored -2 to +2 (higher is better; implementation cost is scored so that cheaper is higher):

| Criteria | A keep nested | B native + gateway | C nine flat | D do nothing |
|---|---|---|---|---|
| Maintainability | -1 | +2 | -2 | -2 |
| Flexibility | 0 | +2 | +2 | -1 |
| Implementation ease | +2 | 0 | -1 | +2 |
| Initial implementation cost | +1 | -1 | -2 | +2 |
| Total | +2 | +3 | -3 | +1 |

Option B wins on total. Option C's flexibility advantage does not survive its security constraints: losing `disableNetwork` enforcement and moving secrets into client configs are disqualifying, and that constraint override is recorded here rather than in the Decision.

### Consequences

Positive:
- One script layer and one failure point per MCP call; concurrency inside a script becomes expressible (subject to V7).
- Permission policy keyed to tools rather than wrapper methods, so a wrapper rename no longer forces an allowlist edit.
- Per-call attribution: group-by on tool name yields per-server volume, per-tool error rate, and `state.time` deltas without new instrumentation.
- One MCP-layer convention across harnesses; each harness's wrapper naming disappears from instruction text.
- `mcp/catalog.yaml` stays the only server inventory; prose points at the endpoint instead of enumerating servers.

Negative:
- Permission collapse (proposal 5.1). If the action evaluated inside `execute` is not `gateway_<tool>` as assumed, allowing `execute` grants every tool the endpoint exposes, strictly broader than today's allowlist. Mitigation: keep `gateway_*: deny` as the default, prove the mapping with a deliberate single-tool deny before removing companion rules, and treat V4 as a stop gate.
- Subagents lose per-tool gating (proposal 5.2). `rug-team-coach.md` denies `*`; `rug-swe.md` denies `list_mcp_*` and `read_mcp_*`; `rug.md` and `rug-workflow.md` deny `*` then allow `execute`. Once MCP reach is `execute`-only, a subagent either has the whole endpoint surface the top-level policy allows or nothing. This is a documented regression, not a silent one; the agent files are user-owned and untouched here.
- Script-level partial failure (proposal 5.3). A five-tool script failing on the third reports one error unless the script returns keyed partial results. Mitigation: prescribe a results-by-step return convention in the prose rewrite.
- Version drift (proposal 5.4). Code Mode is default-on in 2.1.1 with no global enable key and the install is unpinned; a release that flips the default or renames the permission action would change the posture silently. Mitigation: pin, or assert `execute` exists and `codemode` is not disabled at startup.
- Namespace and prefix uncertainty (proposal 5.5). If gateway tool names carry no upstream prefix, row-level attribution shrinks to per-tool only; both outcomes are acceptable, but only one is assumable after V5.
- Context cost may move rather than shrink (proposal 5.6). Removing wrapper schemas adds `execute`'s own guidance; without `search` the model may guess tool names. The claim is unproven until measured.

### Migration plan

Phase 0 — Validate (no writes, no config edits). Layer: running OpenCode 2.1.1 install. Run the eleven checks in Open questions on a scratch config and record the build identifier. Closes when each question has a recorded answer, and V4 plus V5 are answered before any permission edit.

Phase 1 — Client config shape. Layer: `opencode.jsonc`. Candidate change, gated on V2 and V3: declare the gateway under the current `mcp.servers.<name>` shape instead of legacy flat `mcp.gateway`, because the target state needs per-server keys such as `codemode` that must not depend on legacy normalisation. Add an explicit top-level `execute` permission entry whose value comes from V6. Closes when the resolved namespace and the `codemode` opt-out are both demonstrated on the reshaped entry, and the endpoint still lists its tools.

Phase 2 — Permissions. Layer: client permission policy and agent frontmatter. Replace the three wrapper allow rules with a tool-shaped policy that keeps `gateway_*: deny` as the default and enumerates the tool actions workflows actually use, in the form V4/V5 prove. Closes when a deliberate deny on one tool blocks that call inside `execute` while an allowed tool succeeds, and the agent-definition regression is reported to its owner rather than edited.

Phase 3 — Instruction and skill prose. Layer: `.agents/skills/context-gathering/**`, `.agents/skills/serena-memory/**`, `.opencode/instructions/serena-gateway.instructions.md`. Replace the find -> code-mode -> exec recipe with the direct endpoint call shape, delete the per-server prose inventory in favour of a pointer to `mcp/catalog.yaml`, and keep the memory gate, disclosure budgets, 2 KB snapshot, empty-return fallback, and the `list_memories` -> `read_memory` ritual byte-identical. Closes when no agent-facing prose matches `gateway_mcp-exec|gateway_code-mode|gateway_mcp-find`, and one live memory store plus one recall round-trip still pass the gate.

Phase 4 — Cross-harness configs. Layer: `.dsh/child-runtime/cordis.yml`, `.dsh/cordis.patch.yml`, `.vscode/mcp.json`, `.copilot/mcp-config.json`. Keep DSH's `mcp__gateway__<tool>` naming because it is that harness's transport convention, and resolve the commented host bridge rather than leaving it dormant. VS Code already routes through the gateway and needs no change. Decide whether Copilot's `context7` and `deepwiki` bypass is brought behind the gateway or documented as a deliberate exception. Closes when each harness names the same endpoint, or its exception is recorded.

Phase 5 — Telemetry and attribution. Layer: `opencode.db` queries and plugin hooks. Add a query, not a collector, reporting per-`<server>_<tool>` call volume, error rate, and `state.time` deltas, plus a retention note for a database already at 5.6 GB. Per-tool token cost is not derivable from `part` rows; record either a usage-delta plugin decision or an explicit decision to live without it. Closes when the query returns per-tool rows on post-migration traffic and a fixed-task context delta is measured and reported.

Phase 6 — Retire wrapper allow rules. Layer: `opencode.jsonc`. Remove the three wrapper allow entries only after Phase 3's grep and a caller audit both show no agent-facing caller. Closes when the policy contains no wrapper-method entry and the endpoint still serves every workflow.

Ordering constraint: Phases 1 and 2 must precede Phase 3 in effect, because prose must not teach a call shape the permissions reject. Phase 6 must follow Phase 3, because dropping the allow rules before the callers are gone breaks working flows.

### Rollback

- Config: the gateway image keeps `mcp-exec`, `mcp-find`, and `code-mode`, so rollback is a client-side revert — restore the flat `mcp.gateway` entry and the three wrapper allow rules, and remove the `execute` entry. No image rebuild and no catalog change are needed.
- Prose: each Phase 3 file group reverts independently; the memory gate and disclosure semantics were not modified, so no memory correctness regression is possible from the revert.
- Cross-harness: Phase 4 changes are per-file and independently revertible.
- Tripwires: if V4 shows the deny does not bind inside `execute`, stop after Phase 1 and revert Phase 2. If V7 or V8 fails, withdraw the latency and error-surface claims and re-score; the migration may still proceed on attribution and maintenance grounds, but must not claim those benefits.

### Verification criteria

- [ ] V1 through V11 answered and the exact OpenCode build recorded.
- [ ] `execute` resolves the gateway namespace and the `tools.gateway["<tool>"]` call shape.
- [ ] A deliberate single-tool deny blocks that tool inside `execute`, and an allowed tool still succeeds.
- [ ] No agent-facing prose mentions `gateway_mcp-exec`, `gateway_code-mode`, or `gateway_mcp-find`.
- [ ] Memory store and recall round-trip pass the typed-memory gate; the return ritual is unchanged.
- [ ] Attribution query reports per-tool volume, error rate, and time deltas; the fixed-task context delta is measured, not asserted.
- [ ] All four harness configs name one endpoint, or their exception is documented.
- [ ] Quality gates pass and no `.serena/memories` path was read or written outside the gateway.

### Open questions (validate before committing)

Each item is a gate, not an instruction; none of the mechanisms below is settled by this record.

1. Does `search` exist inside `execute`? If absent, the full tool list is the exposure and the context-cost claim must be re-measured.
2. What is the exact normalised server key for the gateway, in the legacy flat shape and in the `mcp.servers.<name>` shape?
3. Does the legacy `mcp.<name>` shape honour `codemode: false`, or only `mcp.servers.<name>`? This decides whether the reshape must precede any opt-out.
4. Which permission action is evaluated inside `execute` — `gateway_<tool>`, and does the upstream server appear in it? Test with a deliberate deny.
5. Do gateway tool names carry the upstream server prefix (`serena_find_symbol` versus `find_symbol`)? This decides both attribution granularity and the allowlist pattern.
6. What are the `execute` permission semantics: the entry name, whether `ask` is honoured inside a session that started with `allow`, and what denying `execute` with resource `*` actually removes?
7. Do independent `tools.*` calls inside one script run in parallel rather than serialising?
8. Does a throwing call inside a script produce a `part` row with a usable message and a distinguishable `status`?
9. How does a `*: deny` plus `execute: allow` frontmatter pair behave for a subagent, and can a per-agent permission block restore per-tool gating?
10. Can `execute.before` and `execute.after` see per-call detail? If yes, the telemetry phase simplifies.
11. Which exact 2.1.1 build was validated, and what do its release notes state about the Code Mode default? The devcontainer pins nothing.

### References

- Proposal: `docs/plan/2026-10-23-mcp-code-mode-optimization/before-after-proposal.md`.
- Sibling decisions: `mem:architecture/adr/ADR-011-native-session-scoped-instruction-entries`, `mem:architecture/adr/ADR-012-standalone-subtask-trio`.
- Convention: `mem:architecture/adr-rules`, `mem:architecture/adr-template`.
- ADR-011 pairs with a migration plan at `docs/plan/2026-10-20-adr-011-instruction-entries/migration-plan.md`; if this decision is implemented, its sequencing belongs in a companion plan under `docs/plan/2026-10-23-mcp-code-mode-optimization/`, which references this record rather than restating it.
- Non-breaking rollout plan: `docs/plan/2026-10-23-mcp-code-mode-optimization/non-breaking-rollout.md`.
