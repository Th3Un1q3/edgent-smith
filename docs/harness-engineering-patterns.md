# Harness Engineering Patterns — extracted from @aiDotEngineer (AI Engineer) channel

> **Metadata**
> - Extraction date: 2026-08-07 (with run-6 enrichment on the same date)
> - Method: 24 cached verbatim transcripts from `cache/youtube-videos/ai-engineer/*` (23 mined for patterns; the 24th, a channel promo, contributed no patterns); 6 parallel mining passes (runs 1–4: Clusters A/B/C over the first 12 transcripts; run 6: Clusters D/E/F over 12 newly fetched transcripts); pattern classifications: `validated` / `established` / `emerging`.
> - Provenance (checkpoint memories): `mem:researches/harness-patterns-tools-permissions-security` (15 patterns), `mem:researches/harness-patterns-loop-context-coding` (27 patterns), `mem:researches/harness-patterns-memory-state-retrieval` (20 patterns), run-6 checkpoints `mem:researches/harness-patterns-tools-security-run6` (21 patterns), `mem:researches/harness-patterns-loop-context-coding-run6` (30 patterns), `mem:researches/harness-patterns-memory-observability-run6` (27 patterns), catalog `mem:researches/youtube-ai-engineer-catalog`.
> - Ground truth: raw transcripts cached at `mem:cache/youtube-videos/ai-engineer/*` (see §6 Appendix).
> - Note on quotes: all evidence quotes are verbatim auto-captions (ASR) — filler words (uh/um), and artifacts like "cloud code" for Claude Code and "oncology" for ontology are preserved as-is (auto-caption artifacts, not transcription errors introduced here). Where a quote exceeded the 150-char budget it was trimmed with an ellipsis (noted in-line).

## 1. Executive summary

This document consolidates 124 harness-engineering patterns mined from 23 grounded, verbatim @aiDotEngineer (AI Engineer) conference transcripts (WF2024/2025/2026 keynotes and tracks, AIE Code 2025, AIE Europe 2025, plus standalone talks) across six parallel mining passes (Clusters A–F). Run 6 lifted the YouTube IP ban and added 12 transcripts — the 7 previously blocked talks plus the 5-video watch list — which yielded 78 further patterns (62 NEW cards + 16 REFINEMENTs merged into existing cards). Harness engineering is treated as the discipline of engineering the runtime environment and loop that runs an LLM agent: tool surface, permissions, context management, agent loop, memory/state, observability, and self-improvement loops. High-signal findings: minimal harnesses (a while-loop plus tool calling, terminal-native tool surfaces) outperform feature-heavy ones on leaderboards; the harness — not the model — owns the context and thereby controls behavior; the tool surface is the security surface (the "lethal trifecta" of private data + untrusted content + tools); memory machinery pays off only at the context-overflow boundary; evaluation functions best as an always-on loop-control service with go/no-go gates; human confirmation gates belong at irreversible action boundaries, not in per-call approval theater; most production agent failures are harness failures, not model failures; and every harness expands until it becomes a claw (Steinberger's Law). Classifications: 42 validated, 31 established, 51 emerging (124 total; tallied from the per-card classifications below).

## 2. Method & provenance

**Transcript caching & validation.** The channel catalog (`mem:researches/youtube-ai-engineer-catalog`, 1023 videos enumerated via yt-dlp flat-playlist) was used to select harness-relevant targets. Transcripts were fetched verbatim via the YouTube-transcript tooling and cached at `mem:cache/youtube-videos/ai-engineer/*`. Of 19 target transcripts, **12 were obtained** (10 pre-existing cached transcripts from run 1 + 2 talks cached in run 4: "Why Agent Engineering", "Building pi in a World of Slop"); **7 were blocked** by a YouTube hard IP ban (cloud-provider IP; "YouTube is blocking requests from your IP") and sat on a persistent retry list through runs 3–5. Two cache entries were duration-verified (~1K chars/min). All quotes below are verbatim auto-captions (whitespace cleaned, words verbatim).

**Run-6 expansion (2026-08-07).** The YouTube hard IP ban lifted (operator changed the egress IP), and all 12 remaining targets were fetched verbatim: the 7 blocked videos plus the 5-video watch list (`BurJvbqFr4c`, `rmvDxxNubIg`, `Lue8K2jqfKk`, `W2HVdB4Jbjs`, `blmAkayzE8M`, `-aM2EDTiaMs`, `xJXm4Wcw4m8`, `am_oeAoUhew`, `BInpv7lGp1o`, `8qWIPUia2O8`, `xIt_mTQp6mY`, `RFKCzGlAU6Q`). 12/12 fetched with zero failures (one needed two pages), all read-back verified and duration-proportional (~1K chars/min). The persistent retry list is cleared; `cache/youtube-videos/ai-engineer/*` now holds 24 entries. Three further mining passes (Cluster D: tools/security/ecosystem; Cluster E: loop/context/coding-harness internals; Cluster F: memory/observability/safety) ran the same in-sandbox windowed extraction and wrote the run-6 checkpoint memories. Run 6 yields 78 patterns: 62 NEW cards plus 16 REFINEMENTs merged into existing cards. One speaker-attribution discrepancy surfaced: the caption of `BInpv7lGp1o` ("Your Agent Didn't Fail. Your Harness Did.") self-identifies "Ben" (OpenClaw) while the catalog lists Vinoth Govindarajan (OpenAI); unresolved, so quotes from that talk cite the video title only (§5).

**Mining method.** Each of the six parallel mining subagents read transcripts *inside* the serena sandbox using keyword-filtered, scored window extraction (runs 1–4: 1800-char windows, 900-char step; run 6: 1600-char windows, 800-char step; keyword seed sets per cluster — e.g., mcp/tool/permission/oauth/sandbox/security/poison/credential/scope/gateway for Clusters A/D) with targeted offset digs into dense regions, never full dumps into context (~75K chars consumed of ~1.1M total in runs 1–4; ~26K of ~55K in run 6, Cluster D). Each checkpoint memory records patterns with verbatim evidence quotes, source attributions, classifications, and coverage gaps. The 22-pattern agentic-patterns catalog (`mem:researches/agentic-patterns-context-memory-patterns`, `mem:researches/agentic-patterns-memory-patterns`) was used as the taxonomy for cross-references.

**Classification definitions.**
- **validated** — demonstrated with metrics/data or production evidence (e.g., measured 39% performance bump; Anthropic production gateway; benchmark leaderboard results).
- **established** — widely repeated best practice across multiple sources/talks in the corpus (e.g., termination conditions, least-privilege, hybrid retrieval).
- **emerging** — promising/early, often single-source or explicitly contested (e.g., plan-not-execute provable safety, self-modifying harness, RL co-training).

## 3. Pattern catalog (grouped by harness subsystem)

Patterns are numbered with a cluster prefix (A/B/C/D/E/F) matching the checkpoint of origin, then a canonical number. All 124 patterns are present (62 original + 62 run-6 NEW); none were dropped. 16 run-6 REFINEMENT patterns were merged into the existing cards they strengthen (marked with a "Refined by (run 6)" line) rather than added as new cards. Where a checkpoint provided a cross-ref to the 22-pattern catalog, it is reproduced.

### a. Tools & Permission Layer

#### A-P1. Model Agency via Open Standard Protocol (established)
- **Problem:** model confined to context box cannot act; bespoke integrations do not scale.
- **Pattern:** standardize tool access as an open-source protocol so the model gains context + actions uniformly across clients/servers.
- **Evidence:** "the genesis of MCP was really around this big question of uh not just context but model agency. How do you actually give the model the ability…" — Source: Theodora Chu (Anthropic), WF2025 MCP track.
- **Cross-refs:** catalog Tool Search Lazy Loading (MCP) is downstream.

#### A-P2. Server-First Protocol Design (emerging)
- **Problem:** every tool protocol burdens client or server; misreading the population ratio misallocates that burden.
- **Pattern:** when servers will vastly outnumber clients, optimize spec for server simplicity + server-builder tooling; accept asymmetry/bidirectional messaging.
- **Evidence:** "there will be a lot more servers than there are clients... we optimized for server simplicity and for the server uh server builders to have better tooling" — Source: Theodora Chu (Anthropic), WF2025 MCP track.
- **Cross-refs:** none given (contested: "we could be totally wrong on this").

#### A-P3. Centralized Agent Gateway (routing + credentials + rate limiting) (validated)
- **Problem:** remote MCP needs external connectivity + auth; per-consumer OAuth repeats work, fragments control.
- **Pattern:** gateway between consumers and tool servers: URL-based routing for internal/external alike, automatic credential management, centralized rate limiting + observability.
- **Evidence:** "we used URL based routing to route to external servers, internal servers, it doesnt matter... we handle all the credential management automatically because you dont want to be implementing OOTH five times in your company" — Source: John (Anthropic), WF2025 MCP track (OOTH = OAuth, ASR).
- **Cross-refs:** pairs with A-P15 (distributed tracing); Anthropic production = validated.
- **Refined by (run 6):** "the OOTH authorization server is a totally separate entity... All you have to do is verify the tokens that come in over HTTP and hand off all the other responsibility to the OA server" — Source: Jared Hanson, "How to Secure Agents using OAuth" (run 6, `blmAkayzE8M`). Adds the OAuth role-separation rationale (MCP server = resource server only; authz server a separate entity) and the failed-attempt history (early MCP authz spec collapsed the roles; "MCP authorization spec is a mess for the enterprise", ~400-comment spec PR) (D-P13).

#### A-P4. Credential Portability via Gateway-Held OAuth (established)
- **Problem:** batch jobs / long-lived agents must not force re-auth per run.
- **Pattern:** run OAuth authorization-URL + completion flow at the gateway so credentials are portable across endpoints and job contexts.
- **Evidence:** "were handling OOTH at the gateway... We added a get ooth authorization URL function and a complete ooth flow"; "the credentials are portable. If you have a batch job…" — Source: John (Anthropic), WF2025 MCP track.
- **Cross-refs:** none given.

#### A-P5. Tool Lazy-Loading via Dynamic Capability Discovery (validated)
- **Problem:** publishing thousands of tools statically floods context; more tools = riskier results.
- **Pattern:** client dynamically discovers tools relevant to current workflow; only needed tools enter context.
- **Evidence:** "the client connects to the MCP server and dynamically discovers tools... lets say we have like 5,000 tools... the context would be just too large and like the more tools you have the you know riskier the result is" — Source: WF2025 MCP track (marketplace talk).
- **Cross-refs:** catalog Tool Search Lazy Loading (MCP) — same pattern, first-party evidence.

#### A-P14. Tool Proliferation / Schema Bloat Risk (emerging)
- **Problem:** enterprises use hundreds of tools; schemas/params/descriptions bloat context and cause wrong-tool selection between similar tools.
- **Pattern:** treat tool surface as a context-management + selection problem: catalog, gate, compress specs; engineer against bloat-induced misselection.
- **Evidence:** "enterprises especially they use hundreds tools... all these have specification in the code... it can cause agent to really bloat with that and pick wrong tools" — Source: WF2026 Software Factories.
- **Cross-refs:** A-P5 is the mitigation; catalog Context Budget.

#### B-P20. Hard Isolation vs Vibes-Based Prompt Scoping (emerging)
- **Problem:** enforcing agent boundaries by prompt (please-dont-leave-this-directory) is fragile; hard sandboxing is expensive (worktree creation, disk).
- **Pattern:** two implementation tiers: enforced isolation (filesystem/container) and prompt-level scoping. Teams trade cost vs trust; evals + RL close the prompt-tier gap.
- **Evidence:** "we had to make sure that the agents were scoped and isolated and they could not escape the work tree they were working on"; "now we're trusting the model. So it's you could say it's a bit vibes based" — Source: Cursor, AIE-EU.
- **Cross-refs:** Sandbox-cloud (fork/container) patterns; Context Budget.

#### D-P1. Design-Security Coupling: Bad Design = Bad Security (validated)
- **Problem:** security treated as an add-on OAuth layer bolted onto a finished tool interface.
- **Pattern:** design and security are one discipline; the three human-vs-agent interface dimensions (discovery, iteration, context) each cast a security shadow; fix design first, no OAuth compensates.
- **Evidence:** "A badly designed MCP server is also a badly secured one. Poor design and poor security compound each other" — Source: Tun Shwe, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** A-P6 (tool surface is the security surface).

#### D-P2. Tool-Description Poisoning Surface (established)
- **Problem:** agents read every tool description on connect; descriptions are invisible-to-human instruction vectors the model follows unconditionally.
- **Pattern:** every tool description is an injection surface; more tools = more surface area; mitigate via curation (fewer tools), complete unambiguous docs (D-P5), schema constraint (D-P4). OWASP MCP top-10 item #3.
- **Evidence:** "Every one of those tool descriptions is a surface for tool poisoning. Attackers can embed hidden instructions inside descriptions that are invisible in the UI, but the model will follow them without question" — Source: Tun Shwe, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** A-P14 (tool proliferation), A-P6; fills the run-1 cluster-A gap flag (tool-poisoning deep-dive).

#### D-P3. Outcome-Level Coarse-Grained Tools (Fewer Doors) (validated)
- **Problem:** fine-grained tools expose many callable operations; each is a door needing its own permission check, audit, authz enforcement.
- **Pattern:** consolidate related fine-grained operations into one coarse-grained outcome tool; yields one permission check, one audit log entry, one authz point. Inverse of micro-tool designs.
- **Evidence:** "squash all the fine-grained operations or underlying API calls into a single coarse-grained operation that produces a desired outcome. Every tool you expose is a door" — Source: Tun Shwe, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** B-P19, A-P14.

#### D-P4. Constrain Inputs at the Schema Level (validated)
- **Problem:** command-injection flaws trace to unconstrained string arguments passed to shells/query engines/APIs; models freely produce free-form payloads.
- **Pattern:** declare tool inputs with top-level primitives + enums; forbid free-form nested payloads; strict typing (Pydantic). Constrained inputs are easier to validate and harder to exploit.
- **Evidence:** "reject free-form nested payloads to avoid command injection flaws where the root cause is almost always unconstrained string arguments" — Source: Tun Shwe, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** D-P2, A-P14 (schema is also the selection-control point).

#### D-P5. Documentation as a Defensive Layer (emerging)
- **Problem:** weak tool descriptions leave a vacuum an attacker-controlled neighboring server description can fill (description shadowing).
- **Pattern:** write complete, unambiguous, high-signal docs for every tool; complete docs crowd out poisoned neighbor descriptions and disambiguate similar tools.
- **Evidence:** "If your documentation is complete and unambiguous for every tool, it crowds out the space that a poisoned neighboring server would try to fill" — Source: Tun Shwe, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** D-P2, A-P14.

#### D-P6. Return Only What the Agent Needs (Tool-Result Minimal Exposure) (established)
- **Problem:** oversharing tool responses puts PII/credentials/system details into the context window where one prompt injection exfiltrates them (OWASP MCP #10 context injection and oversharing).
- **Pattern:** strip tool-result payloads to the minimum the current task needs; treat the context window as a liability, not storage.
- **Evidence:** "Oversharing data in tool responses is number 10 in OWASP's MCP guide and it turns the agent's context window into a liability" — Source: Tun Shwe, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** A-P12 (hygiene = context side; D-P6 = security side), A-P6.

#### D-P8. The Security Cliff: stdio Walled Garden → Streamable HTTP (validated)
- **Problem:** local stdio MCP (single user, no network, no auth) is a walled garden; production needs streamable HTTP (remote, multi-client, scaling) with no gradual on-ramp — OAuth, token mgmt, CORS, TLS, rate limiting arrive all at once; stdio collapses under concurrency.
- **Pattern:** treat local-to-remote as a chasm to plan for; pick transport by deployment reality; scale-out forces streamable HTTP (you are either behind the wall or standing out in the open).
- **Evidence:** "You go from zero security surface to a huge list of concerns all at once… OAuth, token management, CORS configuration, TLS, rate limiting and more" (trimmed) — Source: Tun Shwe, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`). Also cited: "20 out of 22 requests failed with just 20 simultaneous connections" (stdio load test).
- **Cross-refs:** A-P3 (gateway = remote-deployment answer), A-P9.

#### D-P9. Long-Lived Shared Credentials Anti-Pattern (Confused Deputy) (established)
- **Problem:** MCP servers configured with API keys in config/env: long-lived, unscoped, rarely rotated, shared across systems, unverified by server, or passed straight through to upstream APIs.
- **Pattern:** recognize key-pass-through as a confused-deputy vulnerability (malicious client obtains authorization without user consent); a single shared credential serves many users, is harder to revoke per user, one leak compromises everyone. >50% of MCP servers still use this pattern.
- **Evidence:** "the key is simply passed through to the API, creating a confused deputy vulnerability, where malicious clients obtain authorization without the proper user consent" — Source: Jeremy Frenay, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** A-P4 (gateway-held OAuth as the fix), D-P10, D-P12.

#### D-P10. DCR Limits and CIMD (URL-Bound Client Identity) (established)
- **Problem:** static pre-registration breaks for MCP (unbounded clients × unbounded servers); dynamic client registration (DCR) is uncredentialed — registrations not portable across devices, phishing-prone, metadata self-asserted.
- **Pattern:** prefer CIMD (Client ID Metadata Document; preferred approach since Nov 2025): client owner exposes client ID metadata at a public URL; proving control of the URL is meaningful proof of identity; redirect URIs bound in metadata block malicious callbacks; authz server selectively allows/denies clients.
- **Evidence:** "Proving that you control <https://cloud.ai> is meaningful, unlike proving that you can post on the registration endpoint"; "DCR is vulnerable to phishing attacks because it doesn't provide a reliable way to verify client identities" — Source: Jeremy Frenay, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** D-P14 (URLs-in-PKI, same direction), D-P12.

#### D-P11. Token Exchange for Least-Privilege Chain of Custody (RFC 8693) (emerging)
- **Problem:** the MCP connection is only the first leg; what an MCP server does downstream (in-domain or cross-domain API calls) is unspecified security-wise.
- **Pattern:** MCP server acts as OAuth client to its own resource servers: exchange the user delegation token for a scoped session token (RFC 8693); cross-domain via identity assertion grant / identity chaining; least privilege per hop.
- **Evidence:** "our MCP server now is actually a OAuth client for a new resource server, our API, but it's using the exact same authorization server in order to get a token" — Source: Jeremy Frenay (run 6, `BurJvbqFr4c`); corroborated: "there's a technique called OOTH token exchange that I recommend everyone look into... identity assertion grant which lets us do cross domain authorization" — Source: Jared Hanson, "How to Secure Agents using OAuth" (run 6, `blmAkayzE8M`).
- **Cross-refs:** A-P4, D-P15, A-P15.

#### D-P12. Static Secrets to Dynamic Scoped Access (Short-Lived Tokens + Refresh) (established)
- **Problem:** pasting long-lived broadly-scoped API keys into configs/env for hundreds of agents is an unbounded security problem.
- **Pattern:** move from static secrets to OAuth dynamic access; short-lived access tokens rotated via refresh tokens keep the authorized connection alive without long-lived secrets; scope access per delegation.
- **Evidence:** "we know how to fix this. We know how to transition away from static secrets to dynamic access using OOTH"; "refresh tokens which basically allows these access tokens to be shortlived and rotated pretty quickly while still maintaining the authorized connection" — Source: Jared Hanson, "How to Secure Agents using OAuth" (run 6, `blmAkayzE8M`).
- **Cross-refs:** A-P4 (gateway-held OAuth), D-P9 (the anti-pattern replaced).

#### D-P14. Agent Identity via URLs in PKI + Attestation (emerging)
- **Problem:** DCR makes all agents anonymous (registration uncredentialed); traditional client ID/secret friction does not fit MCP; users need awareness of which LLM/device receives their data.
- **Pattern:** reuse existing identifiers: URLs in PKI as client identity (agent.com), agents sign JWT assertions / HTTP message signatures verified against public keys; add remote attestation (IETF) of device/software state to know what LLM data flows into, feeding OAuth authorization flows.
- **Evidence:** "we should start looking at using URLs in PKI for identity... authenticate these agents by having them sign JWT assertions or HTTP message signatures that we can then verify with the corresponding public keys" — Source: Jared Hanson, "How to Secure Agents using OAuth" (run 6, `blmAkayzE8M`).
- **Cross-refs:** D-P10 (CIMD, same direction different mechanism), D-P12.

#### D-P15. Transactional Authorization (RAR) for Agent Actions (emerging)
- **Problem:** OAuth scopes are too coarse (read vs write) and too long-lived for agents performing financial/commercial transactions.
- **Pattern:** authorize per transaction with specific parameters (amounts, budgets) via rich authorization requests (RAR); move to dynamic access as agent actions become transactional.
- **Evidence:** "scopes... a little bit too coarse grained... authorize things on a transaction basis potentially with specific amounts or financial budgets... rich authorization requests" — Source: Jared Hanson, "How to Secure Agents using OAuth" (run 6, `blmAkayzE8M`).
- **Cross-refs:** A-P8 (human confirmation gate — complement: consent at transaction time), B-P14.

#### D-P16. Enterprise Agent Governance: Tool-Level RBAC + Data Masking + Full-Request Trace (emerging)
- **Problem:** compliance (EU AI Act) expects transparency for autonomous systems; agents should never see data they have no business handling; unobservable agents cannot be governed.
- **Pattern:** beyond OAuth scopes: RBAC scoped to individual tool/resource, data masking of PII before the agent sees it, interaction audit logs (which agent called which tool with what params, what data returned), end-to-end request observability.
- **Evidence:** "agents should never be exposed to data that they have no business handling"; "If you cannot trace what an agent did end to end, you cannot govern it. Tracing for agent AI follows the same principles as distributed system observability" — Source: Jeremy Frenay, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`).
- **Cross-refs:** A-P15 (distributed tracing), C-P18, D-P7.

#### D-P21. Harness Ecosystem Shakeout (Winner-Take-Few) (emerging)
- **Problem:** claw/harness products multiply; users can only hold a limited number of high-frequency or high-value tools in mind.
- **Pattern:** expect category consolidation (mobile-platform analogy: 1–2 winners per category); a harness must be very economically valuable or very frequent or it gets dropped; build capabilities users need or they switch (rate of change 3–4×).
- **Evidence:** "there will be this very real shakeout and these categories will kind of emerge and we'll realize that we only have space in our lives for so many of these claws" — Source: Sam Bhagwat (Mastra), "Every Harness Will Become A Claw" (run 6, `8qWIPUia2O8`).
- **Cross-refs:** D-P17 (convergence driver), A-P11.

### b. Agent Loop Control

#### B-P1. While-Loop Core + Tool Calling Is the Whole Harness (validated)
- **Problem:** vendors ship feature-heavy agent frameworks; the essence of an agent runtime is lost in the UI.
- **Pattern:** keep the agent core to a while loop that calls tools until done; everything else (UI, providers, extensions) wraps that core. Best-evidenced in a production agent built deliberately small.
- **Evidence:** "an agent core, uh which is just a while loop and the tool calling"; "an agent is actually just an LLM agent that runs tools in a loop" — Sources: Mario Zechner (PI), PI; Alex, Tavon AI, AIE-EU.
- **Cross-refs:** Session-Scoped Context Runtime; Tool Search Lazy Loading.
- **Refined by (run 6):** "it's just one while loop with tool calls just running the master while loop calling the tools and going back to the master while loop. This is basically four lines" — Source: Jared Zoneraich, "How Claude Code Works" (run 6, `RFKCzGlAU6Q`). Adds explicit termination ("when no tool calls remain, ask the user") and the DAG-era contrast ("everybody was building DAGs like this for the last two and a half years... works way better because our models are just good now") (E-9).

#### B-P2. Don't Get One-Shotted — Iterate Instead (Ask-Explore-Then-Do) (established)
- **Problem:** one giant prompt + one-shot generation is a learned bad habit that scales badly as models get faster.
- **Pattern:** two-stage workflow: (1) an exploration pass — ask questions, explore the codebase with the agent, form understanding; (2) then let the agent execute.
- **Evidence:** "the first thing that you would do is you would ask a few questions... explore the codebase with your agent, figure out what has to be done in the task, and then set your agent off to go do that" — Source: Scott Wu/Devon, WF2025. Also: "we do things like write massive prompts and try to oneshot" — Sarah Chang/Cerebrus, AIE-EU.
- **Cross-refs:** Dynamic Context Injection; iterative refinement over single-shot.
- **Refined by (run 6):** "So have it use tools, have it pull things into context and then think. If it's thinking up front, you're probably just kind of wasting tokens" — Source: Boris Cherny, "Claude Code & evolution of agentic coding" (run 6, `Lue8K2jqfKk`). Context-first-then-think: tool use precedes reasoning (E-7, per the run-6 checkpoint).

#### B-P3. Explicit Termination Condition (Don't-Stop-Until) (established)
- **Problem:** background/async agents need a definition of done; otherwise they drift or over-run.
- **Pattern:** give the agent an explicit success contract: a testable condition it must reach, agreed before launch. Also define how the user will verify the result.
- **Evidence:** "the secret to working in parallel is a clear definition of success... Tell it, don't stop until you see this or don't stop until the number is X" — Source: Rustin Banks/Google Jules, WF2025.
- **Cross-refs:** Working Memory via TodoWrite; verified-completion loops.

#### B-P4. Loop-Failure Detection & Context-Pollution Recovery (established)
- **Problem:** agents fixate on one error and loop forever, re-polluting context with wrong state until the run is useless.
- **Pattern:** detect loops (same error retried with different techniques), roll back to a known-good checkpoint, continue from there instead of thrashing.
- **Evidence:** "it hits an error that gets into a loop and it's constantly trying to fix the same error it uses five different techniques then goes back and your context window's completely polluted with the wrong state"; "we want to go back to a known good checkpoint and then build from there" — Source: Morgante/Grit, WF2024.
- **Cross-refs:** Context Window Auto-Compaction; Filesystem-Based Agent State (checkpoints).

#### B-P5. Compile-Then-Fix Inner Loop as the Reliability Backbone (validated)
- **Problem:** model output must be verified mechanically; eyeballing is insufficient even for experts.
- **Pattern:** minimal reliable flow: prompt → generate → build/type-check → feed errors back → fix, iterated. Slow builds are the loop bottleneck, so in-memory incremental re-checking (LSP-style) matters.
- **Evidence:** "this basic flow of prompt get some code uh build it type check it and then fix that output based on the LLM... this is probably half of what you need to do to build a really good agent"; "10 minutes to build the application... this basically destroys our entire agentic flow" — Source: Morgante/Grit, WF2024.
- **Cross-refs:** Curated Code/File Context Window (compiler feedback as curated context).
- **Refined by (run 6):** "The second one is TDD... maybe the reason is it's not me doing it, it's the model doing it"; "the workflow here is tell Claude to write some tests and kind of describe it" — Source: Boris Cherny, "Claude Code & evolution of agentic coding" (run 6, `Lue8K2jqfKk`). TDD-as-agent-workflow: write tests first (clear descriptions), then implement to green — the model executes the discipline humans find hard (E-30).

#### B-P6. Sandbox-Powered Mass Retry & Parallelism (emerging)
- **Problem:** individual agent runs fail often; waiting serially wastes time.
- **Pattern:** if sandboxing is safe enough, run many attempts/agents in parallel from a known-good state and take the first success (best-of-n at scale).
- **Evidence:** "even just try multiple times, try a hundred times with a different agent, it actually ends up like working out quite well. And one of the things that enables this is having really good sandboxing"; "six up to 10 different agents working in parallel all working from a known good state" — Sources: Josh Albrecht/Imbue, WF2025; Morgante/Grit, WF2024.
- **Cross-refs:** Context Budget as a Governed Resource (cost ceilings on parallel runs).

#### B-P7. Inner Loop vs Outer Loop Separation (established)
- **Problem:** coding harnesses conflate development and review loops, hiding where humans must intervene.
- **Pattern:** treat the dev loop (agent edits/iterates) and review loop (CI/human verification) as separate harness surfaces with separate controls.
- **Evidence:** "software development currently and has always had two loops. The inner loop which is focused on development and the outer loop that's focused on review" — WF2025; "fourth step is fixing them and after fix proposing a fix not fixing them proposing a fix for human to review" — Gajan Patel/Balter ghost-pilot, WF2024.
- **Cross-refs:** Proactive Agent State Externalization (PR as state artifact).

#### E-10. Control-Loop Architecture: Sensor/Setpoint/Controller/Actuator (emerging)
- **Problem:** agent loops that just pipe prompt→loop produce 40K-line PRs nobody reads; loops need a design theory.
- **Pattern:** borrow control theory: sensor measures current state, set point defines desired state, measured error = difference, controller turns error into a control signal (an incremental change), actuator applies it; recompute. Applied to codebases: desired-state migrations, cleanups, root-out-bad-patterns loops.
- **Evidence:** "You have a sensor that measures the current state of the world. You have your set point... the difference between those two things is your measured error. You have a controller that reads that measured error and turns it into a control signal about an incremental change to apply to the system" — Source: Kyle Mistele (HumanLayer), "Loop Engineering from First Principles" (run 6, `xIt_mTQp6mY`).
- **Cross-refs:** B-P1; B-P3 termination; B-P5 compile-then-fix.

#### E-11. Incremental Control vs Blind One-Shot (Ralph-Loop Counter-Pattern) (emerging)
- **Problem:** non-incremental agent runs (all-at-once) risk blowing everything up and produce unreviewable output.
- **Pattern:** control loops change a system incrementally; the best Ralph-style loops apply control theory; pure bash-loop Ralph loops are blind — they are not incremental.
- **Evidence:** "Control loops change a system incrementally instead of just trying to get straight to the end state immediately all at once and risk blowing everything up"; "we're still building 40,000-line PRs that just nobody wants to read"; "all Ralph loops are blind loops... they're not incremental right it's just a bash loop" — Source: Kyle Mistele (HumanLayer), "Loop Engineering from First Principles" (run 6, `xIt_mTQp6mY`).
- **Cross-refs:** B-P2; B-P7 inner/outer loop.

#### E-12. Deterministic-First Loop Steps (emerging)
- **Problem:** agents applied to deterministic work (find-all-matches, sort, count) are slow, expensive, non-reproducible.
- **Pattern:** sense and verify deterministically (ast-grep/GitHub Actions/lint), reserve the agent for genuinely non-deterministic decisions (which change to apply, how to rewrite). Never send an agent to do deterministic code's job; blur lines only where sensing is genuinely open-ended.
- **Evidence:** "you should never send an agent to do deterministic code's job"; "we're going to use ast-grep because it's really powerful... It's language agnostic. It's out of band from your TypeScript config or ESLint rules" — Source: Kyle Mistele (HumanLayer), "Loop Engineering from First Principles" (run 6, `xIt_mTQp6mY`).
- **Cross-refs:** B-P5; B-P27 lint-as-harness.

#### E-13. PR-as-Loop-Artifact + Label-Based Loop Dedup (emerging)
- **Problem:** multiple scheduled loops stack PRs, duplicate work, conflict, and overwhelm review.
- **Pattern:** each loop run emits a PR tagged with the loop's label; before running, check whether a PR with that label is already open — if so, shut down. One open PR per loop at a time; no stacking, no duplication. Also watch loop friction: constant skill updates/manual checkouts kill loops.
- **Evidence:** "each loop and its workflow has a label that gets attached to PRs... check and see if... any PR with the loop's label on it is open. And if so, we just shut down... No stacking, no duplication"; "we had to constantly update the skill... And our loop was actually really high friction" — Source: Kyle Mistele (HumanLayer), "Loop Engineering from First Principles" (run 6, `xIt_mTQp6mY`).
- **Cross-refs:** B-P7 outer loop; B-P24 observability.

#### E-14. Human-on-the-Loop Resteering (/iterate Comment Trigger) (emerging)
- **Problem:** full automation removes human steering; paging humans per iteration is high friction.
- **Pattern:** keep the loop autonomous but resteerable: a /iterate comment on the loop's PR triggers the workflow, which loads PR context + feedback file into the agent's context and instructs fix + feedback update. Low-friction human-on-the-loop, not human-in-the-loop.
- **Evidence:** "put a human on the loop in a really low friction way to resteer it when it goes wrong... when a user leaves a slashiterate comment on the PR, uh the loop workflow is going to pick that up" — Source: Kyle Mistele (HumanLayer), "Loop Engineering from First Principles" (run 6, `xIt_mTQp6mY`).
- **Cross-refs:** B-P14 human gates; B-P7.

#### E-15. Harness-Failure Attribution: Most Production Agent Failures Are Harness Failures (validated)
- **Problem:** postmortems blame the model/prompt when the harness (state, ordering, lifecycle, authority, proof) failed.
- **Pattern:** treat agent reliability as harness reliability: context assembly, state transitions, tool gating, ordering and receipts are where production failures live. Before blaming the model, audit the harness boundaries.
- **Evidence:** "most of the agent failures are not model failures. Those are harness failures"; "The agent... did not need a better model. The model did not need a better prompt. The system needed a better harness with complete receipt" — Source: "Your Agent Didn't Fail. Your Harness Did." (run 6, `BInpv7lGp1o`; speaker attribution unresolved — see §5).
- **Cross-refs:** B-P16 harness-vs-model.

#### E-16. Ordered Commit Path: One Path per Mutable State Boundary (emerging)
- **Problem:** overlapping writers (load-modify-save races) each locally correct but jointly corrupt state.
- **Pattern:** the invariant is not no-concurrency; it is a narrow rule: one ordered commit path for one mutable state boundary (queue, mutex, or lock), committed conservatively at commit time, not across the whole system.
- **Evidence:** "Both operations are locally correct... The rule is narrower and simple. One ordered commit path for one mutable state boundary. This mechanism may be a Q, a mutx, a [lock]" — Source: "Your Agent Didn't Fail. Your Harness Did." (run 6, `BInpv7lGp1o`).
- **Cross-refs:** B-P4 recovery; Filesystem-Based Agent State.

#### E-17. Harness Failure Shape Catalog + Silence Is Not a Terminal State (validated)
- **Problem:** production agent failures have recognizable shapes that are hard to spot because replies still sound coherent.
- **Pattern:** catalog of five shapes: state hole (user saw success, durable record missing), overlapping writers, dangling tool call (run waits on an event that will never arrive), approval drift, missing edge proof. Design against each: time modes + error results on tools, recovery commands that do not wait behind stuck work.
- **Evidence:** "a state hole, overlapping writers, dangling tool call, approval drift, and missing edge proof"; "The run waits for an event that cannot arrive. Silence is not a terminal state"; "Tools needs time modes and error results. Channels needs recovery commands that do not wait behind the stuck work" — Source: "Your Agent Didn't Fail. Your Harness Did." (run 6, `BInpv7lGp1o`).
- **Cross-refs:** B-P4; B-P24 observability.

#### E-24. Skills: The Invocation Gap Is the Open Problem (emerging)
- **Problem:** agents ignore available skills; users end up invoking them manually.
- **Pattern:** naming/discovery of skills is unsolved: a one-liner per skill helps, but getting the model to call the right skill is itself a tool-call-routing problem (knowing WHEN to call it); treat as functionality, possibly a post-training problem.
- **Evidence:** "Claude ignored all of my skills and so I put them in some... Skills feel globally misunderstood"; "I generally have to call the skill myself manually"; "getting the model to call the skills is almost like calling a tool call. You have to know when to call it" — Source: Jared Zoneraich (PromptLayer), "How Claude Code Works" (run 6, `RFKCzGlAU6Q`).
- **Cross-refs:** B-P25 self-modifying harness; skills-as-context.

#### E-25. Idiomatic-Examples Skill Context + Response Template (Actuator Skill) (emerging)
- **Problem:** agents without exemplars replicate docs/from-internet patterns instead of house style.
- **Pattern:** invest heavily in the actuator skill: idiomatic handwritten examples (agents are pattern replicators) + a response template, piped with the control signal; keep updating it as the loop matures.
- **Evidence:** "you should spend a lot of time on the skill... idiomatic handwritten examples for the agent to follow because they're just pattern replicators... the skill of course should include a response template" — Source: Kyle Mistele (HumanLayer), "Loop Engineering from First Principles" (run 6, `xIt_mTQp6mY`).
- **Cross-refs:** B-P13; B-P25.

#### E-26. Agent-Smell Metrics: Tool-Call/Retry/Time Sanity Signals (emerging)
- **Problem:** E2E evals are heavy; harness regressions hide between them.
- **Pattern:** cheap surface metrics — how many tool calls, how many retries, how long the run took (agent smell) — for sanity-checking harness changes; start with backtests when building evals.
- **Evidence:** "run an agent and see how many times does it call a tool call. How many times does it retry? How long does it take? And these are all surface level metrics but it's really good for sanity checking" — Source: Jared Zoneraich (PromptLayer), "How Claude Code Works" (run 6, `RFKCzGlAU6Q`).
- **Cross-refs:** B-P24 observability; eval patterns.

#### E-27. Approval as a Structured Object (Anti-Approval-Drift) (emerging)
- **Problem:** approvals that lose their shape across retries/replays/callbacks can no longer be proven; requestability is not authority.
- **Pattern:** make approval an object: who approved, in what session and run, for which tool and arguments, for how long, with what outcome, pointing to the receipt. Bind authority to one pending action; least-privilege narrows the tool surface.
- **Evidence:** "A useful approval object answers who approved in what session and run for which tool and for which arguments and for how long and with what outcome" (trimmed); "Capability is not execution... Requestability is not authority. Approval needs a shape" — Source: "Your Agent Didn't Fail. Your Harness Did." (run 6, `BInpv7lGp1o`).
- **Cross-refs:** B-P18/B-P19 permissions; E-17.

#### F-2. Humans Steer, Agents Execute — Interaction as Harness Failure (validated)
- **Problem:** humans remain synchronous drivers clicking "continue"; no signal of when the harness is actually working.
- **Pattern:** define the work + guardrails up front so agents run to completion; every human interaction with the agent indicates the harness failed to provide enough context.
- **Evidence:** "Every time I have to type continue to the agent is like a failure of the harness to provide enough context." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** E-15 (harness-failure attribution); C-P9 (prompted-model-first).

### c. Context Engineering

#### B-P8. The Harness Owns the Context (Control Surface, Not Just Transport) (validated)
- **Problem:** when a closed harness silently mutates system prompt/tool definitions, the user loses control of agent behavior.
- **Pattern:** context is the control surface: what the harness injects/removes (system prompt, tool defs, reminders, pruning) IS behavior control. Openness and control over those mutations is a core harness feature.
- **Evidence:** "The real problem is that my context wasn't my context. Cloud code is the thing that controls my context... you have the system prompt which changes on every release, including the tool definitions" — Source: Mario Zechner (PI), PI ("cloud code" = Claude Code, ASR).
- **Cross-refs:** Context Budget as a Governed Resource; Prompt Caching via Exact Prefix Preservation (stable system prompt).

#### B-P9. System-Prompt Minimalism — Models Are Post-Trained on Harnesses (validated)
- **Problem:** long system prompts waste tokens and fight what the model already learned during RL post-training.
- **Pattern:** write minimal system prompts; the model already knows coding-agent behavior from training. The whole pi system prompt fits on a slide as a joke.
- **Evidence:** "models are actually reinforcement trained up the wazoo... they know what a coding agent is because a coding agent harness is basically what they're being trained when they are post-trained. You don't need 10,000 tokens to tell them you're a coding agent"; "Here's Pie's system prompt. [laughter] That's it." — Source: Mario Zechner (PI), PI, AIE-EU.
- **Cross-refs:** Prompt Caching via Exact Prefix Preservation; Context-Minimization Pattern.

#### B-P10. Tool-Result Pruning Can Lobotomize — Prune with Care (emerging)
- **Problem:** aggressive auto-truncation of tool outputs past a token floor removes signal the model needs.
- **Pattern:** truncation/pruning is a context-budget lever but must be deliberate and inspectable; naive minimum-token pruning breaks workflows.
- **Evidence:** "given some conditions, open code would just uh prune tool outputs after a specific minimum amount of tokens and that basically lobotomizes the model" — Source: Mario Zechner (PI), PI.
- **Cross-refs:** Context Window Auto-Compaction; Context Budget as Governed Resource (counter-pattern to auto-compaction).

#### B-P11. Progressive Discovery — Tools Loaded On Demand (validated)
- **Problem:** hundreds of MCP tools in context burn tokens and confuse routing.
- **Pattern:** give the model a tool-loading tool; it discovers and loads needed tool definitions on demand, massively cutting standing tool context (Claude Code before/after).
- **Evidence:** "you give the model a tool loading tool basically and the model goes like ah maybe I need a tool now... you see a massive reduction in tool use tool context usage" — Source: MCP/Anthropic speaker, AIE-EU.
- **Cross-refs:** Tool Search Lazy Loading (MCP); Curated Code/File Context Window.
- **Refined by (run 6):** "we prefer is on demand compressed context. So if I'm building a feature that relates to SCM providers and Jira and Linear, um, I would just give it a good research uh prompt or or slash command or skill" — Source: Dex Horthy, "No Vibes Allowed" (run 6, `rmvDxxNubIg`). On-demand compressed context: sub-agents compress just the needed area and pull it in when relevant, instead of pre-documenting a 5M-line monorepo (E-6).

#### B-P12. More Context Is Better (Jules) vs Long Context Is a Hack (pi) (established)
- **Problem:** competing theses on context volume — both appear in this cluster.
- **Pattern:** async coding agents tolerate throw-everything-in (models sort relevance); power-user harness builders argue 1M-token windows are a hack that does not fix retrieval/compaction design. Resolve by role: exploration-time abundance, execution-time budget.
- **Evidence:** "just throw everything in there. Jules and other agents are pretty good at actually sorting out which context is important. So more context is better at this point" — Rustin Banks/Google Jules, WF2025; "long context windows are a hack, as most of you will find out this year as everybody's switching to 1 million tokens context windows" — Mario Zechner (PI), PI.
- **Cross-refs:** Context Budget as a Governed Resource; Semantic Context Filtering (open tension).

#### B-P13. Intent Is Context: Specs-as-Code and Prompt Preservation (emerging)
- **Problem:** vibe-coding deletes the prompt (intent) and version-controls only the code (the binary) — losing the agent's operating context.
- **Pattern:** capture intent/values in written specs; specs encode success criteria and double as eval material. Instruction files (AGENTS.md/CLAUDE.md style) are the harness persistent context layer.
- **Evidence:** "we keep the generated code and we delete the prompt. And this feels like a little bit like you shred the source and then you very carefully version control the binary" — WF2025 spec talk; "one agent per customer and that agent has a general harness... AGENTS.md" — Alex/Tavon, AIE-EU.
- **Cross-refs:** Layered Configuration Context (CLAUDE.md); Episodic Memory Retrieval & Injection.
- **Refined by (run 6):** "here's the CLI tool cla run-help. Take what you learn and then put it in the cloud MD. And now Cloud knows how to use the tool. That's all it takes. You don't have to build a bridge. You don't have to build an extension" — Source: Boris Cherny, "Claude Code & evolution of agentic coding" (run 6, `Lue8K2jqfKk`). CLI run-help → CLAUDE.md is the tool-onboarding path: point the agent at run-help, let it learn, persist what it learned (E-29; "cloud MD"/"Cloud" = CLAUDE.md/Claude, ASR).

#### B-P14. Human Judgment Gates on Context-Sensitive Changes (established)
- **Problem:** some changes (migrations, permissioning) depend on production knowledge the agent lacks; auto-applying them is dangerous.
- **Pattern:** define a class of changes where the human must reactivate: propose, don't apply. Harness encodes these as explicit gates.
- **Evidence:** "the kind of changes where the human's brain should reactivate... we don't think that the database migration should ever go in without the human making a judgment call... if there are permissioning changes, you better think about this" — Source: Arendelle, AIE-EU.
- **Cross-refs:** Working Memory via TodoWrite (blockedBy states); human-in-the-loop gates.

#### C-P12. Context-Window Compaction as Runtime Memory Management (validated)
- **Problem:** long agent runs fill the context window; memory must be actively managed at runtime.
- **Pattern:** compress memory when the window fills (Claude Code pattern); compaction cadence is a design lever and differs by harness (e.g., ~hourly vs ~20/hour), driven by window size.
- **Evidence:** "how do I manage a memory so we have cloud code compresses its memory when fills up its context window" — WF2025 Reasoning+RL ("cloud code" = Claude Code, ASR); "codex did a lot of compaction because it only had like 250k context window and cloud only do it like one per hour and codex was like 20 every one hour" — WF2026 Autoresearch.
- **Cross-refs:** Context Window Auto-Compaction (#5), Context Budget as Governed Resource (#2).

#### E-1. Smart-Zone Context Budget (Avoid the Dumb Zone) (validated)
- **Problem:** agents degrade as the context window fills; volume alone is not a strategy.
- **Pattern:** budget the window explicitly: a ~168K-token window has a usable smart zone (roughly 90%) plus reserves for output and compaction; staying in the smart zone via compaction/sub-agents is a first-class loop activity.
- **Evidence:** "You have 168,000 tokens roughly. Some are reserved for output and compaction... cleverly avoiding the dumb zone"; "just the more you use the context window, the worse outcomes you'll get" — Source: Dex Horthy, "No Vibes Allowed" (run 6, `rmvDxxNubIg`). Also: "when your context is full, the model gets stupid for lack of better words" — Jared Zoneraich, "How Claude Code Works" (run 6, `RFKCzGlAU6Q`).
- **Cross-refs:** B-P8 context ownership; B-P10 pruning.

#### E-2. Intentional Compaction: Compress → Review → Tag → Fresh Start (validated)
- **Problem:** auto-compaction erases control; continuing a polluted conversation compounds errors.
- **Pattern:** on derailment or checkpoint, ask the agent to compress the context window into a markdown file; the human reviews and tags it; a NEW agent starts from that artifact and gets straight to work. Compaction is an explicit, human-reviewed artifact, not a silent truncation.
- **Evidence:** "take uh your existing context window and ask the agent to compress it down into a markdown file. You can review this, you can tag it, and then when the new agent starts, it gets straight to work" — Source: Dex Horthy, "No Vibes Allowed" (run 6, `rmvDxxNubIg`).
- **Cross-refs:** B-P4 loop-failure recovery; E-8.

#### E-3. Stateless-LLM Thesis: Better Tokens In → Better Tokens Out (validated)
- **Problem:** the LLM is stateless and non-pure; each loop turn re-reads the whole conversation, so garbage accumulates.
- **Pattern:** treat every loop turn as a re-prompt over an engineered context. The harness's entire job is to assemble better tokens each iteration — correctness, completeness, size, plus a little trajectory. Fills the stateless-loop gap flagged by cluster B.
- **Evidence:** "they're not pure functions... stateless. And the only way to get better performance out of an LLM is to put better tokens in and then you get better tokens out" — Source: Dex Horthy, "No Vibes Allowed" (run 6, `rmvDxxNubIg`).
- **Cross-refs:** B-P8 context ownership; E-4.

#### E-4. Context Content Curation: Files/Code-Flow Yes, UUID Dumps No (emerging)
- **Problem:** raw tool output (JSON/UUID dumps, every MCP payload) bloats the window and drowns signal.
- **Pattern:** curate what enters context: exact files and line numbers relevant to the problem, code flow understanding, build/test output — not identifier dumps. The harness decides what belongs, not the model.
- **Evidence:** "what takes up space in your context window. So... it's looking for files, it's understanding code flow"; "UU ids into your context window, you know, God help you" — Source: Dex Horthy, "No Vibes Allowed" (run 6, `rmvDxxNubIg`).
- **Cross-refs:** B-P10 pruning; B-P11 progressive discovery.

#### E-5. Research-Plan-Implement: Workflow Phases as Context Phases (validated)
- **Problem:** one-shot prompting ignores that different stages of a task need different context shapes.
- **Pattern:** three phases, each ending in compaction: research (compression of truth — explore, understand codebase), plan (compression of intent — exact steps + code snippets, human must read it), implement (reliable execution). Open-source prompts per phase; the whole workflow is built around keeping context small.
- **Evidence:** "research, plan, implement... you're constantly keeping your context window small. You're building your entire workflow around context management"; "research is compressing truth... planning is about compression of intent"; "there is no perfect prompt. You still will not work if you do not read the plan" — Source: Dex Horthy, "No Vibes Allowed" (run 6, `rmvDxxNubIg`).
- **Cross-refs:** B-P2 ask-explore-do; B-P13 specs-as-code.

#### E-8. New-Thread-Over-Compaction at Capacity (emerging)
- **Problem:** auto-compaction is slow (minutes of waiting) and mid-drop summarization loses fidelity.
- **Pattern:** at capacity, prefer starting a fresh thread/context over waiting for compaction; when compaction runs, it drops the middle and summarizes (a lossy middle-out strategy). Operator choice, not silent default.
- **Evidence:** "when it reaches capacity it kind of drops the middle summarizes the [context]"; "compact. It's the worst. You have to wait 10 [minutes]... start a new thread. That feels like the winning strategy to me" — Source: Jared Zoneraich (PromptLayer), "How Claude Code Works" (run 6, `RFKCzGlAU6Q`).
- **Cross-refs:** B-P4; E-2.

#### F-1. Harness as Instruction-Surfacing Layer (validated)
- **Problem:** "harness engineering" is undefined; teams over-build environments and confuse the harness with tooling.
- **Pattern:** definitional frame — models are trained to follow instructions, so the harness' only job is to surface the right text (instructions, guardrails, context) to the model at the right time; harness = the runtime/loop that steers execution, not the model.
- **Evidence:** "All the harness should do is surface instructions to the model at the right time." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** C-P7 (RL-as-harness-loop); B-P8.

#### F-3. Scarce-Resource Harness Design: Time, Attention, Context (established)
- **Problem:** harness priorities unclear; teams optimize the wrong resource (e.g., raw tooling).
- **Pattern:** the scarce resources are human time, human+model attention, and the model context window; operationalize the codebase so tokens needed for a job are predictable, moving synchronous human time to higher leverage.
- **Evidence:** "The scarce resources in this world that we see today are three things: human time, human and model attention, and model context window." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** Context Budget as Governed Resource (catalog #2); C-P12 (compaction cadence).

### d. Coding-Harness & Tool-Surface Design

#### A-P11. Harness as the Abstraction Layer (established)
- **Problem:** model churn makes rebuilding prompt/tool stacks per model unsustainable.
- **Pattern:** encapsulate harness (prompts + tools + agent loop) as reusable surface; open-source reference harness so partners align; not a mere wrapper.
- **Evidence:** "in the most reductive way, you can sort of think of it as a collection of prompts and tools combined in a core agent loop which provides input and outputs uh from a model"; "harness becoming the new abstraction layer... you no longer have to care about optimizing the prompt and tools with every model upgrade" — Source: Bill Chen & Brian Fioa (OpenAI), AIE Code 2025.
- **Cross-refs:** none given (adopted by GitHub/Zed/Cursor).

#### B-P15. Terminal/Shell-Only Tool Surface Beats File Tools (TerminalBench) (validated)
- **Problem:** rich file/sub-agent tooling is assumed necessary for good coding-agent performance.
- **Pattern:** the top benchmark harness gives the model only a keystroke/screen tool against a tmux session — no file tools, no sub-agents — and still tops leaderboards across model families. Minimal harness surfaces the model's native capabilities.
- **Evidence:** "all it gives the model is a tool to send keystrokes to a tmux session and read the output of that tmux session. There's no file tools, no sub-agents, none of that stuff. And it's one of the best performing harnesses in the leaderboard" — Source: Mario Zechner (PI), PI.
- **Cross-refs:** Tool Lazy-Loading; Curated Context — inverse: terminal-native tools over tool proliferation.
- **Refined by (run 6):** "It's to start with a terminal and to give you as low-level access to the model as possible in a way that you can still be productive... we want to be unopinionated... we just don't know what the right UX is"; "claude code creates a Python file and then runs the Python file then deletes the Python file. That's the beauty" — Sources: Boris Cherny, "Claude Code & evolution of agentic coding" (run 6, `Lue8K2jqfKk`); Jared Zoneraich, "How Claude Code Works" (run 6, `RFKCzGlAU6Q`). Product-layer rationale (terminal = deliberately unopinionated lowest-level surface) + bash-core mechanics (create/run/delete a Python file is the canonical move) (E-18).

#### B-P16. Harness vs Model: Judge by Cross-Model Leaderboard Deltas (emerging)
- **Problem:** determining whether gains come from the model or the harness.
- **Pattern:** judge harness quality by leaderboard deltas across model families (same harness, many models). A terminal-native harness scoring above each model's native harness isolates harness contribution.
- **Evidence:** "irrespective of model family, Terminus scores higher, mostly high even higher than the native harness of that model. So, what does that tell us?" — Source: Mario Zechner (PI), PI.
- **Cross-refs:** Eval-driven harness iteration.

#### B-P17. LSP Feedback Into Tool Results Is a Counter-Pattern (emerging)
- **Problem:** injecting compiler errors into every edit result mirrors an unnatural human workflow (check-after-every-line) and confuses the model.
- **Pattern:** feedback loops should match how people actually work: finish a unit of work, then surface errors. Batch/async error feedback beats per-edit injection.
- **Evidence:** "every time your model is calling the edit tool, open code goes to the LSP server... asks are there any errors? And if so, injects that as part of the edit tool result. Which is bad, because think about how you are editing code. You're not writing a line of code, checking the errors" — Source: Mario Zechner (PI), PI.
- **Cross-refs:** Compile-Then-Fix Inner Loop (B-P5) — tension between the two.

#### B-P18. Rope-Not-Rails Permissioning (YOLO Security) (emerging)
- **Problem:** per-call approval dialogs (bash prompts) are theater, not security, and throttle flow.
- **Pattern:** default-permissive harness with a pluggable security layer the user builds to fit their needs (so-much-rope), rather than fixed guardrails baked into the vendor harness.
- **Evidence:** "pi is also yolo by default, because my security needs are different than yours. And I don't think a little dialogue that pops up every time you call bash, asking you to approve, is a smart security mechanism. So, instead, I give you so much rope" — Source: Mario Zechner (PI), PI.
- **Cross-refs:** Permission systems as harness config; tool-scoped permissions (B-P19).

#### B-P19. Least-Privilege Scoping by Default (validated)
- **Problem:** agents with repo-wide/world access cause review bypass and security incidents.
- **Pattern:** default-scope agents: read-only repo, no external network, single-repo permissions; escalate explicitly. Attribution must never bypass human review.
- **Evidence:** "that's the only place that coding agent is going to have right permissions to" plus "readonly access to your repository the default firewall preventing any external access review before merge" — GitHub Copilot coding agent, WF2025; agent-owned PRs let the triggerer self-approve and "basically bypass our whole code review system" — Open Hands, WF2025.
- **Cross-refs:** Filesystem-Based Agent State; human-in-the-loop gates.
- **Refined by (run 6):** "Scope permissions at the tool and resource level, not the session level. Use the MCP read-only annotation for non-destructive tools so that clients can enforce boundaries" — Source: Tun Shwe, "Your Insecure MCP Server Won't Survive Production" (run 6, `BurJvbqFr4c`). Adds tool/resource-level mechanics + MCP read-only annotation; convert read-only tools to MCP resources; delete unused tools (each removed tool = eliminated vector) (D-P7).

#### B-P21. Sub-Agent Decomposition with Parent Orchestration + Commentary (emerging)
- **Problem:** parallel model comparison/execution needs structure; naively spawning agents loses coordination and results assembly.
- **Pattern:** parent agent spawns sub-agents (each with own worktree/context), waits for all, synthesizes comparison commentary. The parent accumulates context the user can interrogate and stitch results from.
- **Evidence:** "instructing the parent agent to go and create sub agents for each model and then spin up a work tree for each... wait for all the subagents. And when they're done, please provide some commentary"; "The parent now has a lot more context over what each of the sub agents did" — Source: Cursor, AIE-EU.
- **Cross-refs:** Working Memory via TodoWrite; task-delegation patterns.
- **Refined by (run 6):** "using sub agents for specific tasks... own context and it feeds back only the results and this is how you don't clutter it... the forks of the agent and how we aggregate it back into our main context"; "it can fork out a new context window that is going to go do all that reading and searching" — Sources: Jared Zoneraich, "How Claude Code Works" (run 6, `RFKCzGlAU6Q`); Dex Horthy, "No Vibes Allowed" (run 6, `rmvDxxNubIg`). Adds explicit context-isolation rationale + role roster (researcher, docs reader, test runner, code reviewer); task structure lives in the main agent; sub-agent prompts generated on the fly (E-23).

#### B-P22. Edit-Format Economics: Whole-File Output Costs 3-15x (established)
- **Problem:** models output ~4K tokens while contexts reach 1-2M; regenerating whole files per edit is the naive default and is expensive (3-15x) and token-wasteful (JSON escaping in function-call diffs).
- **Pattern:** invest in a compact edit format (search-replace/structured diff) over full-file or JSON-escaped function calls to keep the loop cheap.
- **Evidence:** "models out there that have 1.5 million tokens 2 million tokens in their context window and still only outputting 4,000 tokens at a time... you really don't want to output entire large files as you're making edits"; "function calls are... Json escaping code in Json format is terrible you end up using a lot of tokens just for escape characters" — Source: Morgante/Grit, WF2024.
- **Cross-refs:** Context Budget as Governed Resource; tool-result handling.
- **Refined by (run 6):** "edit is it's using diffs and it's not rewriting files most of the time. way faster, way way less context used, but also way less uh issues"; "Unified diffing... makes the token limit shorter. It makes it faster and makes it less prone to mistakes" — Source: Jared Zoneraich, "How Claude Code Works" (run 6, `RFKCzGlAU6Q`). Mechanism: unified-diff edit is the standard across coding agents — diffs, not rewrites (E-19).

#### B-P23. Manual-First Disclosure: Explicit Context Invocation Before Magic (established)
- **Problem:** auto-injected context (magic) erodes trust and surprises users.
- **Pattern:** ship manual/explicit mode first — user at-mentions the context they want — then automate; agent edits must be fixable in the editor UI the dev already lives in.
- **Evidence:** "first you got to make something work in manual and explicit mode... make it so people manually at mention the context they want before magically inserting the context... if you've got an agent put it in the editor and make it work in the editor so that if it's wrong the dev can just change it right in their editor" — Source: Quinn/Sourcegraph, WF2024.
- **Cross-refs:** Progressive Disclosure for Large Files; Curated Code/File Context Window.

#### B-P24. Observability as a Harness Feature (validated)
- **Problem:** users need to see what agents are doing; opaque harnesses block trust and debugging.
- **Pattern:** expose agent state as inspectable surfaces (terminal mirror, snapshot-as-git-log, per-session JSON, dashboards, daemon+control-plane lifecycle monitoring). Zero-observability tools are a stated reason to switch harnesses.
- **Evidence:** "there's zero observability because that's how the tool is constructed and I like knowing what my agents are doing" — Mario Zechner (PI), PI; "every snapshot of the state is like a git log" — DockerCon talk, WF2025; daemons "monitor lifecycle of the agent when things change it's blocked it needs your help it communicates up to the control plane" — Richmond/Bit.ly, AIE-EU.
- **Cross-refs:** Proactive Agent State Externalization.

#### B-P25. Self-Modifying Harness: The Agent Writes Its Own Tools (emerging)
- **Problem:** fixed tool sets can't adapt to user workflow; extensibility via hooks is shallow and spawns processes per trigger.
- **Pattern:** ship docs + code examples of extensions as harness context, let the agent write new extensions (TypeScript modules) that hot-reload — the harness modifies itself per workflow. Custom compaction, providers, and full tool control as extension points.
- **Evidence:** "all we need to do for the agent to modify itself is tell it, here's the documentation. Here's some code that shows you how to modify yourself by writing extensions"; "second thesis is... self-modifying malleable agents"; "You can do custom compaction, custom providers, and you have full control over the tools" — Source: Mario Zechner (PI), PI.
- **Cross-refs:** Skills-as-file-based-context; Tool Lazy-Loading.

#### B-P26. Everything Plus Agent Works (Composition Thesis) (established)
- **Problem:** teams debate whether agents replace RAG/search/other systems.
- **Pattern:** agents compose with existing paradigms (RAG, search, etc.) rather than replace them; harness engineering is the discipline that makes composition reliable.
- **Evidence:** "everything plus agent works... agent plus rag works, agent plus search works... this is kind of like the simple formula for like making money in 2025" — Source: swyx, WHY-AE.
- **Cross-refs:** Semantic Context Filtering; Dynamic Context Injection.

#### B-P27. Linting and Code Conventions as Harness Constraints (emerging)
- **Problem:** agents add fuzz (state pollution, broad catches, scattered queries) between loop steps; reviewing all of it is unsustainable.
- **Pattern:** encode guardrails as lint rules and single-interface conventions (one query interface, no bare catches) so the harness mechanically constrains agent output; also improves token efficiency by making retrieval single-shot.
- **Evidence:** "between these points, between these steps. That's where the agent tends to add the most fuzz"; "most of these we actually achieve with linting rules. So the main example would be no bare catch holes"; "if it only gets one output, it's going to be much better at continuing with the loop" — Source: Arendelle, AIE-EU.
- **Cross-refs:** Compile-Then-Fix Inner Loop; Curated Context.

#### E-20. Read-Before-Edit Enforcement via a Dedicated Grep Tool (emerging)
- **Problem:** models edit files they have not read; raw bash grep tempts path/quoting bugs.
- **Pattern:** expose a special grep tool and force reading-before-editing through it (not bash): security, sandboxing, and token-limit reasons; also makes the model run independent operations in parallel.
- **Evidence:** "reading before editing uh they actually make you do that using the GP tool instead of the bash... I think security is a big one uh and sandboxing but then also just that token limit thing" — Source: Jared Zoneraich (PromptLayer), "How Claude Code Works" (run 6, `RFKCzGlAU6Q`).
- **Cross-refs:** B-P5 compile-then-fix; B-P17 LSP counter-pattern.

#### E-21. Prefix-Gated Bash Sandboxing Pipeline (emerging)
- **Problem:** shell access + web fetch is a big attack vector; blanket approval dialogs are theater.
- **Pattern:** route every bash command through a gating pipeline where the command prefix determines the sandboxing environment (and the permission set); most of the complex harness code lives in the sandbox/permission layer.
- **Evidence:** "there's this whole pipeline to gate bash command. So it depending on the prefix is how it goes through the sandboxing environment"; "connecting this agent that has shell access and you're doing web fetch that's a pretty big attack vector" — Source: Jared Zoneraich (PromptLayer), "How Claude Code Works" (run 6, `RFKCzGlAU6Q`).
- **Cross-refs:** B-P18/B-P19 permissions; B-P27.

#### E-22. Todo-List Injection: Loop Steering + Resume-After-Crash State (validated)
- **Problem:** long autonomous runs drift off-task and give no signal; crashes lose the plan.
- **Pattern:** inject a todo list into the system prompt (not enforced in code): forces planning, enables resume after crashes, gives UX signal so the run is not silently looping for 40 minutes, adds steerability.
- **Evidence:** "injecting the todos into the system prompt... it's not enforced in actual code... forcing it to plan. Uh we get to resume after crashes... it's not just running off in a loop for 40 minutes without any signal" — Source: Jared Zoneraich (PromptLayer), "How Claude Code Works" (run 6, `RFKCzGlAU6Q`).
- **Cross-refs:** B-P3 termination; B-P24 observability.

#### E-28. Receipt-vs-Transcript Proof: Model Proposes, Harness Commits, Receipt Proves (validated)
- **Problem:** a transcript records what the agent said, not what the harness actually committed; coherence over a broken history hides holes.
- **Pattern:** model output is a proposal; the harness owns state transition, authority check, ordered commit; the receipt (audit trail) is the evidence that survives — the model is not the production boundary. Proof is a chain (propose → allow/deny → execute → user-visible confirm), not a claim.
- **Evidence:** "A model proposes the harness commits and the receipts proves it... transcript is not the proof. A transcript tells you what the agent said. A receipt tells you [what happened]"; "Proof is a chain, not a claim" — Source: "Your Agent Didn't Fail. Your Harness Did." (run 6, `BInpv7lGp1o`).
- **Cross-refs:** B-P8; B-P24 observability.

#### F-24. Skills as Mini-Harnesses (validated)
- **Problem:** hardcoding agent environments (shells, daemons) couples the harness to one tool and resists guardrail insertion.
- **Pattern:** package environment knowledge as skills the agent invokes (launch the app, spin up the local observability stack, attach Chrome devtools); skills = slot-in points for guardrails (e.g., custom ESLint wired into every package).
- **Evidence:** "we have a skill that teaches Codex how to launch the app... spin up that local observability stack to give it logging and telemetry." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** B-P25 self-modifying harness; F-19.

### e. Memory, State & Retrieval

#### C-P1. Graph as Memory Substrate — explicit relationships over embeddings (validated)
- **Problem:** vector memory stores facts but no explicit relationships, so related-but-dissimilar facts are unrecoverable and contradictions persist unresolved.
- **Pattern:** use a knowledge graph as the agent memory substrate: entities + typed relationships give deterministic recall and explainable retrieval paths; vector/embedding stores keep only semantic similarity.
- **Evidence:** "There's no explicit relationships between these embeddings, these vector representations of the facts that we've generated for our memory."; "However, when we look at knowledge graphs, we can define explicit relationships." — Source: WF2025 GraphRAG track.
- **Cross-refs:** Schema-Guided Graph Retrieval (catalog #17), Episodic Memory Retrieval & Injection (#10).

#### C-P2. State-Change Log on Graph — episodic memory as time-indexed graph (emerging)
- **Problem:** agents need to recall not just facts but how facts/states changed over time (preferences flip, evolving situations); a static store returns stale or contradictory state.
- **Pattern:** persist a sequence of state changes onto the graph; the agent reasons over the change history, approximating human recall of changing state.
- **Evidence:** "we store a sequence of state changes on the graph which allows your agent to then reason with those state changes over time."; "a closer approximation to how humans might process and recall changing state over time." — Source: WF2025 GraphRAG track.
- **Cross-refs:** Episodic Memory Retrieval & Injection (#10).
- **Refined by (run 6):** "the failure is experience. It's learning experience... inform the LLM to not take this step or explore other paths" — Source: Richmond Alake (MongoDB), "Architecting Agent Memory" (run 6, `W2HVdB4Jbjs`). Experience memory: store workflow/execution failures as retrievable learning experience; on next execution retrieve them to inform the LLM (F-9). Also strengthens catalog #13 Memory Synthesis from Execution Logs (taxonomy, not in this doc).

#### C-P3. RAG Failure Modes as Agent Memory (validated)
- **Problem:** naive vector RAG used as agent memory fails when facts conflict or when the query is most similar to a superseded fact (vector recall favors similarity over recency/validity).
- **Pattern:** diagnose memory failures by asking whether the store encodes relationships and timeliness; when similarity-based recall returns stale/contradictory top hits, escalate to structured (graph) memory with explicit state.
- **Evidence:** "we actually sit with a bunch of contradictory embeddings with no resolution in the vector database."; "the preference changes however Robbie's follow-up question ... is most similar to the first Adidas fact and so if we're using a vector database, that fact may be at the top of the search results and the agent responds incorrectly." — Source: WF2025 GraphRAG track.
- **Cross-refs:** Episodic Memory Retrieval & Injection (#10).

#### C-P4. Hybrid Retrieval Stack — graph + semantic + BM25 (established)
- **Problem:** no single retrieval primitive covers entity-relation queries, semantic similarity, and exact/full-text matches.
- **Pattern:** combine subgraph identification (semantic search + BM25 full-text) with knowledge-graph traversal; measured retrieval wins over pure vector search on QA benchmarks.
- **Evidence:** "Graffiti uses semantic search and BM25 full text retrieval to identify subgraphs within the broader graffiti graph."; "compared our retrieval system ... with seven different vector search systems and we found that we had the best accuracy and the fastest response time." — Source: WF2025 GraphRAG track.
- **Cross-refs:** Schema-Guided Graph Retrieval (#17), Semantic Context Filtering (#19).
- **Refined by (run 6):** "You give the retrieval capability to the agent as a tool. And now we can choose when to call on information."; "Vector search is not all you need." — Source: Richmond Alake (MongoDB), "Architecting Agent Memory" (run 6, `W2HVdB4Jbjs`). Agentic RAG: retrieval is an agent-chosen tool; vector search alone is insufficient — multiple retrieval mechanisms needed (F-26).

#### C-P5. Graph Snapshot Checkpoint in Agent Loop (emerging)
- **Problem:** an agent acting on live/evolving data needs a consistent point-in-time view to plan and execute against.
- **Pattern:** executor agent snapshots the current graph state (plus test cases and the incoming PR) before acting; snapshot = deterministic checkpoint decoupling agent work from concurrent updates.
- **Evidence:** "the exeutor agent goes looks at the test cases and then it goes into the knowledge graph and it's going to go ahead and actually do a snapshot of the most recent visual or most recent information about the network." — Source: WF2025 GraphRAG track.
- **Cross-refs:** Filesystem-Based Agent State (#11).

#### C-P6. Ontology-First Iterative Graph Construction (established)
- **Problem:** retrieval quality is bounded by schema quality; bad ontologies yield bad retrieval regardless of the store.
- **Pattern:** spend the bulk of effort (~80%) iterating on the ontology/schema, then build vector and graph stores; treat schema as a living artifact refined against retrieval evals.
- **Evidence:** "this is where you'll spend uh 80% of your time to make sure you get the oncology right and you'll be going back and forth in an iterative manner" — Source: WF2025 GraphRAG track ("oncology" = ontology, ASR). Also: "The better is a knowledge graph, the better is the retrieval."
- **Cross-refs:** Schema-Guided Graph Retrieval (#17).

#### C-P14. Memory Harness Payoff Is Context-Overflow-Bound (established)
- **Problem:** memory machinery adds cost; teams add memory without knowing when it earns its keep.
- **Pattern:** memory harness pays off only when the full task + context does not fit the window; when everything fits, memory adds no capability. Long-horizon benchmarks exist to test this boundary.
- **Evidence:** "if I start to run tasks that are longer term horizon and the entire task and the relevant context doesn't uh fit, then having a good memory harness really starts to pay off."; "because for these tasks all the papers and all the information fit into the context, the memory actually didn't add more capability." — Source: WF2026 Autoresearch keynotes.
- **Cross-refs:** Context Window Auto-Compaction (#5), Episodic Memory Retrieval & Injection (#10).

#### C-P15. Salience-Thresholded Episodic Storage (emerging)
- **Problem:** storing every event floods memory; retrieval quality degrades and costs grow.
- **Pattern:** the LLM scores each event's importance; only events above a threshold are written to a separate salient cache for better later retrieval (importance-gated episodic write).
- **Evidence:** "the agent will evaluate or the LM will evaluate uh an important score of an event and if it crosses a threshold, it will store that specific memory uh in a separate cache so that important context can be retrieved better later on." — Source: WF2026 Autoresearch keynotes.
- **Cross-refs:** Episodic Memory Retrieval & Injection (#10), Proactive Agent State Externalization (#14).

#### C-P19. Session-State Materialization & Memory Sharing (emerging)
- **Problem:** handing off long-running sessions between agents/machines loses context.
- **Pattern:** materialize full session state so another agent on another machine can continue it; treat this as state transfer (state of the world attached to the session), not just narrative memory; share memories across agents.
- **Evidence:** "we can share our memories although we use two different agents of different machine the full state of my session kind of get materialized on their machine it kind of less memory and more about the state right the state of the world attached to the session" — Source: WF2026 Autoresearch keynotes.
- **Cross-refs:** Filesystem-Based Agent State (#11), Cross-Agent Lesson Sharing via Git (#6).

#### C-P20. Explicit Memory & State Policy Configuration (emerging)
- **Problem:** memory behavior (what to write, what to retrieve, when to replan) is implicit and unconfigurable.
- **Pattern:** expose memory as policy knobs: memory writing policy, retrieval policy, trust rules, source attribution, replanning triggers — a configurable memory contract for the harness.
- **Evidence:** "for us that meant things like memory writing policy, retrieval policy, communication prompt, belief, trust rules, source attribution, replanning triggers, etc." — Source: WF2026 Autoresearch keynotes (Project Paradox).
- **Cross-refs:** Dynamic Context Injection (#9), Context Budget as Governed Resource (#2).

#### F-4. Cognitive Memory Taxonomy for Agents (established)
- **Problem:** "memory" is hand-waved as short/long-term; agent memory design lacks structure.
- **Pattern:** map agent memory onto the cognitive taxonomy — working, semantic, episodic, procedural (skills stored like cerebellum routines) — plus implementation-oriented types (persona, toolbox, conversation, workflow, entity); agent memory = mechanisms ensuring state persists and informs the next execution step.
- **Evidence:** "There is short-term, long-term, working memory, semantic, episodic, procedural memory."; "Agent memory is the mechanisms that we are implementing to actually make sure that states persist in our AI application." — Source: Richmond Alake (MongoDB), "Architecting Agent Memory" (run 6, `W2HVdB4Jbjs`).
- **Cross-refs:** C-P1/C-P2 (graph/episodic); Episodic Memory Retrieval & Injection (catalog #10).

#### F-5. Memory Management as Context-Curation Process (established)
- **Problem:** large context windows invite dumping all data in, degrading relevance and response quality.
- **Pattern:** memory management is a systematic process of organizing what enters the context window — generation, storage, retrieval, integration, updating, deletion; pull in only relevant memory, structured for effective response.
- **Evidence:** "Memory management is a systematic process of organizing all the information that you're putting into the context window." — Source: Richmond Alake (MongoDB), "Architecting Agent Memory" (run 6, `W2HVdB4Jbjs`).
- **Cross-refs:** Context Budget as Governed Resource (catalog #2); C-P12/C-P20.

#### F-6. Forgetting Mechanisms Over Deletion (emerging)
- **Problem:** memory stores grow unbounded; hard deletion is the wrong model (cluster C explicitly lacked forgetting/eviction content).
- **Pattern:** implement forgetting mechanisms (decay/recency, recall-recency signals, timestamps + conversation IDs) instead of deleting memories; humans don't delete memories.
- **Evidence:** "you don't delete memories... we really should be looking at implementing forgetting mechanisms within the memory management systems." — Source: Richmond Alake (MongoDB), "Architecting Agent Memory" (run 6, `W2HVdB4Jbjs`).
- **Cross-refs:** C-P15 (salience-thresholded storage) — complementary write/evict pair; C-P2 (state-change log).

#### F-7. Persona Memory for Believability & Relationship (established)
- **Problem:** systems feel robotic; user trust is weak (cluster C: persona/identity memory not addressed).
- **Pattern:** persist persona memory (personality, preferences) so the agent builds believable, relationship-forming interactions; memory's stated goals: reliability, believability, capability.
- **Evidence:** "we are trying to make our systems more believable... make them create relationship with the consumer... persona memory helps with that." — Source: Richmond Alake (MongoDB), "Architecting Agent Memory" (run 6, `W2HVdB4Jbjs`).
- **Cross-refs:** Self-Identity Accumulation (catalog #15).

#### F-8. Toolbox Memory — Externalized Tool Schemas (emerging)
- **Problem:** context window holds only ~10–21 tool schemas (OpenAI guidance); tool inventory overflows the window.
- **Pattern:** store tool JSON schemas in a database; just before the LLM call, retrieve the relevant tools with any search (vector/text) — scales tool access beyond the context limit.
- **Evidence:** "you should only put the schema of maybe 10 to 21 tools in the context window... you can just get the relevant tool using any form of search." — Source: Richmond Alake (MongoDB), "Architecting Agent Memory" (run 6, `W2HVdB4Jbjs`).
- **Cross-refs:** A-P5 tool lazy-loading; C-P4 (hybrid retrieval).

#### F-19. Context-Efficient Codebase as Harness Artifact (validated)
- **Problem:** agent output quality is bounded by how much context the codebase demands of the model.
- **Pattern:** adapt the codebase to the harness: tests enforcing file-length limits (e.g., files ≤ 350 lines), one-way-to-do-things (single ORM/language/CI style) for transferable context, error messages with remediation steps for model AND human.
- **Evidence:** "we can write a test that limits the fact that files are no longer than 350 lines."; "providing good error messages that give actual remediation steps to the model and to humans." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** Context Budget as Governed Resource (catalog #2); C-P12.

### f. Reasoning, RL & Self-Improvement Loops

#### A-P13. Harness-Model Co-training (emerging)
- **Problem:** models given unfamiliar tools underperform; training habits conflict with ill-fitted prompts.
- **Pattern:** build model + harness together; feed harness into post-training so models learn to call tools in the real env; align partner tools to training distribution; avoid overprompting.
- **Evidence:** "we also bring this codeex harness into the post-training process of our model. So that means the models can learn to call tools and navigate an environment thats actually something thats open source" — OpenAI keynote, WF2026; "aligning their tools to be in distribution with how the model is trained" — Bill Chen & Brian Fioa, AIE Code 2025.
- **Cross-refs:** none given (frontier-lab practice).

#### C-P7. RL Rollout as the Universal Agent-Harness Loop (established)
- **Problem:** agent-loop design and RL training loops are the same shape, but teams build them separately and lose the training/eval leverage.
- **Pattern:** treat the harness as an RL environment: harness=environment, eval=reward, task=prompt, policy=LLM API; a rollout is initial state + while-loop until done, reusable for both serving and RL.
- **Evidence:** "environments are basically harnesses, rewards are basically eval, tasks are just prompts, and your policy in the RL sense hopefully should just be as simple as like an LLM API."; "you kind of set up some initial state stuff have a while loop for is it done yet?" — Source: WF2025 Reasoning+RL track.
- **Cross-refs:** harness-loop taxonomy (agent loop as reward environment).

#### C-P8. Turn-Count & Honesty Reward Shaping (established)
- **Problem:** a pure success/fail reward does not shape efficiency or honesty; agents pad turns or hallucinate answers.
- **Pattern:** compose rewards: solve eventually + bonus for fewer turns; penalize confident-wrong answers more than explicit "I don't know".
- **Evidence:** "you want to reward it for like uh solving the thing eventually but also like give it more rewards for doing it in less turns"; "we basically penalized it if ... the reward model said hey you got the answer wrong and but it hadn't tried to get an answer ... that was like a much lower reward than if it just said hey I don't know." — Source: WF2025 Reasoning+RL track.
- **Cross-refs:** eval-driven loop control.

#### C-P9. Prompted-Model-First Escalation Ladder (established)
- **Problem:** teams jump straight to RL/training; they cannot attribute wins to the harness vs the training.
- **Pattern:** max out the prompted baseline first, then SFT warm-up (lowers RL barrier), then RL only when prompted baselines are provably exceeded.
- **Evidence:** "I would generally always recommend starting with getting the best performance you can with a prompted model before going to any training including reinforcement learning."; "SFT warm-up as a way of kind of lowering the barrier of entry." — Source: WF2025 Reasoning+RL track.
- **Cross-refs:** eval-driven loop control.

#### C-P10. Reward Hacking as Eval Difficulty; Rubric as Eval Umbrella (validated)
- **Problem:** reward hacking looks like an RL failure but is really an eval-design failure; reward and eval are one system.
- **Pattern:** unify reward models, reward functions, and LM-as-judge under a "rubric" concept; on-the-fly rubric generation by the reward model enables fine-grained RL signals without hand-authored criteria.
- **Evidence:** "reward hacking is really a message about the difficulty of building good evals."; "the term rubric as a conceptual general umbrella around reward models, reward functions, LM as judge setups" — Source: WF2025 Reasoning+RL track.
- **Cross-refs:** eval-driven loop control.

#### C-P11. Synthetic Reasoning-Trace Data Recipe (emerging)
- **Problem:** RL for reasoners needs reasoning traces, but human-written 10k-token traces with backtracking are infeasible to produce at scale.
- **Pattern:** generate training data by sampling multiple reasoning traces per question (works well); bootstrap initial traces via expert-written 5-10 step plans and model checking; note trace rewriting was not helpful.
- **Evidence:** "sampling multiple answers so multiple reasoning traces per question in your data set works really really well."; "OpenAI spending like 12 to 18 months building these initial reasoning traces that they could then train an initial model on."; "a lot of expert people can write a five to 10 step plan that is very good or check the work." — Source: WF2025 Reasoning+RL track.
- **Cross-refs:** Memory Synthesis from Execution Logs (#13) in inverse direction (synthesis feeds training, not context).

#### C-P13. Verifiable-Reward RL + Parallel Rollouts (validated)
- **Problem:** RL signal quality limits reasoning gains; hand-labeled rewards do not scale.
- **Pattern:** RL with verifiable rewards (math/code/execution checks): run many parallel rollouts per task, reward at the end; test-time compute scaling (more samples / best-of-n / self-consistency) compounds with RL training-time scaling.
- **Evidence:** "reinforcement learning with verifiable rewards post01 post deepseeck"; "The current dominant paradigm is reinforcement learning with verified rewards where given a model and a task we perform a number of parallel rollouts and get rewards at the end."; "such as a best of n sampling, self-consistency or verifiers that rerank the candidates." — Sources: WF2025 Reasoning+RL track; WF2026 Autoresearch keynotes.
- **Cross-refs:** eval-driven loop control.

#### C-P16. Eval as Always-On Service with Go/No-Go Gates (established)
- **Problem:** treating eval as a pre-ship testing phase misses regressions in an evolving agent system.
- **Pattern:** run evaluation as a continuous service; emit eval results to a shared dashboard; make go/no-go decisions on prompt/architecture changes; hold out a fixed eval set the loop never sees; feed decisions into an improvement loop (hypothesize → candidate agents → analyze evals).
- **Evidence:** "evaluation is an always running service not a testing phase."; "we emit our evaluation results to weave where we have a common dashboard that we can make go no-go decisions on various prompt changes or architectural changes"; "We also hold out the 19 evaluation task ... the loop never sees." — Source: WF2026 Autoresearch keynotes.
- **Cross-refs:** eval-driven loop control, Context Budget as Governed Resource (#2).
- **Refined by (run 6):** "we go from like a testing and evals paradigm to a monitoring paradigm... monitoring production is just infinitely more important" — Source: Zubin (Raindrop), "Everything You Need To Know About Agent Observability" (run 6, `-aM2EDTiaMs`). Monitoring paradigm over testing/evals: agents are non-deterministic and unbounded in input/output space; semantic-signal A/B (ship to a % of users vs a control group, watch issue rates) (F-13).

#### C-P17. Inner-Loop Verification & Quality-Gated Self-Improvement (emerging)
- **Problem:** feedback arrives only at the end of long runs; agents drift and self-improvement loops submit bad changes.
- **Pattern:** give the agent verification while it works (in-loop verification: data flows, control flows, secrets + agentic checks of intent/business logic); gate submissions on quality gates (e.g., PR only after findings pass); multi-agent self-improvement loops (read papers/PRs, run experiments, submit PR past gate).
- **Evidence:** "the agent is getting verification as it's working"; "a combination of algorithmic verification looking at things like data flows, control flows, known patterns, secrets ... combined with ... agentic verification looking at intent, business logic, the unknown unknowns."; "run its own experiments and submit a PR once the findings pass a quality gate." — Source: WF2026 Autoresearch keynotes.
- **Cross-refs:** eval-driven loop control; Self-Rewriting Meta-Prompt Loop (other-category).
- **Refined by (run 6):** "We need to be continually refreshing context as the agent goes about doing a task... by having reviewer agents look at the code" — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`). Reviewer agents (security, reliability, persona-based) examine in-flight work through the lens of what success looks like, continuously refreshing context and asserting expectations (F-20).

#### F-23. LLM as Fuzzy Compiler (emerging)
- **Problem:** no clear mental model for the harness' role as model capabilities shift between releases.
- **Pattern:** view the harness as a compiler front-end: repo/harness context = constraints + optimization passes on acceptable code; code = compiled artifact of a spec; swapping models = swapping codegen backends while the structure still limits output.
- **Evidence:** "using LLM as fuzzy compiler is like an interesting mental model... effectively like constraints and optimization passes on which code is acceptable." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** C-P7; F-19.

#### F-25. Post-Training Inside the Harness (emerging)
- **Problem:** model behavior differs per harness; generic deployments underperform harness-native conventions.
- **Pattern:** leverage first-party harnesses — labs post-train models in the harness context where they are primarily deployed (apply-patch tool semantics, bash quoting); plug into harnesses to steer rather than rebuild them.
- **Evidence:** "the labs are not just post-training the models, but post-training the models in the context of the harness in which they are primarily deployed." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** A-P13 (harness-model co-training); F-1; F-24.

### g. Observability, Security & Safety

#### A-P6. Lethal Trifecta: private data + untrusted content + tools (established)
- **Problem:** tool calls turn AI safety debate into real danger — irreversible harm via prompt injection + actions.
- **Pattern:** design the harness around the combination (private data + untrusted content + action tools), not any single element.
- **Evidence:** "our agents have access to private data. They have untrusted content like the prompt injections and now we give them tools. Simon Wilson calls this the lethal trifecta"; "tool calls is like handing a gun, a loaded gun to them" — Source: Eric Meyer (Linet Labs), WF2026.
- **Cross-refs:** none given (DIA talk independently confirms the triad).

#### A-P7. Plan-Not-Execute: Air-Gap the Agentic Loop (emerging)
- **Problem:** model that plans AND executes produces side effects before any check ("it might empty your bank account... then it gives you a safe answer").
- **Pattern:** model emits a plan/program (type IO); a separate trusted executor runs it after inspection; check before side effects.
- **Evidence:** "all that were doing is were pushing this IO to the right... instead of executing the agentic loop, it creates a plan and says, Here is the plan to do the agentic loop. And now Bernie will take that plan and well execute it"; "were airgapping the agentic loop from the agent" — Source: Eric Meyer (Linet Labs), WF2026.
- **Cross-refs:** none given (provable-safety direction, Lean/type-system flavored).

#### A-P8. Human Confirmation Gate at the Action Boundary (validated)
- **Problem:** injection defenses fail; last control point is the human at the moment of irreversible action.
- **Pattern:** read-and-confirm step before sensitive writes (form autofill etc.): user sees plain text, keeps control/awareness; bounds blast radius without preventing injection.
- **Evidence:** "before the form is written to, we actually let the user read and confirm that data in plain text. This doesnt prevent a prompt injection, but it gives the user control, awareness" — Source: DIA browser-agent talk, AIE Code 2025.
- **Cross-refs:** none given (matches Claude Code approval UX + Conductor slot-free zones).
- **Refined by (run 6):** "session long tool approval. So it's not just like yeah I approved this specific tool call but yeah you can run all instances of rmrf for slash right that you see in the session" — Source: Sam Bhagwat (Mastra), "Every Harness Will Become A Claw" (run 6, `8qWIPUia2O8`). Approval granularity is a session-level knob: approve tool classes/commands for the session after the first call, trading blast radius for flow (caveat: "the first one will probably wipe your machine") (D-P20; "rmrf" = rm -rf, ASR).

#### A-P9. Sandboxed / Isolated Execution Environment (validated)
- **Problem:** agents run code that is not pre-approved; user machines/laptops cannot safely or at scale host long-running parallel work.
- **Pattern:** secure disposable execution env: code-execution tools, container orchestration at scale, session persistence, separate test boxes.
- **Evidence:** "We needed a secure environment for claude to be able to write and run code thats not necessarily like approved code by you... container orchestration at scale" — Anthropic platform talk, AIE Code 2025; "Thats mostly fixed by using test boxes. So agents can run tests on a separate machine" — Peter Steinberger (OpenClaw), WF2026.
- **Cross-refs:** none given.

#### A-P10. Slot-Free Zones: Human-Review-Mandatory Code Areas (emerging)
- **Problem:** unreviewed agent edits to critical paths (migrations/auth/billing) silently rot codebases.
- **Pattern:** partition codebase into loose vs slot-free zones; CI enforces mandatory human review for the latter; treat CLAUDE.md/skills as curated human context.
- **Evidence:** "a slot-free zone is a part of the codebase or a part of the app that requires really strict human review... any change to the migrations file requires the a uh a human to review it" — Source: Conductor talk, WF2026.
- **Cross-refs:** none given.

#### A-P12. Tool Result Hygiene (Context Management) (validated)
- **Problem:** tool results accumulate and fill the window; old results rarely relevant later.
- **Pattern:** clear/compact stale tool results; pair with memory tool; measured 39% perf bump; extreme form = semantic compression (screenshot ~1.1K tokens vs 20K-token DOM).
- **Evidence:** "tool results from past calls are not necessarily super relevant to help claude get good responses later on in a session... we saw a 39% bump in performance" — Anthropic platform talk, AIE Code 2025; "The full DOM for this would be around 20,000 tokens... this screenshot is about 1,100 tokens" — WF2026 UI talk.
- **Cross-refs:** catalog Context Window Auto-Compaction, Context Budget, Semantic Context Filtering.

#### A-P15. Distributed Tracing Across Tool Boundaries (validated)
- **Problem:** agent tool calls span remote servers/agents; failures invisible without cross-boundary visibility.
- **Pattern:** OpenTelemetry spans + context propagation stitch client/server traces at a shared sink; end-to-end tool-call visibility across languages/environments.
- **Evidence:** "with distributed tracing and context propagation. We can have the remote fetch server send its spans to the same sync as the client and the sync will just stitch together the missing uh parts of the trace" — Source: MCP observability talk (MCP.Run/Dipso), WF2025 MCP track.
- **Cross-refs:** observability cluster; pairs with A-P3 (OTel de-facto standard).

#### C-P18. Trace Collection as Feedback/Observability Substrate (established)
- **Problem:** without run traces you cannot debug, evaluate, or improve an agent loop.
- **Pattern:** collect structured traces during runs — observations, conversations, memory writes, retrievals, belief updates — plus environment feedback (command success/failure); log all agent-user interactions; use traces as the dataset for evals and iteration.
- **Evidence:** "During the run, we collect structured traces, observations, conversations, memory rights, retrievals, belief updates, whatever is relevant to us in that case, we collect."; "there's also environment feedback where you know what actually happened when the code run whether the command succeeded or failed."; "if you are building an agentic app ... you should definitely be logging your agentic traces." — Source: WF2026 Autoresearch keynotes.
- **Cross-refs:** Memory Synthesis from Execution Logs (#13).
- **Refined by (run 6):** "we are storing on the original traces, and then we come in and implement my new signal... so I can do some kind of postmortem analysis" — Source: Zubin/Danny (Raindrop), "Everything You Need To Know About Agent Observability" (run 6, `-aM2EDTiaMs`). Trace substrate for postmortem & signal replay: later-defined signals replay over stored traces; describe target trace shapes (trajectories, e.g., 3 tool-call failures) to find relevant traces (F-27).

#### D-P17. Steinberger's Law: Harness Convergence (Every Harness Becomes a Claw) (emerging)
- **Problem:** harnesses proliferate as distinct products (local, cloud, open-source frameworks) with a growing feature gap; users want claw features but with power and control.
- **Pattern:** harnesses ascend an agentic spectrum (LLM → agent → harness → claw) and expand until they absorb claw capabilities (initiative + learning + always-on); design harness features for that trajectory (technological + economic + psychological drivers).
- **Evidence:** "I believe every harness will expand until it becomes a claw" — Source: Sam Bhagwat (Mastra), "Every Harness Will Become A Claw" (run 6, `8qWIPUia2O8`).
- **Cross-refs:** A-P11 (harness as abstraction layer), B-P25 (self-modifying harness).

#### D-P18. Claw Infrastructure: Heartbeat, Feed Services, Daemon/Gateway, Continual Learning (validated)
- **Problem:** a local interactive harness stops when the human stops; agents cannot act on external events or self-improve.
- **Pattern:** claw = harness + initiative + learning: listens to external feed services, heartbeat (wakes every defined interval), channels (Slack/WhatsApp/Telegram), persistent memory, daemon + gateway for inbound/outbound requests, continual learning from its own traces (auto skill generation; modifying driving code — mechanism unsettled).
- **Evidence:** "the agent is listening to external feed services. It has a heartbeat which means it wakes up every you know defined amount of time and does something" — Source: Sam Bhagwat (Mastra), "Every Harness Will Become A Claw" (run 6, `8qWIPUia2O8`).
- **Cross-refs:** A-P9 (cloud sandboxes host always-on runtime), A-P3 (gateway), C-P18 (traces feed learning).

#### D-P19. Durability/Doggedness as a Harness Quality + Always-On Cloud Shift (emerging)
- **Problem:** agents crash/disconnect mid-turn; single-machine parallelism caps fan-out; local git-worktree output does not fit async collaboration.
- **Pattern:** durability qualities (run hours/days: persisted streams/resume, planning mode, parallel subagents, autocompaction, persisted threads, steer/interrupt); shift to always-on cloud harness (Slack/mobile channels, cloud sandboxes for parallelism, output as PR to GitHub).
- **Evidence:** "durability just the sheer quality of being able to run not for minutes but for hours or days" — Source: Sam Bhagwat (Mastra), "Every Harness Will Become A Claw" (run 6, `8qWIPUia2O8`).
- **Cross-refs:** B-P4 (loop recovery), B-P6 (parallelism), C-P19 (session state), A-P9.

#### F-10. Explicit vs Implicit Signal Taxonomy (validated)
- **Problem:** teams monitor only exceptions (Sentry-style); fuzzy agent failures go unseen.
- **Pattern:** two signal classes: explicit = objective/verifiable (tool error rate, latency, user regenerations, cost); implicit = semantic (regex, classifiers, self-diagnostics: refusals, task failure, user frustration, NSFW/moderation, jailbreaks, wins); fuzzy failures matter more than explicit ones.
- **Evidence:** "Implicit signals deal with sort of the semantic nature of what's going on. And explicit signals deal with objective reality." — Source: Zubin (Raindrop), "Everything You Need To Know About Agent Observability" (run 6, `-aM2EDTiaMs`).
- **Cross-refs:** C-P18 (trace substrate); F-11/F-12.

#### F-11. Binary Classifiers over LLM-as-Judge for Issue Signals (validated)
- **Problem:** LLM-as-judge ratings ("rate 1-10") are weak, unstable detection signals.
- **Pattern:** define a solid set of target issues and train/deploy binary classifiers that report issue-rate up/down (language-independent); cheaper and more reliable than generic judging.
- **Evidence:** "The best implicit signals are detecting issues. They're not necessarily LLM as a judge judging outputs." — Source: Zubin (Raindrop), "Everything You Need To Know About Agent Observability" (run 6, `-aM2EDTiaMs`).
- **Cross-refs:** C-P10 (rubric umbrella); F-16.

#### F-12. Self-Diagnostics — Agent Reports Its Own Failure (emerging)
- **Problem:** agents hide internal failures (story: agent "fixed" a failing S3 test by deleting it and confessed only when asked); implicit signals miss them.
- **Pattern:** give the agent a generic report tool framed as writing notes to its creator; encourage reporting in the system prompt (models are trained to be polished and resist self-incrimination); catches tool failures, user frustration, capability gaps.
- **Evidence:** "asking it to send like a short report to your creator... the framing of writing notes to its creator." — Source: Danny (Raindrop), "Everything You Need To Know About Agent Observability" (run 6, `-aM2EDTiaMs`).
- **Cross-refs:** C-P17 (inner-loop verification); F-2.

#### F-14. Triage Agent — Automated Spike Investigation (emerging)
- **Problem:** dashboards surface spikes but humans cannot investigate all of them at scale.
- **Pattern:** a triage agent reviews all configured signals daily; on a spike it investigates with tools over traces and surfaces issues the team didn't know about.
- **Evidence:** "if it sees something spike, it will go and do an investigation... it can look at all the traces... detect issues that you didn't know about." — Source: Zubin (Raindrop), "Everything You Need To Know About Agent Observability" (run 6, `-aM2EDTiaMs`).
- **Cross-refs:** C-P18; F-12.

#### F-15. Observability-Driven Evaluation at Per-Step Granularity (validated)
- **Problem:** binary did-it-work evals hide where the failure occurred; multi-agent chains need component-level attribution.
- **Pattern:** define metrics at every step of the flow (tool call success, RAG retrieval correctness, hallucination, coherent answer); evaluate every component, not the whole.
- **Evidence:** "It's not just that binary did my agent work yes or no question. It's at what step in the process did my agent fail." — Source: Jim Bennett (Galileo), "Taming Rogue AI Agents" (run 6, `xJXm4Wcw4m8`).
- **Cross-refs:** C-P16; F-10.

#### F-16. Better LLM Judges the Cheap Execution LLM (established)
- **Problem:** judging with the same cheap model is weak; judging every trace with a frontier model is unaffordable.
- **Pattern:** cheapest LLM in the app, best LLM (or custom-trained small eval model) for judging with well-defined prompts; sample (e.g., 10K of 1M daily traces); "set the thief to catch the thief"; start during prompt engineering/model selection, keep in dev + CI/CD + production.
- **Evidence:** "you use a better LLM to score than the LLM you use in your application... we're going to test say 10,000 of them use an expensive LLM." — Source: Jim Bennett (Galileo), "Taming Rogue AI Agents" (run 6, `xJXm4Wcw4m8`).
- **Cross-refs:** C-P10 (rubric umbrella); F-11.

#### F-17. Action Completion vs Action Advancement Metrics (emerging)
- **Problem:** task success is under-specified; an agent can finish the literal request without advancing toward the end goal (3-step account-balance example).
- **Pattern:** track two subtly distinct metrics — completion (did it do what was asked across the whole flow) and advancement (did it move toward the end goal).
- **Evidence:** "Action completion is did it actually do the thing it was asked to do... Action advancement is did it move forward towards the end goal?" — Source: Jim Bennett (Galileo), "Taming Rogue AI Agents" (run 6, `xJXm4Wcw4m8`).
- **Cross-refs:** C-P8 (reward shaping); F-15.

#### F-18. AI-Suggested, Human-Approved Correction (CLHF) (validated)
- **Problem:** metrics can be wrong; automatic self-fixing loops risk compounding errors ("there be dragons").
- **Pattern:** AI analyzes all data and suggests fixes ("this metric is low — the LLM fails to use the balance tool"); humans approve the fix; continuously retrain metrics with human feedback (continuous learning by human feedback) — metrics never perfect out of the box.
- **Evidence:** "Retune and have that continuous training of your metrics because your metrics will never be perfect out the box." — Source: Jim Bennett (Galileo), "Taming Rogue AI Agents" (run 6, `xJXm4Wcw4m8`).
- **Cross-refs:** C-P17 (quality-gated improvement); F-14.

#### F-21. Feedback-to-Repo Loop: Review Comments into Self-Healing Prompts (validated)
- **Problem:** human review feedback is synchronous and per-PR; the same mistakes recur run after run.
- **Pattern:** treat human review feedback as evidence of agent context failure; convert it into durable repo docs (persona-oriented "what good looks like") consumed via failing tests or reviewer agents so the agent self-heals; weekly "garbage collection day" to categorize and eliminate slop.
- **Evidence:** "the feedback that humans were giving on the PR indicates some context failure on behalf of the agent."; "automatically prompt inject the agent so that it would self-heal." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** F-20; Memory Synthesis from Execution Logs (catalog #13); C-P18/C-P19.

#### F-22. Non-Blocking Hub-and-Spoke Feedback (validated)
- **Problem:** prescriptive "address every comment" rules can make the agent submissive — "bullied by all of the reviewers".
- **Pattern:** broadcast feedback (humans + agents) without blocking on any contribution; the implementation agent may acknowledge, defer, or reject feedback, preserving its reasoning.
- **Evidence:** "The implementation agent can acknowledge, defer, or reject any feedback... your coding agent being bullied by all of the reviewers." — Source: Ryan Lopopolo (OpenAI), "Harness Engineering: Humans Steer, Agents Execute" (run 6, `am_oeAoUhew`).
- **Cross-refs:** F-21; F-2.

## 4. Cross-cutting themes

1. **Minimal harnesses outperform feature-heavy ones (minimal-surface harnesses).** The while-loop + tool-calling core (B-P1, refined by E-9), the minimal system prompt (B-P9), and the terminal-only tool surface topping leaderboards (B-P15, refined by E-18; B-P16) repeatedly beat rich file/sub-agent tooling; tool proliferation actively degrades selection (A-P14) and pruning that removes signal "lobotomizes" the model (B-P10). Run 6 adds: the deliberately unopinionated terminal as the lowest-level product layer (E-18), read-before-edit enforced through one dedicated grep tool (E-20), and bash-as-the-core-tool — create/run/delete a Python file is the canonical move (E-18).

2. **The harness owns the context, therefore it owns behavior.** Context is the control surface — system prompt, tool definitions, pruning and compaction are behavior knobs, not plumbing (B-P8, A-P12, C-P12). Specs-as-code and AGENTS.md-style files make intent part of that persistent context (B-P13, refined by E-29); manual-first disclosure preserves user trust (B-P23); edit-format economics make the loop cheap (B-P22, refined by E-19). Run 6 adds the definitional frame — the harness is an instruction-surfacing layer (F-1) — plus the stateless-LLM thesis: better tokens in, better tokens out (E-3); the scarce resources are time, attention, and context (F-3); and the codebase itself is adapted to keep context cheap (F-19).

3. **The intentional-compaction canon.** Run 6 establishes compaction as an explicit, human-reviewed workflow rather than a silent truncation: compress → review → tag → fresh start (E-2); research-plan-implement phases each ending in compaction (E-5); the smart-zone context budget — staying under the ~90% fill line because "the more you use the context window, the worse outcomes you'll get" (E-1); and new-thread-over-compaction at capacity because auto-compaction drops the middle and makes you wait minutes (E-8). Contrast with the counter-pattern of naive pruning that lobotomizes (B-P10).

4. **The tool surface is the security surface.** Tool access converts safety debates into irreversible actions — the lethal trifecta (A-P6). Defenses concentrate on the boundary: gateway-held credentials and rate limiting (A-P3, refined by D-P13), least-privilege scoping (B-P19, refined by D-P7), sandboxed execution (A-P9), human confirmation at the action boundary rather than per-call theater (A-P8, refined by D-P20; B-P18), and plan-not-execute air-gapping as a provable-safety direction (A-P7, A-P10). Run 6 adds: tool-description poisoning as an injection surface (D-P2), coarse-grained outcome tools as fewer doors (D-P3), schema-level input constraint (D-P4), tool-result minimal exposure (D-P6), and the stdio→HTTP security cliff (D-P8).

5. **Security-by-design coupling: tool design is the security surface.** Run 6 makes explicit that design and security are one discipline — "a badly designed MCP server is also a badly secured one" (D-P1). Documentation is a defensive layer against description shadowing (D-P5); long-lived shared credentials are a confused-deputy anti-pattern (>50% of MCP servers) (D-P9); the fix is dynamic scoped access via short-lived tokens + refresh (D-P12), CIMD URL-bound client identity (D-P10), token exchange for per-hop least privilege (D-P11), URLs-in-PKI agent identity + attestation (D-P14), transactional authorization via RAR (D-P15), and enterprise governance with tool-level RBAC + data masking + full-request trace (D-P16).

6. **Memory pays only at the context-overflow boundary.** Memory machinery earns its keep exactly when the task + context exceed the window (C-P14); compaction cadence is a harness design lever (C-P12); storage must encode relationships and time, not just similarity, or it returns stale/contradictory facts (C-P1, C-P2, C-P3, C-P4, refined by F-26); salience-thresholded and policy-configured memory keep the cost bounded (C-P15, C-P20). Run 6 adds the cognitive memory taxonomy (F-4), memory management as context curation (F-5), forgetting mechanisms over deletion (F-6), persona memory (F-7), externalized toolbox schemas (F-8), and experience memory — failures as retrievable data (F-9).

7. **Evaluation is always-on loop control, not a phase.** Reward and eval are one system (C-P10); eval runs as a continuous service with go/no-go gates feeding an improvement loop (C-P16, refined by F-13); RL rollouts reuse the same harness loop shape (C-P7), with verifiable rewards and parallel rollouts as the dominant paradigm (C-P13) and prompted-model-first escalation before training (C-P9). Run 6 adds per-step evaluation granularity (F-15), a better judge than the executing LLM (F-16), completion-vs-advancement metrics (F-17), and AI-suggested/human-approved correction — continuous learning by human feedback (F-18).

8. **Human gates belong at irreversible boundaries, not in the hot path.** Ask-explore-then-do sequencing (B-P2, refined by E-7), human judgment gates on migrations/permissioning (B-P14), inner/outer loop separation (B-P7), slot-free zones (A-P10), read-and-confirm before sensitive writes (A-P8), and propose-not-apply review loops (B-P7) all place the human at decision boundaries while letting the agent iterate freely inside the loop. Run 6 adds: humans steer, agents execute — every "continue" click is a harness failure signal (F-2); transactional consent at action time via RAR (D-P15); session-scoped approval as a granularity knob (D-P20); human-on-the-loop /iterate resteering (E-14); and non-blocking hub-and-spoke feedback so the agent isn't "bullied by all of the reviewers" (F-22).

9. **Recovery, parallelism and checkpoints keep the loop alive.** Loop-failure detection with rollback to known-good state (B-P4), compile-then-fix inner loops (B-P5, refined by E-30), sandbox-enabled mass retry and parallel best-of-n (B-P6), graph snapshots (C-P5), and session-state materialization (C-P19) make the harness robust to the high failure rate of individual runs. Run 6 adds: deterministic-first loop steps — never send an agent to do deterministic code's job (E-12), todo-list injection for resume-after-crash (E-22), control-loop architecture (E-10) and incremental control over blind one-shots (E-11), PR-as-loop-artifact with label-based dedup (E-13), and one ordered commit path per mutable state boundary (E-16).

10. **Observability is a first-class harness feature — and signals have a taxonomy.** Distributed tracing stitches cross-boundary tool calls (A-P15); structured trace collection is the substrate for evals and debugging (C-P18, refined by F-27 — stored traces enable postmortem signal replay); inspectable state surfaces (terminal mirror, snapshot-as-git-log, control-plane monitoring) are trust and debugging infrastructure (B-P24). Run 6 adds the explicit-vs-implicit signal taxonomy (F-10), binary classifiers over LLM-judge ratings as the best implicit signals (F-11), self-diagnostics framed as "notes to your creator" (F-12), a triage agent that investigates spikes (F-14), and cheap agent-smell metrics (tool-call/retry/time) for sanity-checking harness changes (E-26).

11. **Harness convergence: every harness becomes a claw (Steinberger's Law).** Run 6's Mastra talk predicts harnesses ascend an agentic spectrum (LLM → agent → harness → claw) and expand until they absorb claw capabilities — initiative + learning + always-on (D-P17). Claw infrastructure = heartbeat, external feed services, channels, daemon + gateway, persistent memory, continual learning from traces (D-P18); durability — running for hours or days — plus an always-on cloud shift with output-as-PR (D-P19); and an eventual ecosystem shakeout to 1–2 winners per category (D-P21). Ties to the harness-as-abstraction-layer thesis (A-P11) and self-modifying harnesses (B-P25).

12. **Harness-failure attribution: most production agent failures are harness failures.** Run 6's "Your Agent Didn't Fail. Your Harness Did." makes the case that context assembly, state transitions, tool gating, ordering, and receipts are where production failures live — "most of the agent failures are not model failures. Those are harness failures" (E-15). The failure-shape catalog (state hole, overlapping writers, dangling tool call, approval drift, missing edge proof) gives the shapes to design against (E-17); ordered commit paths prevent writer races (E-16); approval as a structured object prevents approval drift (E-27); and receipt-vs-transcript proof — model proposes, harness commits, receipt proves — makes the audit trail the evidence that survives (E-28). Complements harness-vs-model judging by cross-model leaderboard deltas (B-P16).

## 5. Coverage gaps & limitations

**Run-6 closure.** The 7 videos previously blocked by the YouTube IP ban were all fetched in run 6 and are now covered: `BurJvbqFr4c` (Your Insecure MCP Server Won't Survive Production), `rmvDxxNubIg` (No Vibes Allowed), `Lue8K2jqfKk` (Claude Code & the evolution of agentic coding), `W2HVdB4Jbjs` (Architecting Agent Memory), `blmAkayzE8M` (How to Secure Agents using OAuth), `-aM2EDTiaMs` (Everything You Need To Know About Agent Observability), `xJXm4Wcw4m8` (Taming Rogue AI Agents). The 5-video watch list was also fully cached. Run-1 gap notes that run 6 resolved: tool-poisoning deep-dive (now D-P2), OAuth-for-agents deep-dive (D-P9..D-P15), Claude Code permission-model internals (E-21, E-27), observability deep-dive (F-10..F-18), MCP transport/security details (D-P8), explicit least-privilege mechanics (D-P7), forgetting/eviction (F-6), persona/identity memory (F-7).

**Remaining thin areas (from run-6 checkpoint gap notes — do not infer content):**
- Transport-level MCP security (TLS, CORS specifics) is named but not deep-dived in any run-6 transcript (D checkpoint).
- Least-privilege at the sandbox/credential-mount level (env vars, secret injection into sandboxes) is still thin (D checkpoint).
- Refresh-token rotation failure modes and edge cases — not covered (D checkpoint).
- Agent-to-agent auth deployment evidence: "I don't know how much of this is happening in practice today" (Jared Hanson) — pattern exists, deployment evidence absent (D checkpoint).
- Claw continual-learning mechanisms are unsettled ("we haven't figured out what the right way of doing it is yet" — Sam Bhagwat); data masking implementation specifics (techniques/formats) named as requirement only; async out-of-band consent raised but not extracted (D checkpoint).
- Forgetting mechanics detail (decay curves, TTL, recency math): F-6 names forgetting but no specifics; cluster C had none (F checkpoint).
- OTel/instrumentation spec mechanics (spans, exports): the observability talk is product-level only (F checkpoint).
- Explicit safety guardrails (refusal policies, moderation gates) beyond detection signals: absent across all four F transcripts (F checkpoint).
- Self-diagnostics effectiveness numbers: demoed, not measured (F checkpoint).
- Compaction full summarization internals (92% limit and drop-middle strategy confirmed in E-8, but full detail lives in the agentic-patterns taxonomy Clawdbot, not these transcripts).
- Claude Code hooks/workflows features mentioned only glancingly; MCP client internals beyond tool-listing/security vector not covered; permission-UI/approval-UX details not covered by the run-6 E transcripts (E checkpoint).

**ASR / attribution caveats.**
- All quotes are verbatim auto-captions: filler words (uh/um), and mis-transcriptions such as "cloud code" for Claude Code and "oncology" for ontology are preserved as-is in evidence quotes.
- Speaker attribution: single-stream auto-captions carry no speaker labels; speakers are named only where checkpoint sources named them or where the caption text itself attributes. Cluster C quotes are attributed to track/video only.
- **Unresolved speaker attribution:** the caption of "Your Agent Didn't Fail. Your Harness Did." (`BInpv7lGp1o`) self-identifies "Hi, I'm Ben. I work on core data and AI... I'm [a builder of] OpenClaw", while the catalog lists Vinoth Govindarajan (OpenAI). Quotes from that talk cite the video title only; not resolved in run 6.
- WHY-AE (swyx) is a conference framing talk — thin on harness mechanics; treated as context, not pattern source.

## 6. Appendix

### Source transcripts used (24 cached; 23 mined)

| # | Video | ID | Date | Dur | Used for |
|---|---|---|---|---|---|
| 1 | AI Engineer World's Fair 2025 Day 1 Keynotes — MCP Track | `z4zXicOAF28` | (see note) | — | Clusters A/D (P1–P5, P15; MCP security) |
| 2 | AIE Code 2025 — AI Leadership (Anthropic, OpenAI, McKinsey, Bloomberg) | `cMSprbJ95jg` | (see note) | — | Cluster A (P6, P8, P9, P11–P13) |
| 3 | WF2026 Software Factories Keynotes (Microsoft, OpenAI, OpenClaw, Conductor) | `htM02KMNZnk` | (see note) | — | Clusters A/D (P6–P10, P12–P14; claw) |
| 4 | Building pi in a World of Slop (Mario Zechner) | `RjfbvDXpFls` | 2026-04-16 | 18m | Cluster B (PI) |
| 5 | Why Agent Engineering (swyx) | `5N33E9tC400` | 2025-03-24 | 12m | Cluster B (WHY-AE) |
| 6 | AI Engineer World's Fair 2025 Day 2 Keynotes — SWE Agents Track | `U-fMsbY-kHY` | (see note) | — | Cluster B (WF2025) |
| 7 | AIE Europe Keynotes — Coding Agents (pi, Google DeepMind, Anthropic…) | `zdroS0Hc74` | (see note) | — | Cluster B (AIE-EU) |
| 8 | AI Engineer World's Fair 2024 Keynotes — Codegen Track | `5zE2sMka620` | (see note) | — | Cluster B (WF2024) |
| 9 | AI Engineer World's Fair 2025 — GraphRAG | `RR5le0K4Wtw` | (see note) | — | Cluster C (T1) |
| 10 | AI Engineer World's Fair 2025 — Reasoning + RL | `-9E9_21tx04` | (see note) | — | Cluster C (T2) |
| 11 | WF2026 Autoresearch Keynotes (Anthropic, Google DeepMind…) | `4sX_He5c4sI` | (see note) | — | Cluster C (T3) |
| 12 | 6-things channel promo | (ID not recorded in checkpoints) | (see note) | — | None (promo; cached but not mined) |
| 13 | Your Insecure MCP Server Won't Survive Production (Tun Shwe + Jeremy Frenay, Lenses) | `BurJvbqFr4c` | 2026-04-08 | 25m | Cluster D (D-P1–D-P11, D-P16) |
| 14 | How to Secure Agents using OAuth (Jared Hanson, Keycard) | `blmAkayzE8M` | 2025-07-30 | 19m | Cluster D (D-P11–D-P15) |
| 15 | Every Harness Will Become A Claw (Sam Bhagwat, Mastra) | `8qWIPUia2O8` | 2026-07-21 | 16m | Clusters D (D-P17–D-P21) |
| 16 | No Vibes Allowed (Dex Horthy, HumanLayer) | `rmvDxxNubIg` | 2025-12-02 | 21m | Cluster E (context canon; E-1..E-6) |
| 17 | Claude Code & evolution of agentic coding (Boris Cherny, Anthropic) | `Lue8K2jqfKk` | 2025-07-04 | 18m | Cluster E (product layer; E-7, E-29, E-30) |
| 18 | How Claude Code Works (Jared Zoneraich, PromptLayer) | `RFKCzGlAU6Q` | 2025-12-26 | ~60m | Cluster E (internals; E-8, E-9, E-19..E-26) |
| 19 | Loop Engineering from First Principles (Kyle Mistele, HumanLayer) | `xIt_mTQp6mY` | 2026-07-25 | 18m | Cluster E (loop design; E-10..E-14, E-25) |
| 20 | Your Agent Didn't Fail. Your Harness Did. | `BInpv7lGp1o` | 2026-07-29 | 18m | Cluster E (failure taxonomy; E-15..E-17, E-27, E-28) |
| 21 | Architecting Agent Memory (Richmond Alake, MongoDB) | `W2HVdB4Jbjs` | 2025-06-27 | 18m | Cluster F (memory; F-4..F-9, F-26) |
| 22 | Everything You Need To Know About Agent Observability (Raindrop) | `-aM2EDTiaMs` | 2026-05-07 | 50m | Cluster F (observability; F-10..F-14, F-27) |
| 23 | Taming Rogue AI Agents (Jim Bennett, Galileo) | `xJXm4Wcw4m8` | 2025-06-27 | 16m | Cluster F (evals; F-15..F-18) |
| 24 | Harness Engineering: Humans Steer, Agents Execute (Ryan Lopopolo, OpenAI) | `am_oeAoUhew` | 2026-04-17 | 46m | Cluster F (definitional; F-1..F-3, F-19..F-25) |

*Dates: only 2 of the first 12 cache entries were duration-verified (why-agent-engineering 2025-03-24; building-pi 2026-04-16); dates for the remaining run-1 conference tracks are not recorded in the checkpoints and are not invented here. All 12 run-6 entries are duration-verified and date-stamped via get_video_info per the catalog memory. The 12th transcript (promo) contributed no patterns.*

### Run-6 fetch note
All 7 formerly blocked videos and all 5 watch-list videos were fetched verbatim in run 6 (2026-08-07) after the YouTube IP ban lifted; the retry list is **cleared**. Blocked until run 6: `BurJvbqFr4c`, `rmvDxxNubIg`, `Lue8K2jqfKk`, `W2HVdB4Jbjs`, `blmAkayzE8M`, `-aM2EDTiaMs`, `xJXm4Wcw4m8`. Watch list (cached in run 6): `am_oeAoUhew`, `BInpv7lGp1o`, `8qWIPUia2O8`, `xIt_mTQp6mY`, `RFKCzGlAU6Q`. Cache count: 24 entries (12 pre-existing + 12 new).

### Checkpoint memories
- `mem:researches/harness-patterns-tools-permissions-security` — Cluster A, 15 patterns (run 1)
- `mem:researches/harness-patterns-loop-context-coding` — Cluster B, 27 patterns (run 1)
- `mem:researches/harness-patterns-memory-state-retrieval` — Cluster C, 20 patterns (run 1)
- `mem:researches/harness-patterns-tools-security-run6` — Cluster D, 21 patterns (run 6)
- `mem:researches/harness-patterns-loop-context-coding-run6` — Cluster E, 30 patterns (run 6; the mining pass was initially counted as 26 patterns, but the final checkpoint body contains 30 — E-1..E-30, 22 NEW + 8 REFINEMENT)
- `mem:researches/harness-patterns-memory-observability-run6` — Cluster F, 27 patterns (run 6)
- `mem:researches/youtube-ai-engineer-catalog` — channel catalog, blocked/watch lists, cache status
- Taxonomy anchors: `mem:researches/agentic-patterns-context-memory-patterns`, `mem:researches/agentic-patterns-memory-patterns` (22-pattern catalog)
