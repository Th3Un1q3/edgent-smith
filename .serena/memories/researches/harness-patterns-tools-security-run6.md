# Harness Engineering Patterns - Tools, Permissions, Security & Ecosystem (Cluster D, Run 6)

Cluster D of @aiDotEngineer harness-engineering mining (2026-08-07). Extracted from 3 NEW cached transcripts (run 6, IP-ban lifted) via in-sandbox keyword-filtered reads (windowed scoring; never full dumps). Companion to cluster-A checkpoint mem:researches/harness-patterns-tools-permissions-security (A-P1..A-P15). D-Pn patterns ready for consolidation into docs/harness-engineering-patterns.md; ground truth lives in the cache entries below.

## Sources
- mem:cache/youtube-videos/ai-engineer/your-insecure-mcp-server-won-t-survive-production-tun-shwe-l_BurJvbqFr4c (20.7K, 25m) - Tun Shwe + Jeremy Frenay (Lenses): MCP server security, tool poisoning, schema input constraint, security cliff, OAuth DCR vs CIMD, token exchange, enterprise governance.
- mem:cache/youtube-videos/ai-engineer/how-to-secure-agents-using-oauth-jared-hanson-keycard-passke_blmAkayzE8M (19.5K, 19m) - Jared Hanson (Keycard, Passport.js): OAuth for agents, authz/resource-server separation, token lifecycle, agent identity, agent-to-agent, transactional authz, chain of custody.
- mem:cache/youtube-videos/ai-engineer/every-harness-will-become-a-claw-sam-bhagwat-mastra_8qWIPUia2O8 (15K, 16m) - Sam Bhagwat (Mastra): harness convergence (Steinberger's Law), claw features (heartbeat/feed/learning), always-on cloud harnesses, ecosystem shakeout.
- Context: mem:researches/harness-patterns-tools-permissions-security (cluster A), mem:researches/youtube-ai-engineer-catalog (run-6 section), taxonomy mem:researches/agentic-patterns-context-memory-patterns.

## Method
Each transcript read INSIDE serena sandbox: 1600-char windows (800 step), scored vs cluster-D keyword seed set (mcp, tool, poison, attack, security, permission, auth, oauth, token, scope, credential, secret, client, server, schema, input, constrain, exposure, harness, claw, heartbeat, feed, service, identity, consent, refresh, register, resource, attest), top non-overlapping windows returned (14/transcript cap), plus one targeted offset dig (transcript 3). ~26K chars consumed of 55K total. Quotes verbatim ASR (OOTH = OAuth as transcribed).

## Patterns (21)

### D-P1. Design-Security Coupling: Bad Design = Bad Security (NEW)
- Problem: security treated as an add-on OAuth layer bolted onto a finished tool interface.
- Pattern: design and security are one discipline; the three human-vs-agent interface dimensions (discovery, iteration, context) each cast a security shadow; fix design first, no OAuth compensates.
- Evidence: "A badly designed MCP server is also a badly secured one. Poor design and poor security compound each other" (Tun Shwe, BurJvbqFr4c).
- Classification: validated. Cross-ref: A-P6 (tool surface is the security surface).

### D-P2. Tool-Description Poisoning Surface (NEW)
- Problem: agents read every tool description on connect; descriptions are invisible-to-human instruction vectors the model follows unconditionally.
- Pattern: every tool description is an injection surface; more tools = more surface area; mitigate via curation (fewer tools), complete unambiguous docs (D-P5), schema constraint (D-P4). OWASP MCP top-10 item #3.
- Evidence: "Every one of those tool descriptions is a surface for tool poisoning. Attackers can embed hidden instructions inside descriptions that are invisible in the UI, but the model will follow them without question" (Tun Shwe, BurJvbqFr4c).
- Classification: established (OWASP-cited). Cross-ref: A-P14 (tool proliferation), A-P6; fills cluster-A gap flag.

### D-P3. Outcome-Level Coarse-Grained Tools (Fewer Doors) (NEW)
- Problem: fine-grained tools expose many callable operations; each is a door needing its own permission check, audit, authz enforcement.
- Pattern: consolidate related fine-grained operations into one coarse-grained outcome tool; yields one permission check, one audit log entry, one authz point. Inverse of micro-tool designs.
- Evidence: "squash all the fine-grained operations or underlying API calls into a single coarse-grained operation that produces a desired outcome. Every tool you expose is a door" (Tun Shwe, BurJvbqFr4c).
- Classification: validated. Cross-ref: B-P19, A-P14.

### D-P4. Constrain Inputs at the Schema Level (NEW)
- Problem: command-injection flaws trace to unconstrained string arguments passed to shells/query engines/APIs; models freely produce free-form payloads.
- Pattern: declare tool inputs with top-level primitives + enums; forbid free-form nested payloads; strict typing (Pydantic). Constrained inputs are easier to validate and harder to exploit.
- Evidence: "reject free-form nested payloads to avoid command injection flaws where the root cause is almost always unconstrained string arguments" (Tun Shwe, BurJvbqFr4c).
- Classification: validated (OWASP-aligned). Cross-ref: D-P2, A-P14 (schema is also the selection-control point).

### D-P5. Documentation as a Defensive Layer (NEW)
- Problem: weak tool descriptions leave a vacuum an attacker-controlled neighboring server description can fill (description shadowing).
- Pattern: write complete, unambiguous, high-signal docs for every tool; complete docs crowd out poisoned neighbor descriptions and disambiguate similar tools.
- Evidence: "If your documentation is complete and unambiguous for every tool, it crowds out the space that a poisoned neighboring server would try to fill" (Tun Shwe, BurJvbqFr4c).
- Classification: emerging. Cross-ref: D-P2, A-P14.

### D-P6. Return Only What the Agent Needs (Tool-Result Minimal Exposure) (NEW)
- Problem: oversharing tool responses puts PII/credentials/system details into the context window where one prompt injection exfiltrates them (OWASP MCP #10 context injection and oversharing).
- Pattern: strip tool-result payloads to the minimum the current task needs; treat the context window as a liability, not storage.
- Evidence: "Oversharing data in tool responses is number 10 in OWASP's MCP guide and it turns the agent's context window into a liability" (Tun Shwe, BurJvbqFr4c).
- Classification: established (OWASP-cited). Cross-ref: A-P12 (hygiene = context side; D-P6 = security side), A-P6.

### D-P7. Scope Permissions at Tool/Resource Level, Not Session Level (REFINEMENT of B-P19)
- Problem: session-level scopes/OAuth grants are too coarse; a session grant leaks to every tool the server exposes.
- Pattern: authorize per tool/resource; use the MCP read-only annotation for non-destructive tools so clients can enforce; convert read-only tools to MCP resources; delete unused tools (each removed tool = eliminated vector).
- Evidence: "Scope permissions at the tool and resource level, not the session level. Use the MCP read-only annotation for non-destructive tools so that clients can enforce boundaries" (Tun Shwe, BurJvbqFr4c).
- Classification: validated. Cross-ref: strengthens B-P19 (Least-Privilege Scoping by Default) with tool/resource mechanics + read-only annotation; A-P10; D-P16.

### D-P8. The Security Cliff: stdio Walled Garden to Streamable HTTP (NEW)
- Problem: local stdio MCP (single user, no network, no auth) is a walled garden; production needs streamable HTTP (remote, multi-client, scaling) with no gradual on-ramp - OAuth, token mgmt, CORS, TLS, rate limiting arrive all at once; stdio collapses under concurrency.
- Pattern: treat local-to-remote as a chasm to plan for; pick transport by deployment reality; scale-out forces streamable HTTP (you are either behind the wall or standing out in the open).
- Evidence: "You go from zero security surface to a huge list of concerns all at once. You're suddenly needing OAuth, token management, CORS configuration, TLS, rate limiting and more" (Tun Shwe, BurJvbqFr4c); "20 out of 22 requests failed with just 20 simultaneous connections" (stdio load test cited).
- Classification: validated. Cross-ref: A-P3 (gateway = remote-deployment answer), A-P9.

### D-P9. Long-Lived Shared Credentials Anti-Pattern (Confused Deputy) (NEW)
- Problem: MCP servers configured with API keys in config/env: long-lived, unscoped, rarely rotated, shared across systems, unverified by server, or passed straight through to upstream APIs.
- Pattern: recognize key-pass-through as a confused-deputy vulnerability (malicious client obtains authorization without user consent); a single shared credential serves many users, is harder to revoke per user, one leak compromises everyone. >50% of MCP servers still use this pattern.
- Evidence: "the key is simply passed through to the API, creating a confused deputy vulnerability, where malicious clients obtain authorization without the proper user consent" (Jeremy Frenay, BurJvbqFr4c).
- Classification: established (widespread, documented). Cross-ref: A-P4 (gateway-held OAuth as the fix), D-P10, D-P12.

### D-P10. DCR Limits and CIMD (URL-Bound Client Identity) (NEW)
- Problem: static pre-registration breaks for MCP (unbounded clients x unbounded servers); dynamic client registration (DCR) is uncredentialed - registrations not portable across devices, phishing-prone, metadata self-asserted.
- Pattern: prefer CIMD (Client ID Metadata Document; preferred approach since Nov 2025): client owner exposes client ID metadata at a public URL; proving control of the URL is meaningful proof of identity; redirect URIs bound in metadata block malicious callbacks; authz server selectively allows/denies clients.
- Evidence: "Proving that you control https://cloud.ai is meaningful, unlike proving that you can post on the registration endpoint" (Jeremy Frenay, BurJvbqFr4c); "DCR is vulnerable to phishing attacks because it doesn't provide a reliable way to verify client identities".
- Classification: established (CIMD preferred since Nov 2025). Cross-ref: D-P14 (URLs-in-PKI, same direction), D-P12.

### D-P11. Token Exchange for Least-Privilege Chain of Custody (RFC 8693) (NEW)
- Problem: the MCP connection is only the first leg; what an MCP server does downstream (in-domain or cross-domain API calls) is unspecified security-wise.
- Pattern: MCP server acts as OAuth client to its own resource servers: exchange the user delegation token for a scoped session token (RFC 8693); cross-domain via identity assertion grant / identity chaining; least privilege per hop.
- Evidence: "our MCP server now is actually a OAuth client for a new resource server, our API, but it's using the exact same authorization server in order to get a token" (Jeremy Frenay, BurJvbqFr4c); corroborated: "there's a technique called OOTH token exchange that I recommend everyone look into... identity assertion grant which lets us do cross domain authorization" (Jared Hanson, blmAkayzE8M).
- Classification: emerging (specs exist, adoption thin). Cross-ref: A-P4, D-P15, A-P15.

### D-P12. Static Secrets to Dynamic Scoped Access (Short-Lived Tokens + Refresh) (NEW)
- Problem: pasting long-lived broadly-scoped API keys into configs/env for hundreds of agents is an unbounded security problem.
- Pattern: move from static secrets to OAuth dynamic access; short-lived access tokens rotated via refresh tokens keep the authorized connection alive without long-lived secrets; scope access per delegation.
- Evidence: "we know how to fix this. We know how to transition away from static secrets to dynamic access using OOTH" (Jared Hanson, blmAkayzE8M); "refresh tokens which basically allows these access tokens to be shortlived and rotated pretty quickly while still maintaining the authorized connection".
- Classification: established (OAuth standard). Cross-ref: A-P4 (gateway-held OAuth), D-P9 (the anti-pattern replaced).

### D-P13. Keep the Authorization Server a Separate Entity (Resource-Server Separation) (REFINEMENT of A-P3)
- Problem: early MCP authz spec collapsed the OAuth server role into the MCP server (client = OAuth client, server = all of OAuth incl. token issuance), breaking the 3-role OAuth model; "MCP authorization spec is a mess for the enterprise" (Christian Posta) + ~400-comment spec PR.
- Pattern: model the MCP server as an OAuth resource server only; authz server is a totally separate entity; server's only job is verifying tokens over HTTP, all other responsibility handed off.
- Evidence: "the OOTH authorization server is a totally separate entity... All you have to do is verify the tokens that come in over HTTP and hand off all the other responsibility to the OA server" (Jared Hanson, blmAkayzE8M).
- Classification: validated (draft spec now models it cleanly). Cross-ref: strengthens A-P3 (Centralized Agent Gateway) with role-separation rationale + failed-attempt history; D-P10, D-P11.

### D-P14. Agent Identity via URLs in PKI + Attestation (NEW)
- Problem: DCR makes all agents anonymous (registration uncredentialed); traditional client ID/secret friction does not fit MCP; users need awareness of which LLM/device receives their data.
- Pattern: reuse existing identifiers: URLs in PKI as client identity (agent.com), agents sign JWT assertions / HTTP message signatures verified against public keys; add remote attestation (IETF) of device/software state to know what LLM data flows into, feeding OAuth authorization flows.
- Evidence: "we should start looking at using URLs in PKI for identity... authenticate these agents by having them sign JWT assertions or HTTP message signatures that we can then verify with the corresponding public keys" (Jared Hanson, blmAkayzE8M).
- Classification: emerging. Cross-ref: D-P10 (CIMD, same direction different mechanism), D-P12.

### D-P15. Transactional Authorization (RAR) for Agent Actions (NEW)
- Problem: OAuth scopes are too coarse (read vs write) and too long-lived for agents performing financial/commercial transactions.
- Pattern: authorize per transaction with specific parameters (amounts, budgets) via rich authorization requests (RAR); move to dynamic access as agent actions become transactional.
- Evidence: "scopes... a little bit too coarse grained... authorize things on a transaction basis potentially with specific amounts or financial budgets... rich authorization requests" (Jared Hanson, blmAkayzE8M).
- Classification: emerging. Cross-ref: A-P8 (human confirmation gate - complement: consent at transaction time), B-P14.

### D-P16. Enterprise Agent Governance: Tool-Level RBAC + Data Masking + Full-Request Trace (NEW)
- Problem: compliance (EU AI Act) expects transparency for autonomous systems; agents should never see data they have no business handling; unobservable agents cannot be governed.
- Pattern: beyond OAuth scopes: RBAC scoped to individual tool/resource, data masking of PII before the agent sees it, interaction audit logs (which agent called which tool with what params, what data returned), end-to-end request observability.
- Evidence: "agents should never be exposed to data that they have no business handling" (Jeremy Frenay, BurJvbqFr4c); "If you cannot trace what an agent did end to end, you cannot govern it. Tracing for agent AI follows the same principles as distributed system observability".
- Classification: emerging (enterprise practice). Cross-ref: A-P15 (distributed tracing), C-P18, D-P7.

### D-P17. Steinberger's Law: Harness Convergence (Every Harness Becomes a Claw) (NEW)
- Problem: harnesses proliferate as distinct products (local, cloud, open-source frameworks) with a growing feature gap; users want claw features but with power and control.
- Pattern: harnesses ascend an agentic spectrum (LLM -> agent -> harness -> claw) and expand until they absorb claw capabilities (initiative + learning + always-on); design harness features for that trajectory (technological + economic + psychological drivers).
- Evidence: "I believe every harness will expand until it becomes a claw" (Sam Bhagwat, Mastra, 8qWIPUia2O8).
- Classification: emerging (prediction grounded in 18 months production observation + OpenClaw/Hermes feature study). Cross-ref: A-P11 (harness as abstraction layer), B-P25.

### D-P18. Claw Infrastructure: Heartbeat, Feed Services, Daemon/Gateway, Continual Learning (NEW)
- Problem: a local interactive harness stops when the human stops; agents cannot act on external events or self-improve.
- Pattern: claw = harness + initiative + learning: listens to external feed services, heartbeat (wakes every defined interval), channels (Slack/WhatsApp/Telegram), persistent memory, daemon + gateway for inbound/outbound requests, continual learning from its own traces (auto skill generation; modifying driving code - mechanism unsettled).
- Evidence: "the agent is listening to external feed services. It has a heartbeat which means it wakes up every you know defined amount of time and does something" (Sam Bhagwat, 8qWIPUia2O8).
- Classification: validated (shipping in OpenClaw/Hermes; Mastra building them). Cross-ref: A-P9 (cloud sandboxes host always-on runtime), A-P3 (gateway), C-P18 (traces feed learning).

### D-P19. Durability/Doggedness as a Harness Quality + Always-On Cloud Shift (NEW)
- Problem: agents crash/disconnect mid-turn; single-machine parallelism caps fan-out; local git-worktree output does not fit async collaboration.
- Pattern: durability qualities (run hours/days: persisted streams/resume, planning mode, parallel subagents, autocompaction, persisted threads, steer/interrupt); shift to always-on cloud harness (Slack/mobile channels, cloud sandboxes for parallelism, output as PR to GitHub).
- Evidence: "durability just the sheer quality of being able to run not for minutes but for hours or days" (Sam Bhagwat, 8qWIPUia2O8).
- Classification: emerging. Cross-ref: B-P4 (loop recovery), B-P6 (parallelism), C-P19 (session state), A-P9.

### D-P20. Session-Scoped Tool Approval (REFINEMENT of A-P8)
- Problem: per-call approval theater slows long sessions; blanket never-approve blocks useful tool use.
- Pattern: approve tool classes/commands for the session (all rm -rf instances in this session) after the first call, trading blast radius for flow; user stays in control without per-call friction. Caveat: "the first one will probably wipe your machine".
- Evidence: "session long tool approval. So it's not just like yeah I approved this specific tool call but yeah you can run all instances of rmrf for slash right that you see in the session" (Sam Bhagwat, 8qWIPUia2O8).
- Classification: validated (Claude Code/Codex UX). Cross-ref: strengthens A-P8 (Human Confirmation Gate) - approval granularity is a session-level knob, not only per-action.

### D-P21. Harness Ecosystem Shakeout (Winner-Take-Few) (NEW)
- Problem: claw/harness products multiply; users can only hold a limited number of high-frequency or high-value tools in mind.
- Pattern: expect category consolidation (mobile-platform analogy: 1-2 winners per category); a harness must be very economically valuable or very frequent or it gets dropped; build capabilities users need or they switch (rate of change 3-4x).
- Evidence: "there will be this very real shakeout and these categories will kind of emerge and we'll realize that we only have space in our lives for so many of these claws" (Sam Bhagwat, 8qWIPUia2O8).
- Classification: emerging (market prediction). Cross-ref: D-P17 (convergence driver), A-P11.

## Per-transcript coverage
- Tun Shwe / Jeremy Frenay (BurJvbqFr4c): RICHEST - D-P1..D-P11, D-P16. Five-principle secure-design list, OWASP MCP top-10 grounding, stdio-vs-HTTP security cliff, DCR vs CIMD mechanics, token exchange, enterprise governance. Speaker split determinable (Tun = design principles, Jeremy = OAuth flows; "I'm going to hand it over to Jeremy to continue").
- Jared Hanson (blmAkayzE8M): RICH - D-P11..D-P15. OAuth survey: 3-role model, spec history (NOAUTH -> messy first attempt -> clean draft), refresh rotation, client-credentials agent-to-agent, URL-PKI identity, attestation, RAR, chain of custody, async consent. Thin on harness runtime; security-horizon talk.
- Sam Bhagwat (8qWIPUia2O8): MEDIUM for tools/permissions (only D-P20), RICH for harness ecosystem (D-P17..D-P19, D-P21): agentic spectrum, claw feature set, always-on cloud shift, iOS/Android shakeout analogy. ~40% of talk is market/consumer-behavior analysis (dopamine casino, brain-space) - light on mechanics; flagged.

## Coverage gaps (for consolidation)
- Transport-level MCP security (TLS, CORS specifics) named but not deep-dived in any of the 3 transcripts.
- Least-privilege at sandbox/credential-mount level (env vars, secret injection into sandboxes) still thin.
- Agent-to-agent auth deployment: "I don't know how much of this is happening in practice today" (Jared Hanson) - pattern exists, deployment evidence absent.
- OAuth refresh-token rotation failures/edge cases not covered.
- Claw continual-learning mechanisms unsettled ("we haven't figured out what the right way of doing it is yet" - Sam Bhagwat).
- Data masking implementation specifics (techniques/formats) not covered - named as requirement only.
- Async out-of-band consent (agents reaching users via SMS/push) raised by Jared Hanson but not extracted as a pattern (thin evidence).

## Cached sources
- mem:cache/youtube-videos/ai-engineer/your-insecure-mcp-server-won-t-survive-production-tun-shwe-l_BurJvbqFr4c
- mem:cache/youtube-videos/ai-engineer/how-to-secure-agents-using-oauth-jared-hanson-keycard-passke_blmAkayzE8M
- mem:cache/youtube-videos/ai-engineer/every-harness-will-become-a-claw-sam-bhagwat-mastra_8qWIPUia2O8
- mem:researches/harness-patterns-tools-permissions-security (cluster A)
- Taxonomy: mem:researches/agentic-patterns-context-memory-patterns