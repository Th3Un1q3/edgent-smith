# Harness Engineering Patterns — Agent Loop, Context Engineering & Coding-Harness Internals (Run 6)

Cluster E of MINED-TRANSCRIPT mining: @aiDotEngineer channel. Mined from 5 NEW cached verbatim transcripts (run 6; auto-captions, whitespace cleaned, words verbatim).
Extends `mem:researches/harness-patterns-loop-context-coding` (cluster-B checkpoint, 5 prior transcripts). Catalog: `mem:researches/youtube-ai-engineer-catalog` (run-6 section).
Taxonomy cross-ref: `mem:researches/agentic-patterns-context-memory-patterns`.

## Cached sources (all quoted below)
- `mem:cache/youtube-videos/ai-engineer/no-vibes-allowed-solving-hard-problems-in-complex-codebases-_rmvDxxNubIg` (DEX — No Vibes Allowed, Dex Horthy, HumanLayer, 23.6K)
- `mem:cache/youtube-videos/ai-engineer/claude-code-the-evolution-of-agentic-coding-boris-cherny_Lue8K2jqfKk` (BORIS — Claude Code evolution, Boris Cherny, Anthropic, 18.1K)
- `mem:cache/youtube-videos/ai-engineer/how-claude-code-works-jared-zoneraich-promptlayer_RFKCzGlAU6Q` (JARED — How Claude Code Works, Jared Zoneraich, PromptLayer, 62K)
- `mem:cache/youtube-videos/ai-engineer/loop-engineering-from-first-principles-kyle-mistele-humanlay_xIt_mTQp6mY` (KYLE — Loop Engineering from First Principles, Kyle Mistele, HumanLayer, 18.4K)
- `mem:cache/youtube-videos/ai-engineer/your-agent-didn-t-fail-your-harness-did-vinoth-govindarajan_BInpv7lGp1o` (HARNESS-DEBUG — Your Agent Didn't Fail. Your Harness Did., 14.5K)

## Speaker attribution notes
- DEX/BORIS/JARED/KYLE: self-identified in-transcript (Dex; Boris: 'my name is Boris... creator of Quad Code'; Jared: 'I'm Jared, Jared Z on X'; Kyle: 'my name is Kyle').
- HARNESS-DEBUG: caption self-identifies 'Hi, I'm Ben. I work on core data and AI... I'm [a builder of] OpenClaw' — catalog lists Vinoth Govindarajan (OpenAI). Quote attribution = video title only; name discrepancy flagged, not resolved.

## A. CONTEXT ENGINEERING

### P-A1. Smart-Zone Context Budget (avoid the dumb zone)
- **Problem**: Agents degrade as the context window fills; volume alone is not a strategy.
- **Pattern**: Budget the window explicitly: a ~168K-token window has a usable smart zone (roughly 90%) plus reserves for output and compaction; staying in the smart zone via compaction/sub-agents is a first-class loop activity.
- **Evidence**: >You have 168,000 tokens roughly. Some are reserved for output and compaction... cleverly avoiding the dumb zone / >just the more you use the context window, the worse outcomes you'll get (DEX); >when your context is full, the model gets stupid for lack of better words (JARED).
- **Classification**: validated | **Cross-ref**: P8 context ownership; P10 pruning | **Tag**: NEW

### P-A2. Intentional Compaction: compress → review → tag → fresh start
- **Problem**: Auto-compaction erases control; continuing a polluted conversation compounds errors.
- **Pattern**: On derailment or checkpoint, ask the agent to compress the context window into a markdown file; the human reviews and tags it; a NEW agent starts from that artifact and gets straight to work. Compaction is an explicit, human-reviewed artifact, not a silent truncation.
- **Evidence**: >take uh your existing context window and ask the agent to compress it down into a markdown file. You can review this, you can tag it, and then when the new agent starts, it gets straight to work (DEX).
- **Classification**: validated | **Cross-ref**: P4 loop-failure recovery; P-A8 | **Tag**: NEW

### P-A3. Stateless-LLM Thesis: better tokens in → better tokens out
- **Problem**: The LLM is stateless and non-pure; each loop turn re-reads the whole conversation, so garbage accumulates.
- **Pattern**: Treat every loop turn as a re-prompt over an engineered context. The harness's entire job is to assemble better tokens each iteration — correctness, completeness, size, plus a little trajectory. Fills the gap cluster-B flagged (stateless-loop treatment).
- **Evidence**: >they're not pure functions... stateless. And the only way to get better performance out of an LLM is to put better tokens in and then you get better tokens out (DEX).
- **Classification**: validated | **Cross-ref**: P8 context ownership; P-A5 | **Tag**: NEW

### P-A4. Context Content Curation: files/code-flow yes, UUID dumps no
- **Problem**: Raw tool output (JSON/UUID dumps, every MCP payload) bloats the window and drowns signal.
- **Pattern**: Curate what enters context: exact files and line numbers relevant to the problem, code flow understanding, build/test output — not identifier dumps. The harness decides what belongs, not the model.
- **Evidence**: >what takes up space in your context window. So... it's looking for files, it's understanding code flow / >UU ids into your context window, you know, God help you (DEX).
- **Classification**: emerging | **Cross-ref**: P10 pruning; P11 progressive discovery | **Tag**: NEW

### P-A5. Research-Plan-Implement: workflow phases as context phases
- **Problem**: One-shot prompting ignores that different stages of a task need different context shapes.
- **Pattern**: Three phases, each ending in compaction: research (compression of truth — explore, understand codebase), plan (compression of intent — exact steps + code snippets, human must read it), implement (reliable execution). Open-source prompts per phase; the whole workflow is built around keeping context small.
- **Evidence**: >research, plan, implement... you're constantly keeping your context window small. You're building your entire workflow around context management / >research is compressing truth... planning is about compression of intent / >there is no perfect prompt. You still will not work if you do not read the plan (DEX).
- **Classification**: validated | **Cross-ref**: P2 ask-explore-do; P13 specs-as-code | **Tag**: NEW

### P-A6. On-Demand Compressed Context (refines P11 progressive discovery)
- **Problem**: Pre-documenting a 5M-line monorepo burns the smart zone before work starts.
- **Pattern**: Do not stuff everything in; expose sub-context on demand — a research prompt, slash command, or skill launches sub-agents that compress just the needed area and pull it in when relevant.
- **Evidence**: >we prefer is on demand compressed context. So if I'm building a feature that relates to SCM providers and Jira and Linear, um, I would just give it a good research uh prompt or or slash command or skill (DEX).
- **Classification**: emerging | **Cross-ref**: P11; P21 sub-agents | **Tag**: REFINEMENT of P11 (progressive discovery → on-demand compressed context)

### P-A7. Context-First-Then-Think: pull tools into context before reasoning (refines P2)
- **Problem**: Agents that think up front waste tokens and produce ungrounded answers.
- **Pattern**: Have the agent use tools and pull things into context FIRST, then think. Up-front reasoning before context is usually wasted tokens.
- **Evidence**: >So have it use tools, have it pull things into context and then think. If it's thinking up front, you're probably just kind of wasting tokens (BORIS).
- **Classification**: established | **Cross-ref**: P2 ask-explore-do; P-A5 | **Tag**: REFINEMENT of P2

### P-A8. New-Thread-Over-Compaction at Capacity
- **Problem**: Auto-compaction is slow (minutes of waiting) and mid-drop summarization loses fidelity.
- **Pattern**: At capacity, prefer starting a fresh thread/context over waiting for compaction; when compaction runs, it drops the middle and summarizes (a lossy middle-out strategy). Operator choice, not silent default.
- **Evidence**: >when it reaches capacity it kind of drops the middle summarizes the [context] (JARED); >compact. It's the worst. You have to wait 10 [minutes]... start a new thread. That feels like the winning strategy to me (JARED).
- **Classification**: emerging | **Cross-ref**: P4; P-A2 | **Tag**: NEW

## B. AGENT LOOP

### P-B1. Master While-Loop: tool-calls → run → feed back → ask user (refines P1)
- **Problem**: DAG orchestration layers were the pre-2024 default; they break as models improve.
- **Pattern**: Everything (Claude Code, Codex, Cursor, AMP) is one while loop: while there are tool calls, run the tool, give results back to the model, repeat; when no tool calls remain, ask the user. The DAG era is over because loop+tool-calling now works directly.
- **Evidence**: >it's just one while loop with tool calls just running the master while loop calling the tools and going back to the master while loop. This is basically four lines (JARED); >everybody was building DAGs like this for the last two and a half years... works way better because our models are just good now (JARED); >give it tools and then get out of the way (JARED).
- **Classification**: validated | **Cross-ref**: P1; P26 | **Tag**: REFINEMENT of P1 (while-loop core — adds explicit termination: ask the user when tool calls end)

### P-B2. Control-Loop Architecture: sensor / setpoint / controller / actuator
- **Problem**: Agent loops that just pipe prompt→loop produce 40K-line PRs nobody reads; loops need a design theory.
- **Pattern**: Borrow control theory: sensor measures current state, set point defines desired state, measured error = difference, controller turns error into a control signal (an incremental change), actuator applies it; recompute. Applied to codebases: desired-state migrations, cleanups, root-out-bad-patterns loops.
- **Evidence**: >You have a sensor that measures the current state of the world. You have your set point... the difference between those two things is your measured error. You have a controller that reads that measured error and turns it into a control signal about an incremental change to apply to the system (KYLE).
- **Classification**: emerging | **Cross-ref**: P1; P3 termination; P5 compile-then-fix | **Tag**: NEW

### P-B3. Incremental Control vs Blind One-Shot (Ralph-loop counter-pattern)
- **Problem**: Non-incremental agent runs (all-at-once) risk blowing everything up and produce unreviewable output.
- **Pattern**: Control loops change a system incrementally; the best Ralph-style loops apply control theory; pure bash-loop Ralph loops are blind — they are not incremental.
- **Evidence**: >Control loops change a system incrementally instead of just trying to get straight to the end state immediately all at once and risk blowing everything up (KYLE); >we're still building 40,000-line PRs that just nobody wants to read (KYLE); >all Ralph loops are blind loops... they're not incremental right it's just a bash loop (KYLE).
- **Classification**: emerging | **Cross-ref**: P2; P7 inner/outer loop | **Tag**: NEW

### P-B4. Deterministic-First Loop Steps
- **Problem**: Agents applied to deterministic work (find-all-matches, sort, count) are slow, expensive, non-reproducible.
- **Pattern**: Sense and verify deterministically (ast-grep/GitHub Actions/lint), reserve the agent for genuinely non-deterministic decisions (which change to apply, how to rewrite). Never send an agent to do deterministic code's job; blur lines only where sensing is genuinely open-ended.
- **Evidence**: >you should never send an agent to do deterministic code's job (KYLE); >we're going to use ast-grep because it's really powerful... It's language agnostic. It's out of band from your TypeScript config or ESLint rules (KYLE).
- **Classification**: emerging | **Cross-ref**: P5; P27 lint-as-harness | **Tag**: NEW

### P-B5. PR-as-Loop-Artifact + Label-Based Loop Dedup
- **Problem**: Multiple scheduled loops stack PRs, duplicate work, conflict, and overwhelm review.
- **Pattern**: Each loop run emits a PR tagged with the loop's label; before running, check whether a PR with that label is already open — if so, shut down. One open PR per loop at a time; no stacking, no duplication. Also watch loop friction: constant skill updates/manual checkouts kill loops.
- **Evidence**: >each loop and its workflow has a label that gets attached to PRs... check and see if... any PR with the loop's label on it is open. And if so, we just shut down... No stacking, no duplication (KYLE); >we had to constantly update the skill... And our loop was actually really high friction (KYLE).
- **Classification**: emerging | **Cross-ref**: P7 outer loop; P24 observability | **Tag**: NEW

### P-B6. Human-on-the-Loop Resteering (/iterate comment trigger)
- **Problem**: Full automation removes human steering; paging humans per iteration is high friction.
- **Pattern**: Keep the loop autonomous but resteerable: a /iterate comment on the loop's PR triggers the workflow, which loads PR context + feedback file into the agent's context and instructs fix + feedback update. Low-friction human-on-the-loop, not human-in-the-loop.
- **Evidence**: >put a human on the loop in a really low friction way to resteer it when it goes wrong... when a user leaves a slashiterate comment on the PR, uh the loop workflow is going to pick that up (KYLE).
- **Classification**: emerging | **Cross-ref**: P14 human gates; P7 | **Tag**: NEW

### P-B7. Harness-Failure Attribution: most production agent failures are harness failures
- **Problem**: Postmortems blame the model/prompt when the harness (state, ordering, lifecycle, authority, proof) failed.
- **Pattern**: Treat agent reliability as harness reliability: context assembly, state transitions, tool gating, ordering and receipts are where production failures live. Before blaming the model, audit the harness boundaries.
- **Evidence**: >most of the agent failures are not model failures. Those are harness failures (HARNESS-DEBUG); >The agent... did not need a better model. The model did not need a better prompt. The system needed a better harness with complete receipt (HARNESS-DEBUG).
- **Classification**: validated | **Cross-ref**: P16 harness-vs-model | **Tag**: NEW

### P-B8. Ordered Commit Path: one ordered commit path per mutable state boundary
- **Problem**: Overlapping writers (load-modify-save races) each locally correct but jointly corrupt state.
- **Pattern**: The invariant is not no-concurrency; it is a narrow rule: one ordered commit path for one mutable state boundary (queue, mutex, or lock), committed conservatively at commit time, not across the whole system.
- **Evidence**: >Both operations are locally correct... The rule is narrower and simple. One ordered commit path for one mutable state boundary. This mechanism may be a Q, a mutx, a [lock] (HARNESS-DEBUG).
- **Classification**: emerging | **Cross-ref**: P4 recovery; filesystem-based state | **Tag**: NEW

### P-B9. Harness Failure Shape Catalog + silence is not a terminal state
- **Problem**: Production agent failures have recognizable shapes that are hard to spot because replies still sound coherent.
- **Pattern**: Catalog of five shapes: state hole (user saw success, durable record missing), overlapping writers, dangling tool call (run waits on an event that will never arrive), approval drift, missing edge proof. Design against each: time modes + error results on tools, recovery commands that do not wait behind stuck work.
- **Evidence**: >a state hole, overlapping writers, dangling tool call, approval drift, and missing edge proof (HARNESS-DEBUG); >The run waits for an event that cannot arrive. Silence is not a terminal state (HARNESS-DEBUG); >Tools needs time modes and error results. Channels needs recovery commands that do not wait behind the stuck work (HARNESS-DEBUG).
- **Classification**: validated | **Cross-ref**: P4; P24 observability | **Tag**: NEW

## C. CODING-HARNESS INTERNALS

### P-C1. Terminal/Bash-Core Harness: low-level product layer + bash-is-all-you-need (refines P15)
- **Problem**: Product teams over-build harness UX; models want a minimal, low-level surface.
- **Pattern**: Ship the terminal first — the lowest-level access to the model that keeps users productive, deliberately unopinionated because the right UX is unknown. Inside, bash is the core tool: create/run/delete a Python file is the canonical move; the toolset mirrors human terminal actions, not new abstractions.
- **Evidence**: >It's to start with a terminal and to give you as low-level access to the model as possible in a way that you can still be productive... we want to be unopinionated... we just don't know what the right UX is (BORIS); >I think you could probably get rid of all these tools and only have bash... claude code creates a Python file and then runs the Python file then deletes the Python file. That's the beauty (JARED); >these are all human tasks... We're kind of just mimicking the human actions (JARED).
- **Classification**: validated | **Cross-ref**: P15; P9 system-prompt minimalism | **Tag**: REFINEMENT of P15 (adds product-layer rationale + bash-core mechanics)

### P-C2. Unified-Diff Edit Tool: diffs, not rewrites (refines P22)
- **Problem**: Whole-file rewrites cost tokens, speed, and introduce mistakes.
- **Pattern**: Edit via unified diffs: shorter token footprint, faster, fewer mistakes; it is the standard across coding agents (with small variations).
- **Evidence**: >edit is it's using diffs and it's not rewriting files most of the time. way faster, way way less context used, but also way less uh issues (JARED); >Unified diffing... makes the token limit shorter. It makes it faster and makes it less prone to mistakes (JARED).
- **Classification**: established | **Cross-ref**: P22 | **Tag**: REFINEMENT of P22 (mechanism: unified diff standard)

### P-C3. Read-Before-Edit Enforcement via a Dedicated Grep Tool
- **Problem**: Models edit files they have not read; raw bash grep tempts path/quoting bugs.
- **Pattern**: Expose a special grep tool and force reading-before-editing through it (not bash): security, sandboxing, and token-limit reasons; also makes the model run independent operations in parallel.
- **Evidence**: >reading before editing uh they actually make you do that using the GP tool instead of the bash... I think security is a big one uh and sandboxing but then also just that token limit thing (JARED).
- **Classification**: emerging | **Cross-ref**: P5 compile-then-fix; P17 LSP counter-pattern | **Tag**: NEW

### P-C4. Prefix-Gated Bash Sandboxing Pipeline
- **Problem**: Shell access + web fetch is a big attack vector; blanket approval dialogs are theater.
- **Pattern**: Route every bash command through a gating pipeline where the command prefix determines the sandboxing environment (and the permission set); most of the complex harness code lives in the sandbox/permission layer.
- **Evidence**: >there's this whole pipeline to gate bash command. So it depending on the prefix is how it goes through the sandboxing environment (JARED); >connecting this agent that has shell access and you're doing web fetch that's a pretty big attack vector (JARED).
- **Classification**: emerging | **Cross-ref**: P18/P19 permissions; P27 | **Tag**: NEW

### P-C5. Todo-List Injection: loop steering + resume-after-crash state
- **Problem**: Long autonomous runs drift off-task and give no signal; crashes lose the plan.
- **Pattern**: Inject a todo list into the system prompt (not enforced in code): forces planning, enables resume after crashes, gives UX signal so the run is not silently looping for 40 minutes, adds steerability.
- **Evidence**: >injecting the todos into the system prompt... it's not enforced in actual code... forcing it to plan. Uh we get to resume after crashes... it's not just running off in a loop for 40 minutes without any signal (JARED).
- **Classification**: validated | **Cross-ref**: P3 termination; P24 observability | **Tag**: NEW

### P-C6. Sub-Agent Fork/Isolate/Feed-Back-Results (refines P21)
- **Problem**: Long reads and searches clutter the main context; context-full makes the model stupid.
- **Pattern**: Spawn sub-agents (researcher, docs reader, test runner, code reviewer) each with its own context; they fork, work, and feed back only results, which aggregate into the main context. Task structure lives in the main agent; sub-agent prompts are generated on the fly.
- **Evidence**: >using sub agents for specific tasks... own context and it feeds back only the results and this is how you don't clutter it... the forks of the agent and how we aggregate it back into our main context (JARED); >it can fork out a new context window that is going to go do all that reading and searching (DEX).
- **Classification**: validated | **Cross-ref**: P21; P-A6 | **Tag**: REFINEMENT of P21 (adds explicit context-isolation rationale + role roster)

### P-C7. Skills: the invocation gap is the open problem
- **Problem**: Agents ignore available skills; users end up invoking them manually.
- **Pattern**: Naming/discovery of skills is unsolved: a one-liner per skill helps, but getting the model to call the right skill is itself a tool-call-routing problem (knowing WHEN to call it); treat as functionality, possibly a post-training problem.
- **Evidence**: >Claude ignored all of my skills and so I put them in some... Skills feel globally misunderstood (JARED); >I generally have to call the skill myself manually (JARED); >getting the model to call the skills is almost like calling a tool call. You have to know when to call it (JARED).
- **Classification**: emerging | **Cross-ref**: P25 self-modifying harness; skills-as-context | **Tag**: NEW

### P-C8. Idiomatic-Examples Skill Context + Response Template (actuator skill)
- **Problem**: Agents without exemplars replicate docs/from-internet patterns instead of house style.
- **Pattern**: Invest heavily in the actuator skill: idiomatic handwritten examples (agents are pattern replicators) + a response template, piped with the control signal; keep updating it as the loop matures.
- **Evidence**: >you should spend a lot of time on the skill... idiomatic handwritten examples for the agent to follow because they're just pattern replicators... the skill of course should include a response template (KYLE).
- **Classification**: emerging | **Cross-ref**: P13; P25 | **Tag**: NEW

### P-C9. Agent-Smell Metrics: tool-call/retry/time sanity signals
- **Problem**: E2E evals are heavy; harness regressions hide between them.
- **Pattern**: Cheap surface metrics — how many tool calls, how many retries, how long the run took (agent smell) — for sanity-checking harness changes; start with backtests when building evals.
- **Evidence**: >run an agent and see how many times does it call a tool call. How many times does it retry? How long does it take? And these are all surface level metrics but it's really good for sanity checking (JARED).
- **Classification**: emerging | **Cross-ref**: P24 observability; eval patterns | **Tag**: NEW

### P-C10. Approval as a Structured Object (anti-approval-drift)
- **Problem**: Approvals that lose their shape across retries/replays/callbacks can no longer be proven; requestability is not authority.
- **Pattern**: Make approval an object: who approved, in what session and run, for which tool and arguments, for how long, with what outcome, pointing to the receipt. Bind authority to one pending action; least-privilege narrows the tool surface.
- **Evidence**: >A useful approval object answers who approved in what session and run for which tool and for which arguments and for how long and with what outcome. It also point[s] to the receipt (HARNESS-DEBUG); >Capability is not execution... Requestability is not authority. Approval needs a shape (HARNESS-DEBUG).
- **Classification**: emerging | **Cross-ref**: P18/P19 permissions; P-B9 | **Tag**: NEW

### P-C11. Receipt-vs-Transcript Proof: model proposes, harness commits, receipt proves
- **Problem**: A transcript records what the agent said, not what the harness actually committed; coherence over a broken history hides holes.
- **Pattern**: Model output is a proposal; the harness owns state transition, authority check, ordered commit; the receipt (audit trail) is the evidence that survives — the model is not the production boundary. Proof is a chain (propose → allow/deny → execute → user-visible confirm), not a claim.
- **Evidence**: >A model proposes the harness commits and the receipts proves it... transcript is not the proof. A transcript tells you what the agent said. A receipt tells you [what happened] (HARNESS-DEBUG); >Proof is a chain, not a claim (HARNESS-DEBUG).
- **Classification**: validated | **Cross-ref**: P8; P24 observability | **Tag**: NEW

### P-C12. Tool Docs into Persistent Context: CLI run-help → CLAUDE.md (refines P13)
- **Problem**: Integrating a new tool into an agent normally requires building bridges/extensions.
- **Pattern**: Point the agent at the CLI's run-help, let it learn, then persist what it learned into CLAUDE.md; the harness needs no bridge or extension for tools that expose a CLI.
- **Evidence**: >here's the CLI tool cla run-help. Take what you learn and then put it in the cloud MD. And now Cloud knows how to use the tool. That's all it takes. You don't have to build a bridge. You don't have to build an extension (BORIS).
- **Classification**: established | **Cross-ref**: P13; P25 | **Tag**: REFINEMENT of P13 (mechanism: run-help → CLAUDE.md as the tool-onboarding path)

### P-C13. TDD-as-Agent-Workflow (refines P5)
- **Problem**: TDD is hard for humans; agents make it tractable and reliable.
- **Pattern**: Tell the agent to write tests first (clear descriptions), then implement to green; the model executes the discipline humans find hard.
- **Evidence**: >The second one is TDD... maybe the reason is it's not me doing it, it's the model doing it (BORIS); >the workflow here is tell Claude to write some tests and kind of describe it (BORIS).
- **Classification**: established | **Cross-ref**: P5 compile-then-fix; P3 termination | **Tag**: REFINEMENT of P5 (test-first variant of the inner loop)

## Coverage notes
- DEX (23.6K): context-engineering canon — richest single source for compaction, smart-zone budget, stateless thesis, RPI phases; 8 patterns.
- BORIS (18.1K): product-layer/UX framing — terminal-first minimal harness, tools-in-context-then-think, run-help→CLAUDE.md, TDD workflow; thin on loop internals (by design of the talk).
- JARED (62K, 2 keyword passes): deepest internals source — master while-loop, tool list rationale, diff edits, prefix-gated sandbox, todo injection, sub-agent context isolation, skills invocation gap, agent-smell metrics, compaction internals, model-as-tool, structured-tools-for-edge-cases.
- KYLE (18.4K): loop design from first principles — control-loop theory (sensor/setpoint/controller/actuator), deterministic-first steps, PR-label dedup, /iterate resteering, actuator-skill exemplars; grounded in a real RPC-migration loop.
- HARNESS-DEBUG (14.5K): production harness-failure taxonomy — state hole, overlapping writers, dangling tool call, approval drift, missing edge proof; ordered commit path; receipt-vs-transcript proof; speaker name discrepancy (caption 'Ben'/OpenClaw vs catalog Vinoth Govindarajan).
- Gaps: (1) Claude Code hooks and workflows features mentioned only glancingly — no deep internals surfaced in filtered passes; (2) MCP client internals beyond tool-listing/security vector not covered; (3) permission-UI/approval UX details not covered by these 5 (see MCP-security/auth talks in catalog); (4) compaction numeric internals (92% limit confirmed; drop-middle strategy confirmed) still lack full detail — see agentic-patterns taxonomy Clawdbot; (5) stateless-loop treatment — gap from cluster-B now filled (P-A3).
