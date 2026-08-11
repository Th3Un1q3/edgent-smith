# Harness Engineering Patterns — Agent Loop, Context Management & Coding-Agent Harnesses

Cluster B of MINED-TRANSCRIPT mining: @aiDotEngineer channel. Extracted from 5 cached verbatim transcripts (auto-captions; whitespace cleaned, words verbatim). Taxonomy cross-ref: `mem:researches/agentic-patterns-context-memory-patterns`. Catalog: `mem:researches/youtube-ai-engineer-catalog`.

## Cached sources (all quoted below)
- `mem:cache/youtube-videos/ai-engineer/building-pi-in-a-world-of-slop_RjfbvDXpFls` (PI)
- `mem:cache/youtube-videos/ai-engineer/why-agent-engineering_5N33E9tC400` (WHY-AE)
- `mem:cache/youtube-videos/ai-engineer/ai-engineer-worlds-fair-2025-day-2-keynotes-swe-agents-track_U-fMsbY-kHY` (WF2025)
- `mem:cache/youtube-videos/ai-engineer/aie-europe-keynotes-coding-agents-ft-pi-google-deepmind-anth__zdroS0Hc74` (AIE-EU)
- `mem:cache/youtube-videos/ai-engineer/ai-engineer-worlds-fair-2024-keynotes-codegen-track_5zE2sMka620` (WF2024)

Speakers determinable from transcripts: Mario Zechner (PI, both talks), swyx (WHY-AE), Scott Wu/Devon (WF2025), Rustin Banks/Google Jules (WF2025), GitHub Copilot coding-agent speaker (WF2025), Eno Reyes/Factory (WF2025), Josh Albrecht/Imbue Sculptor (WF2025), Morgante/Grit (WF2024), Quinn/Sourcegraph (WF2024), Gajan Patel/Balter (WF2024), Ido Salamon/AgentCraft (AIE-EU), Alex/Tavon AI (AIE-EU), Sarah Chang/Cerebrus (AIE-EU), Richmond/Bit.ly (AIE-EU), Ben/Hugging Face (AIE-EU), Christina+Armen/Arendelle (AIE-EU).

## A. AGENT LOOP CONTROL

### P1. While-Loop Core + Tool Calling Is the Whole Harness
- **Problem**: Vendors ship feature-heavy agent frameworks; the essence of an agent runtime is lost in the UI.
- **Pattern**: Keep the agent core to a while loop that calls tools until done; everything else (UI, providers, extensions) wraps that core. Best-evidenced in a production agent built deliberately small.
- **Evidence**: Mario Zechner (PI): "an agent core, uh which is just a while loop and the tool calling"; "an agent is actually just an LLM agent that runs tools in a loop" (Alex, Tavon AI). Sources: PI, AIE-EU.
- **Classification**: validated
- **Cross-ref**: Session-Scoped Context Runtime; Tool Search Lazy Loading.

### P2. Dont Get One-Shotted — Iterate Instead (Ask-Explore-Then-Do)
- **Problem**: One giant prompt + one-shot generation is a learned bad habit that scales badly as models get faster.
- **Pattern**: Two-stage workflow: (1) an exploration pass — ask questions, explore the codebase with the agent, form understanding; (2) then let the agent execute.
- **Evidence**: Scott Wu/Devon (WF2025): "the first thing that you would do is you would ask a few questions... explore the codebase with your agent, figure out what has to be done in the task, and then set your agent off to go do that"; Sarah Chang/Cerebrus (AIE-EU): "we do things like write massive prompts and try to oneshot." Sources: WF2025, AIE-EU.
- **Classification**: established
- **Cross-ref**: Dynamic Context Injection; iterative refinement over single-shot.

### P3. Explicit Termination Condition (Dont-Stop-Until)
- **Problem**: Background/async agents need a definition of done; otherwise they drift or over-run.
- **Pattern**: Give the agent an explicit success contract: a testable condition it must reach, agreed before launch. Also define how the user will verify the result.
- **Evidence**: Rustin Banks/Google Jules (WF2025): "the secret to working in parallel is a clear definition of success... Create this agreement with the agent. Tell it, don't stop until you see this or don't stop until the number is X." Source: WF2025.
- **Classification**: established
- **Cross-ref**: Working Memory via TodoWrite; verified-completion loops.

### P4. Loop-Failure Detection & Context-Pollution Recovery
- **Problem**: Agents fixate on one error and loop forever, re-polluting context with wrong state until the run is useless.
- **Pattern**: Detect loops (same error retried with different techniques), roll back to a known-good checkpoint, continue from there instead of thrashing.
- **Evidence**: Morgante/Grit (WF2024): "it hits an error that gets into a loop and it's constantly trying to fix the same error it uses five different techniques then goes back and your context window's completely polluted with the wrong state"; "we want to go back to a known good checkpoint and then build from there." Source: WF2024.
- **Classification**: established
- **Cross-ref**: Context Window Auto-Compaction; Filesystem-Based Agent State (checkpoints).

### P5. Compile-Then-Fix Inner Loop as the Reliability Backbone
- **Problem**: Model output must be verified mechanically; eyeballing is insufficient even for experts.
- **Pattern**: Minimal reliable flow: prompt -> generate -> build/type-check -> feed errors back -> fix, iterated. Slow builds are the loop bottleneck, so in-memory incremental re-checking (LSP-style) matters.
- **Evidence**: Morgante/Grit (WF2024): "this basic flow of prompt get some code uh build it type check it and then fix that output based on the LLM... this is probably half of what you need to do to build a really good agent"; "10 minutes to build the application... this basically destroys our entire agentic flow." Source: WF2024.
- **Classification**: validated
- **Cross-ref**: Curated Code/File Context Window (compiler feedback as curated context).

### P6. Sandbox-Powered Mass Retry & Parallelism
- **Problem**: Individual agent runs fail often; waiting serially wastes time.
- **Pattern**: If sandboxing is safe enough, run many attempts/agents in parallel from a known-good state and take the first success (best-of-n at scale).
- **Evidence**: Josh Albrecht/Imbue (WF2025): "even just try multiple times, try a hundred times with a different agent, it actually ends up like working out quite well. And one of the things that enables this is having really good sandboxing"; Morgante/Grit (WF2024): "six up to 10 different agents working in parallel all working from a known good state." Sources: WF2025, WF2024.
- **Classification**: emerging
- **Cross-ref**: Context Budget as a Governed Resource (cost ceilings on parallel runs).

### P7. Inner Loop vs Outer Loop Separation
- **Problem**: Coding harnesses conflate development and review loops, hiding where humans must intervene.
- **Pattern**: Treat the dev loop (agent edits/iterates) and review loop (CI/human verification) as separate harness surfaces with separate controls.
- **Evidence**: (WF2025): "software development currently and has always had two loops. The inner loop which is focused on development and the outer loop that's focused on review"; Gajan Patel/Balter ghost-pilot (WF2024): "fourth step is fixing them and after fix proposing a fix not fixing them proposing a fix for human to review." Sources: WF2025, WF2024.
- **Classification**: established
- **Cross-ref**: Proactive Agent State Externalization (PR as state artifact).

## B. CONTEXT ENGINEERING

### P8. The Harness Owns the Context (Control Surface, Not Just Transport)
- **Problem**: When a closed harness silently mutates system prompt/tool definitions, the user loses control of agent behavior.
- **Pattern**: Context is the control surface: what the harness injects/removes (system prompt, tool defs, reminders, pruning) IS behavior control. Openness and control over those mutations is a core harness feature.
- **Evidence**: Mario Zechner (PI): "The real problem is that my context wasn't my context. Cloud code is the thing that controls my context... you have the system prompt which changes on every release, including the tool definitions." Source: PI (both talks).
- **Classification**: validated
- **Cross-ref**: Context Budget as a Governed Resource; Prompt Caching via Exact Prefix Preservation (stable system prompt).

### P9. System-Prompt Minimalism — Models Are Post-Trained on Harnesses
- **Problem**: Long system prompts waste tokens and fight what the model already learned during RL post-training.
- **Pattern**: Write minimal system prompts; the model already knows coding-agent behavior from training. The whole pi system prompt fits on a slide as a joke.
- **Evidence**: Mario Zechner (PI): "models are actually reinforcement trained up the wazoo... they know what a coding agent is because a coding agent harness is basically what they're being trained when they are post-trained. You don't need 10,000 tokens to tell them you're a coding agent"; "Here's Pie's system prompt. [laughter] That's it." Source: PI, AIE-EU.
- **Classification**: validated
- **Cross-ref**: Prompt Caching via Exact Prefix Preservation; Context-Minimization Pattern.

### P10. Tool-Result Pruning Can Lobotomize — Prune with Care
- **Problem**: Aggressive auto-truncation of tool outputs past a token floor removes signal the model needs.
- **Pattern**: Truncation/pruning is a context-budget lever but must be deliberate and inspectable; naive minimum-token pruning breaks workflows.
- **Evidence**: Mario Zechner (PI): "given some conditions, open code would just uh prune tool outputs after a specific minimum amount of tokens and that basically lobotomizes the model." Source: PI (both talks).
- **Classification**: emerging (counter-pattern to auto-compaction)
- **Cross-ref**: Context Window Auto-Compaction; Context Budget as Governed Resource.

### P11. Progressive Discovery — Tools Loaded On Demand
- **Problem**: Hundreds of MCP tools in context burn tokens and confuse routing.
- **Pattern**: Give the model a tool-loading tool; it discovers and loads needed tool definitions on demand, massively cutting standing tool context (Claude Code before/after).
- **Evidence**: MCP/Anthropic speaker (AIE-EU): "you give the model a tool loading tool basically and the model goes like ah maybe I need a tool now and let me look up what tools I need and then you load them on demand... you see a massive reduction in tool use tool context usage." Source: AIE-EU.
- **Classification**: validated
- **Cross-ref**: Tool Search Lazy Loading (MCP); Curated Code/File Context Window.

### P12. More Context Is Better (Jules) vs Long Context Is a Hack (pi)
- **Problem**: Competing theses on context volume — both appear in this cluster.
- **Pattern**: Async coding agents tolerate throw-everything-in (models sort relevance); power-user harness builders argue 1M-token windows are a hack that does not fix retrieval/compaction design. Resolve by role: exploration-time abundance, execution-time budget.
- **Evidence**: Rustin Banks/Google Jules (WF2025): "just throw everything in there. Jules and other agents are pretty good at actually sorting out which context is important. So more context is better at this point"; Mario Zechner (PI): "long context windows are a hack, as most of you will find out this year as everybody's switching to 1 million tokens context windows." Sources: WF2025, PI.
- **Classification**: established (open tension)
- **Cross-ref**: Context Budget as a Governed Resource; Semantic Context Filtering.

### P13. Intent Is Context: Specs-as-Code and Prompt Preservation
- **Problem**: Vibe-coding deletes the prompt (intent) and version-controls only the code (the binary) — losing the agents operating context.
- **Pattern**: Capture intent/values in written specs; specs encode success criteria and double as eval material. Instruction files (AGENTS.md/CLAUDE.md style) are the harness persistent context layer.
- **Evidence**: (WF2025 spec talk): "we keep the generated code and we delete the prompt. And this feels like a little bit like you shred the source and then you very carefully version control the binary"; Alex/Tavon (AIE-EU): "one agent per customer and that agent has a general harness... AGENTS.md." Sources: WF2025, AIE-EU.
- **Classification**: emerging
- **Cross-ref**: Layered Configuration Context (CLAUDE.md); Episodic Memory Retrieval & Injection.

### P14. Human Judgment Gates on Context-Sensitive Changes
- **Problem**: Some changes (migrations, permissioning) depend on production knowledge the agent lacks; auto-applying them is dangerous.
- **Pattern**: Define a class of changes where the human must reactivate: propose, dont apply. Harness encodes these as explicit gates.
- **Evidence**: Arendelle (AIE-EU): "the kind of changes where the human's brain should reactivate... we don't think that the database migration should ever go in without the human making a judgment call... if there are permissioning changes, you better think about this." Source: AIE-EU.
- **Classification**: established
- **Cross-ref**: Working Memory via TodoWrite (blockedBy states); human-in-the-loop gates.

## C. CODING-AGENT HARNESS DESIGN

### P15. Terminal/Shell-Only Tool Surface Beats File Tools (TerminalBench)
- **Problem**: Rich file/sub-agent tooling is assumed necessary for good coding-agent performance.
- **Pattern**: The top benchmark harness gives the model only a keystroke/screen tool against a tmux session — no file tools, no sub-agents — and still tops leaderboards across model families. Minimal harness surfaces the models native capabilities.
- **Evidence**: Mario Zechner (PI): "all it gives the model is a tool to send keystrokes to a tmux session and read the output of that tmux session. There's no file tools, no sub-agents, none of that stuff. And it's one of the best performing harnesses in the leaderboard." Source: PI (both talks).
- **Classification**: validated
- **Cross-ref**: Tool Lazy-Loading; Curated Context — inverse: terminal-native tools over tool proliferation.

### P16. Harness vs Model: Judge by Cross-Model Leaderboard Deltas
- **Problem**: Determining whether gains come from the model or the harness.
- **Pattern**: Judge harness quality by leaderboard deltas across model families (same harness, many models). A terminal-native harness scoring above each models native harness isolates harness contribution.
- **Evidence**: Mario Zechner (PI): "irrespective of model family, Terminus scores higher, mostly high even higher than the native harness of that model. So, what does that tell us?" Source: PI.
- **Classification**: emerging
- **Cross-ref**: Eval-driven harness iteration.

### P17. LSP Feedback Into Tool Results Is a Counter-Pattern
- **Problem**: Injecting compiler errors into every edit result mirrors an unnatural human workflow (check-after-every-line) and confuses the model.
- **Pattern**: Feedback loops should match how people actually work: finish a unit of work, then surface errors. Batch/async error feedback beats per-edit injection.
- **Evidence**: Mario Zechner (PI): "every time your model is calling the edit tool, open code goes to the LSP server... asks are there any errors? And if so, injects that as part of the edit tool result. Which is bad, because think about how you are editing code. You're not writing a line of code, checking the errors." Source: PI (both talks).
- **Classification**: emerging (counter-pattern)
- **Cross-ref**: Compile-Then-Fix Inner Loop (P5) — tension between the two.

### P18. Rope-Not-Rails Permissioning (YOLO Security)
- **Problem**: Per-call approval dialogs (bash prompts) are theater, not security, and throttle flow.
- **Pattern**: Default-permissive harness with a pluggable security layer the user builds to fit their needs (so-much-rope), rather than fixed guardrails baked into the vendor harness.
- **Evidence**: Mario Zechner (PI): "pi is also yolo by default, because my security needs are different than yours. And I don't think a little dialogue that pops up every time you call bash, asking you to approve, is a smart security mechanism. So, instead, I give you so much rope." Source: PI (both talks).
- **Classification**: emerging
- **Cross-ref**: Permission systems as harness config; tool-scoped permissions (P19).

### P19. Least-Privilege Scoping by Default
- **Problem**: Agents with repo-wide/world access cause review bypass and security incidents.
- **Pattern**: Default-scope agents: read-only repo, no external network, single-repo permissions; escalate explicitly. Attribution must never bypass human review.
- **Evidence**: GitHub Copilot coding agent (WF2025): "that's the only place that coding agent is going to have right permissions to" plus "readonly access to your repository the default firewall preventing any external access review before merge"; Open Hands (WF2025): agent-owned PRs let the triggerer self-approve and "basically bypass our whole code review system." Source: WF2025.
- **Classification**: validated
- **Cross-ref**: Filesystem-Based Agent State; human-in-the-loop gates.

### P20. Hard Isolation vs Vibes-Based Prompt Scoping
- **Problem**: Enforcing agent boundaries by prompt (please-dont-leave-this-directory) is fragile; hard sandboxing is expensive (worktree creation, disk).
- **Pattern**: Two implementation tiers: enforced isolation (filesystem/container) and prompt-level scoping. Teams trade cost vs trust; evals + RL close the prompt-tier gap.
- **Evidence**: Cursor (AIE-EU): "we had to make sure that the agents were scoped and isolated and they could not escape the work tree they were working on"; "now we're trusting the model. So it's you could say it's a bit vibes based... please don't forget about this." Source: AIE-EU.
- **Classification**: emerging
- **Cross-ref**: Sandbox-cloud (fork/container) patterns; Context Budget.

### P21. Sub-Agent Decomposition with Parent Orchestration + Commentary
- **Problem**: Parallel model comparison/execution needs structure; naively spawning agents loses coordination and results assembly.
- **Pattern**: Parent agent spawns sub-agents (each with own worktree/context), waits for all, synthesizes comparison commentary. The parent accumulates context the user can interrogate and stitch results from.
- **Evidence**: Cursor (AIE-EU): "instructing the parent agent to go and create sub agents for each model and then spin up a work tree for each... wait for all the subagents. And when they're done, please provide some commentary"; "The parent now has a lot more context over what each of the sub agents did... ask the agent to stitch together a little different pieces and bits from the different implementations." Source: AIE-EU.
- **Classification**: emerging
- **Cross-ref**: Working Memory via TodoWrite; task-delegation patterns.

### P22. Edit-Format Economics: Whole-File Output Costs 3-15x
- **Problem**: Models output ~4K tokens while contexts reach 1-2M; regenerating whole files per edit is the naive default and is expensive (3-15x) and token-wasteful (JSON escaping in function-call diffs).
- **Pattern**: Invest in a compact edit format (search-replace/structured diff) over full-file or JSON-escaped function calls to keep the loop cheap.
- **Evidence**: Morgante/Grit (WF2024): "models out there that have 1.5 million tokens 2 million tokens in their context window and still only outputting 4,000 tokens at a time... you really don't want to output entire large files as you're making edits"; "function calls are... Json escaping code in Json format is terrible you end up using a lot of tokens just for escape characters." Source: WF2024.
- **Classification**: established
- **Cross-ref**: Context Budget as Governed Resource; tool-result handling.

### P23. Manual-First Disclosure: Explicit Context Invocation Before Magic
- **Problem**: Auto-injected context (magic) erodes trust and surprises users.
- **Pattern**: Ship manual/explicit mode first — user at-mentions the context they want — then automate; agent edits must be fixable in the editor UI the dev already lives in.
- **Evidence**: Quinn/Sourcegraph (WF2024): "first you got to make something work in manual and explicit mode... make it so people manually at mention the context they want before magically inserting the context... if you've got an agent put it in the editor and make it work in the editor so that if it's wrong the dev can just change it right in their editor." Source: WF2024.
- **Classification**: established
- **Cross-ref**: Progressive Disclosure for Large Files; Curated Code/File Context Window.

### P24. Observability as a Harness Feature
- **Problem**: Users need to see what agents are doing; opaque harnesses block trust and debugging.
- **Pattern**: Expose agent state as inspectable surfaces (terminal mirror, snapshot-as-git-log, per-session JSON, dashboards, daemon+control-plane lifecycle monitoring). Zero-observability tools are a stated reason to switch harnesses.
- **Evidence**: Mario Zechner (PI): "there's zero observability because that's how the tool is constructed and I like knowing what my agents are doing"; DockerCon talk (WF2025): "every snapshot of the state is like a git log"; Richmond/Bit.ly (AIE-EU): daemons "monitor lifecycle of the agent when things change it's blocked it needs your help it communicates up to the control plane." Sources: PI, WF2025, AIE-EU.
- **Classification**: validated
- **Cross-ref**: Proactive Agent State Externalization.

## D. MINIMAL VS FEATURE-HEAVY & DISCIPLINE

### P25. Self-Modifying Harness: The Agent Writes Its Own Tools
- **Problem**: Fixed tool sets cant adapt to user workflow; extensibility via hooks is shallow and spawns processes per trigger.
- **Pattern**: Ship docs + code examples of extensions as harness context, let the agent write new extensions (TypeScript modules) that hot-reload — the harness modifies itself per workflow. Custom compaction, providers, and full tool control as extension points.
- **Evidence**: Mario Zechner (PI): "all we need to do for the agent to modify itself is tell it, here's the documentation. Here's some code that shows you how to modify yourself by writing extensions"; "second thesis is... self-modifying malleable agents"; "You can do custom compaction, custom providers, and you have full control over the tools." Source: PI (both talks).
- **Classification**: emerging
- **Cross-ref**: Skills-as-file-based-context; Tool Lazy-Loading.

### P26. Everything Plus Agent Works (Composition Thesis)
- **Problem**: Teams debate whether agents replace RAG/search/other systems.
- **Pattern**: Agents compose with existing paradigms (RAG, search, etc.) rather than replace them; harness engineering is the discipline that makes composition reliable.
- **Evidence**: swyx (WHY-AE): "everything plus agent works... agent plus rag works, agent plus search works... this is kind of like the simple formula for like making money in 2025." Source: WHY-AE.
- **Classification**: established
- **Cross-ref**: Semantic Context Filtering; Dynamic Context Injection.

### P27. Linting and Code Conventions as Harness Constraints
- **Problem**: Agents add fuzz (state pollution, broad catches, scattered queries) between loop steps; reviewing all of it is unsustainable.
- **Pattern**: Encode guardrails as lint rules and single-interface conventions (one query interface, no bare catches) so the harness mechanically constrains agent output; also improves token efficiency by making retrieval single-shot.
- **Evidence**: Arendelle (AIE-EU): "between these points, between these steps. That's where the agent tends to add the most fuzz"; "most of these we actually achieve with linting rules. So the main example would be no bare catch holes"; "if it only gets one output, it's going to be much better at continuing with the loop." Source: AIE-EU.
- **Classification**: emerging
- **Cross-ref**: Compile-Then-Fix Inner Loop; Curated Context.

## Coverage notes
- Strong harness-specific sources: PI (minimal harness, while-loop core, YOLO security, TerminalBench, compaction, self-modifying, context ownership) and AIE-EU coding track (progressive discovery, Cursor worktrees, parent/sub-agent, lint-as-harness, one-shot anti-pattern, command-and-control observability).
- WHY-AE (swyx) is a conference framing talk — thin on harness mechanics beyond the everything-plus-agent thesis and agent definitions (goals/tools/control-flow/long-running/delegated-authority); treat as context, not pattern source.
- WF2025: rich in loop/context/tooling patterns (Devon ask-explore-do, Jules termination conditions + more-context, Copilot coding-agent least-privilege, Sculptor plan-gate, Factory context-is-everything, spec-as-context). No Dont-Get-One-Shotted talk exists in the cached WF2025 transcript (verified by phrase search); the evals closer is the Artificial Analysis benchmark talk (model/API latency, reasoning-token cost) — relevant to P22 token-budget economics.
- WF2024 (June 2024) predates mature coding agents; harness content is early-stage but strong: Grit loop-failure/checkpoint/parallel-agents, Sourcegraph manual-first disclosure, ghost-pilot CI loop, SQL-as-tool interface, edit-format economics.
- The stateless-LLM-to-better-tokens thesis appears in this cluster only as pi's RL-post-training point (P9) and MCP stateless transport (transport, not agent loop); a full stateless-loop treatment is not present in these 5 transcripts.
- Gaps for consolidation phase: (1) compaction/summarization mechanics (pi mentions custom compaction + added compaction for OpenClaw; details live in `mem:researches/agentic-patterns-context-memory-patterns` Clawdbot); (2) MCP security/permissions deep-dive (blocked `mem:cache/...` BurJvbqFr4c); (3) observability deep-dive (blocked -aM2EDTiaMs); (4) loop-first-principles talks (blocked xIt_mTQp6mY, c35YoMdnI78); (5) Claude Code internals (blocked Lue8K2jqfKk / RFKCzGlAU6Q); (6) agent memory architecture (blocked W2HVdB4Jbjs).