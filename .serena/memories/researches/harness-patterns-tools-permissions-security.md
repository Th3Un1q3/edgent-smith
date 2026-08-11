# Harness Engineering Patterns - Tools, Permissions & Security

Cluster A of @aiDotEngineer harness-engineering mining (2026-08-07). Extracted from 3 cached transcripts via in-sandbox keyword-filtered reads (never full dumps). Intermediate checkpoint for consolidation; ground truth lives in the cache entries below.

## Sources
- mem:cache/youtube-videos/ai-engineer/ai-engineer-worlds-fair-2025-day-1-keynotes-mcp-track-ft-ant_z4zXicOAF28 (300K) - WF2025 MCP track: MCP origin/spec (Theodora Chu), Anthropic remote-MCP gateway (John), observability (MCP.Run/Dipso), marketplace talk.
- mem:cache/youtube-videos/ai-engineer/aie-code-2025-ai-leadership-ft-anthropic-openai-mckinsey-blo_cMSprbJ95jg (351K) - Anthropic platform talk, OpenAI Codex Harness (Bill Chen & Brian Fioa), DIA browser security talk.
- mem:cache/youtube-videos/ai-engineer/wf2026-software-factories-keynotes-ft-microsoft-openai-openc_htM02KMNZnk (450K) - OpenAI keynote, Peter Steinberger (OpenClaw), Conductor, Eric Meyer (Linet Labs).

## Method
Each transcript read INSIDE serena sandbox: split 1800-char windows (900 step), scored vs keyword seed set (mcp, tool, permission, oauth, sandbox, security, poison, credential, scope, gateway, protocol, remote, client, server, capability, trust, risk, attack), top non-overlapping windows returned, ~19K chars/transcript cap, plus targeted offset digs for dense regions. ~75K chars consumed of 1.1M total.

## Patterns (15)

### P1. Model Agency via Open Standard Protocol
- Problem: model confined to context box cannot act; bespoke integrations do not scale.
- Pattern: standardize tool access as an open-source protocol so the model gains context + actions uniformly across clients/servers.
- Evidence: "the genesis of MCP was really around this big question of uh not just context but model agency. How do you actually give the model the ability to interact with the outside world?" - Theodora Chu (Anthropic), WF2025 MCP track.
- Classification: established. Cross-ref: catalog Tool Search Lazy Loading (MCP) is downstream.

### P2. Server-First Protocol Design
- Problem: every tool protocol burdens client or server; misreading the population ratio misallocates that burden.
- Pattern: when servers will vastly outnumber clients, optimize spec for server simplicity + server-builder tooling; accept asymmetry/bidirectional messaging.
- Evidence: "there will be a lot more servers than there are clients... we optimized for server simplicity and for the server uh server builders to have better tooling" - Theodora Chu (Anthropic), WF2025 MCP track.
- Classification: emerging (contested: "we could be totally wrong on this").

### P3. Centralized Agent Gateway (routing + credentials + rate limiting)
- Problem: remote MCP needs external connectivity + auth; per-consumer OAuth repeats work, fragments control.
- Pattern: gateway between consumers and tool servers: URL-based routing for internal/external alike, automatic credential management, centralized rate limiting + observability.
- Evidence: "we used URL based routing to route to external servers, internal servers, it doesnt matter. Its all the same call. Uh we handle all the credential management automatically because you dont want to be implementing OOTH five times in your company. Uh gives you a centralized place for rate limiting and observability" - John (Anthropic), WF2025 MCP track (OOTH = OAuth, ASR).
- Classification: validated (Anthropic production).

### P4. Credential Portability via Gateway-Held OAuth
- Problem: batch jobs / long-lived agents must not force re-auth per run.
- Pattern: run OAuth authorization-URL + completion flow at the gateway so credentials are portable across endpoints and job contexts.
- Evidence: "were handling OOTH at the gateway... We added a get ooth authorization URL function and a complete ooth flow"; "A real advantage of having this put on your gateway is that the credentials are portable. If you have a batch job that youre kicking off..." - John (Anthropic), WF2025 MCP track.
- Classification: established.

### P5. Tool Lazy-Loading via Dynamic Capability Discovery
- Problem: publishing thousands of tools statically floods context; more tools = riskier results.
- Pattern: client dynamically discovers tools relevant to current workflow; only needed tools enter context.
- Evidence: "the client connects to the MCP server and dynamically discovers tools... lets say we have like 5,000 tools... there is simply no way we could publish all these tools through open API because you know the context would be just too large and like the more tools you have the you know riskier the result is" - WF2025 MCP track (marketplace talk).
- Classification: validated. Cross-ref: catalog Tool Search Lazy Loading (MCP) - same pattern, first-party evidence.

### P6. Lethal Trifecta: private data + untrusted content + tools
- Problem: tool calls turn AI safety debate into real danger - irreversible harm via prompt injection + actions.
- Pattern: design the harness around the combination (private data + untrusted content + action tools), not any single element.
- Evidence: "our agents have access to private data. They have untrusted content like the prompt injections and now we give them tools. Simon Wilson calls this the lethal trifecta" - Eric Meyer (Linet Labs), WF2026. Also: "tool calls is like handing a gun, a loaded gun to them" - same talk.
- Classification: established (DIA talk independently confirms the triad).

### P7. Plan-Not-Execute: Air-Gap the Agentic Loop
- Problem: model that plans AND executes produces side effects before any check ("it might empty your bank account... then it gives you a safe answer").
- Pattern: model emits a plan/program (type IO); a separate trusted executor runs it after inspection; check before side effects.
- Evidence: "all that were doing is were pushing this IO to the right... instead of executing the agentic loop, it creates a plan and says, Here is the plan to do the agentic loop. And now Bernie will take that plan and well execute it"; "were airgapping the agentic loop from the agent. So we dont let the agent run the agentic loop before the agent run it. We want to be able to check it" - Eric Meyer (Linet Labs), WF2026.
- Classification: emerging (provable-safety direction, Lean/type-system flavored).

### P8. Human Confirmation Gate at the Action Boundary
- Problem: injection defenses fail; last control point is the human at the moment of irreversible action.
- Pattern: read-and-confirm step before sensitive writes (form autofill etc.): user sees plain text, keeps control/awareness; bounds blast radius without preventing injection.
- Evidence: "before the form is written to, we actually let the user read and confirm that data in plain text. This doesnt prevent a prompt injection, but it gives the user control, awareness" - DIA browser-agent talk, AIE Code 2025.
- Classification: validated (matches Claude Code approval UX + Conductor slot-free zones).

### P9. Sandboxed / Isolated Execution Environment
- Problem: agents run code that is not pre-approved; user machines/laptops cannot safely or at scale host long-running parallel work.
- Pattern: secure disposable execution env: code-execution tools, container orchestration at scale, session persistence, separate test boxes.
- Evidence: "We needed a secure environment for claude to be able to write and run code thats not necessarily like approved code by you... container orchestration at scale" - Anthropic platform talk, AIE Code 2025. "Thats mostly fixed by using test boxes. So agents can run tests on a separate machine" - Peter Steinberger (OpenClaw), WF2026.
- Classification: validated.

### P10. Slot-Free Zones: Human-Review-Mandatory Code Areas
- Problem: unreviewed agent edits to critical paths (migrations/auth/billing) silently rot codebases.
- Pattern: partition codebase into loose vs slot-free zones; CI enforces mandatory human review for the latter; treat CLAUDE.md/skills as curated human context.
- Evidence: "a slot-free zone is a part of the codebase or a part of the app that requires really strict human review... any change to the migrations file requires the a uh a human to review it" - Conductor talk, WF2026.
- Classification: emerging.

### P11. Harness as the Abstraction Layer
- Problem: model churn makes rebuilding prompt/tool stacks per model unsustainable.
- Pattern: encapsulate harness (prompts + tools + agent loop) as reusable surface; open-source reference harness so partners align; not a mere wrapper.
- Evidence: "in the most reductive way, you can sort of think of it as a collection of prompts and tools combined in a core agent loop which provides input and outputs uh from a model"; "harness becoming the new abstraction layer... you no longer have to care about optimizing the prompt and tools with every model upgrade" - Bill Chen & Brian Fioa (OpenAI), AIE Code 2025.
- Classification: established (Codex; adopted by GitHub/Zed/Cursor).

### P12. Tool Result Hygiene (Context Management)
- Problem: tool results accumulate and fill the window; old results rarely relevant later.
- Pattern: clear/compact stale tool results; pair with memory tool; measured 39% perf bump; extreme form = semantic compression (screenshot ~1.1K tokens vs 20K-token DOM).
- Evidence: "tool results from past calls are not necessarily super relevant to help claude get good responses later on in a session... we saw a 39% bump in performance" - Anthropic platform talk, AIE Code 2025. "The full DOM for this would be around 20,000 tokens... this screenshot is about 1,100 tokens" - WF2026 UI talk.
- Classification: validated. Cross-ref: catalog Context Window Auto-Compaction, Context Budget, Semantic Context Filtering.

### P13. Harness-Model Co-training
- Problem: models given unfamiliar tools underperform; training habits conflict with ill-fitted prompts.
- Pattern: build model + harness together; feed harness into post-training so models learn to call tools in the real env; align partner tools to training distribution; avoid overprompting.
- Evidence: "we also bring this codeex harness into the post-training process of our model. So that means the models can learn to call tools and navigate an environment thats actually something thats open source" - OpenAI keynote, WF2026. "aligning their tools to be in distribution with how the model is trained" - Bill Chen & Brian Fioa, AIE Code 2025.
- Classification: emerging (frontier-lab practice).

### P14. Tool Proliferation / Schema Bloat Risk
- Problem: enterprises use hundreds of tools; schemas/params/descriptions bloat context and cause wrong-tool selection between similar tools.
- Pattern: treat tool surface as a context-management + selection problem: catalog, gate, compress specs; engineer against bloat-induced misselection.
- Evidence: "enterprises especially they use hundreds tools... all these have specification in the code. All these have schema and parameters and log descriptions. So uh it can cause agent to really bloat with that and pick wrong tools" - WF2026 Software Factories.
- Classification: emerging. Cross-ref: P5 is the mitigation; catalog Context Budget.

### P15. Distributed Tracing Across Tool Boundaries
- Problem: agent tool calls span remote servers/agents; failures invisible without cross-boundary visibility.
- Pattern: OpenTelemetry spans + context propagation stitch client/server traces at a shared sink; end-to-end tool-call visibility across languages/environments.
- Evidence: "with distributed tracing and context propagation. We can have the remote fetch server send its spans to the same sync as the client and the sync will just stitch together the missing uh parts of the trace" - MCP observability talk (MCP.Run/Dipso), WF2025 MCP track.
- Classification: validated (OTel de-facto standard). Cross-ref: observability cluster; pairs with P3.

## Per-transcript coverage
- WF2025 MCP track: RICH (P1-P5, P15). Origin story, spec philosophy, Anthropic gateway/OAuth, tool discovery, observability. Transport-level security details NOT covered (talk was ecosystem-level).
- AIE Code 2025: RICH (P6, P8, P9, P11-P13). Codex harness anatomy + security surface list (sandboxing, prompt forwarding, permissions, port mgmt) is gold; Anthropic context editing + code execution tool; DIA injection-exfiltration demo + human confirm gate. No deep threat-model detail.
- WF2026: RICH (P6-P10, P12-P14). Eric Meyer provable safety (lethal trifecta, plan-not-execute, Lean IO typing); OpenClaw manager-of-agents loop, test boxes, cross-host mobility; Conductor slot-free zones + free-range cloud sandbox agents; OpenAI open-source harness + post-training.

## Coverage gaps (for consolidation)
- Adversarial tool-description/poisoning specifics NOT covered - flagged via blocked talk Your Insecure MCP Server Wont Survive Production (BurJvbqFr4c).
- OAuth-for-agents deep dive (Jared Hanson, blmAkayzE8M) blocked - P4 only covers gateway-held OAuth.
- Claude Code permission-model internals (Boris Cherny, Lue8K2jqfKk) blocked.
- Credential handling inside sandboxes (env vars, mounts) thin - only container-orchestration + test-box mentions.
- Least-privilege not named in any transcript; concept appears implicitly (slot-free zones, sandboxing).

## Cached sources
- mem:cache/youtube-videos/ai-engineer/ai-engineer-worlds-fair-2025-day-1-keynotes-mcp-track-ft-ant_z4zXicOAF28
- mem:cache/youtube-videos/ai-engineer/aie-code-2025-ai-leadership-ft-anthropic-openai-mckinsey-blo_cMSprbJ95jg
- mem:cache/youtube-videos/ai-engineer/wf2026-software-factories-keynotes-ft-microsoft-openai-openc_htM02KMNZnk
- Taxonomy: mem:researches/agentic-patterns-context-memory-patterns, mem:researches/agentic-patterns-memory-patterns