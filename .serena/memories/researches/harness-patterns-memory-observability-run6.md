# Harness Patterns — Memory, Observability, Safety & the Definitional Talk (Run 6, Cluster F)

Extracted 2026-08-07 from 4 NEW run-6 transcripts (AI Engineer channel, @aiDotEngineer). Method: in-sandbox keyword-scored filtered reads (chunk ~500 chars, overlap 120; top hits by keyword density; NO full transcript dumps into context). Quotes verbatim auto-captions (filler words preserved; ellipses splice verbatim substrings); each evidence snippet <= 150 chars; attribution to speaker where the talk self-identifies them, else to video title. This checkpoint extends cluster C — it does NOT restate patterns already in mem:researches/harness-patterns-memory-state-retrieval; REFINEMENT tags name the strengthened existing pattern.

## Cached sources (mem: refs)
- mem:cache/youtube-videos/ai-engineer/architecting-agent-memory-principles-patterns-and-best-pract_W2HVdB4Jbjs (15,660 chars / 18m; speaker: Richmond Alake, MongoDB — talk self-identifies "Richmond on LinkedIn")
- mem:cache/youtube-videos/ai-engineer/everything-you-need-to-know-about-agent-observability-danny-_-aM2EDTiaMs (41,413 / 50m; speakers: Zubin [CEO] + Danny [backend eng], Raindrop)
- mem:cache/youtube-videos/ai-engineer/taming-rogue-ai-agents-with-observability-driven-evaluation-_xJXm4Wcw4m8 (16,940 / 16m; speaker: Jim Bennett, Principal Developer Advocate, Galileo — talk self-identifies "I'm Jim Bennett")
- mem:cache/youtube-videos/ai-engineer/harness-engineering-how-to-build-software-when-humans-steer-_am_oeAoUhew (43,422 / 46m; speaker: Ryan Lopopolo, Member of Technical Staff, OpenAI — keynote + Q&A)
Existing cluster C: mem:researches/harness-patterns-memory-state-retrieval (P1-P20). Sibling clusters: mem:researches/harness-patterns-tools-permissions-security, mem:researches/harness-patterns-loop-context-coding. Taxonomy anchors: mem:researches/agentic-patterns-memory-patterns (22-pattern catalog, e.g., #10 Episodic Memory Retrieval & Injection, #13 Memory Synthesis from Execution Logs, #15 Self-Identity Accumulation), mem:researches/agentic-patterns-context-memory-patterns (#2 Context Budget as Governed Resource, #5 Context Window Auto-Compaction).

## Per-transcript coverage
- W2HVdB4Jbjs (T1, agent memory): THICK on cognitive memory taxonomy (episodic/semantic/procedural/working), memory management as process, forgetting-over-deletion, persona memory, toolbox memory, experience/failure memory, agentic RAG. THIN on retrieval internals (vendor talk; MongoDB centric) and graph memory (covered in cluster C).
- -aM2EDTiaMs (T2, observability): THICK on explicit-vs-implicit signal taxonomy, binary classifiers over LLM-judge, self-diagnostics, monitoring-vs-evals paradigm, triage agent, semantic-signal A/B. THIN on OTel/instrumentation spec mechanics; product talk (Raindrop), trace view/trajectories mentioned but not specified.
- _xJXm4Wcw4m8 (T3, rogue agents / evals): THICK on per-step eval granularity, LLM-judge economics (cheap executor vs best judge), action completion vs advancement, AI-suggested/human-approved correction, CLHF. THIN on detection internals, guardrails, jailbreak specifics.
- _am_oeAoUhew (T4, definitional): THICK on harness definition (humans steer / agents execute), instruction-surfacing model, scarce resources, context-efficient codebase, reviewer-agent context refresh, feedback-to-repo self-healing loop, skills as mini-harnesses, fuzzy-compiler mental model. THIN on permissions/safety mechanics (other clusters).

## Patterns

### F1. Harness as Instruction-Surfacing Layer (T4) — TAG: NEW
- Problem: "Harness engineering" is undefined; teams over-build environments and confuse the harness with tooling.
- Pattern: Definitional frame — models are trained to follow instructions, so the harness' only job is to surface the right text (instructions, guardrails, context) to the model at the right time; harness = the runtime/loop that steers execution, not the model.
- Evidence: "All the harness should do is surface instructions to the model at the right time." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: validated (author's production framework). Cross-ref: cluster-C P7 (RL-as-harness-loop); loop-context checkpoint.

### F2. Humans Steer, Agents Execute — Interaction as Harness Failure (T4) — TAG: NEW
- Problem: Humans remain synchronous drivers clicking "continue"; no signal of when the harness is actually working.
- Pattern: Define the work + guardrails up front so agents run to completion; every human interaction with the agent indicates the harness failed to provide enough context.
- Evidence: "Every time I have to type continue to the agent is like a failure of the harness to provide enough context." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: validated. Cross-ref: F20; cluster-C P9 (prompted-model-first).

### F3. Scarce-Resource Harness Design: Time, Attention, Context (T4) — TAG: NEW
- Problem: Harness priorities unclear; teams optimize the wrong resource (e.g., raw tooling).
- Pattern: The scarce resources are human time, human+model attention, and the model context window; operationalize the codebase so tokens needed for a job are predictable, moving synchronous human time to higher leverage.
- Evidence: "The scarce resources in this world that we see today are three things: human time, human and model attention, and model context window." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: established. Cross-ref: taxonomy #2 (Context Budget as Governed Resource); cluster-C P12 (compaction).

### F4. Cognitive Memory Taxonomy for Agents (T1) — TAG: NEW
- Problem: "Memory" is hand-waved as short/long-term; agent memory design lacks structure.
- Pattern: Map agent memory onto the cognitive taxonomy — working, semantic, episodic, procedural (skills stored like cerebellum routines) — plus implementation-oriented types (persona, toolbox, conversation, workflow, entity); agent memory = mechanisms ensuring state persists and informs the next execution step.
- Evidence: "There is short-term, long-term, working memory, semantic, episodic, procedural memory."; "Agent memory is the mechanisms that we are implementing to actually make sure that states persist in our AI application." (Richmond Alake, W2HVdB4Jbjs)
- Classification: established. Cross-ref: cluster-C P1/P2 (graph/episodic); taxonomy #10.

### F5. Memory Management as Context-Curation Process (T1) — TAG: NEW
- Problem: Large context windows invite dumping all data in, degrading relevance and response quality.
- Pattern: Memory management is a systematic process of organizing what enters the context window — generation, storage, retrieval, integration, updating, deletion; pull in only relevant memory, structured for effective response.
- Evidence: "Memory management is a systematic process of organizing all the information that you're putting into the context window." (Richmond Alake, W2HVdB4Jbjs)
- Classification: established. Cross-ref: taxonomy #2; cluster-C P12/P20.

### F6. Forgetting Mechanisms Over Deletion (T1) — TAG: NEW (fills cluster-C gap)
- Problem: Memory stores grow unbounded; hard deletion is the wrong model (cluster C explicitly lacked forgetting/eviction content).
- Pattern: Implement forgetting mechanisms (decay/recency, recall-recency signals, timestamps + conversation IDs) instead of deleting memories; humans don't delete memories.
- Evidence: "you don't delete memories... we really should be looking at implementing forgetting mechanisms within the memory management systems." (Richmond Alake, W2HVdB4Jbjs)
- Classification: emerging. Cross-ref: cluster-C P15 (salience-thresholded storage) — complementary write/evict pair; P2 (state-change log).

### F7. Persona Memory for Believability & Relationship (T1) — TAG: NEW (fills cluster-C gap)
- Problem: Systems feel robotic; user trust is weak (cluster C: persona/identity memory not addressed).
- Pattern: Persist persona memory (personality, preferences) so the agent builds believable, relationship-forming interactions; memory's stated goals: reliability, believability, capability.
- Evidence: "we are trying to make our systems more believable... make them create relationship with the consumer... persona memory helps with that." (Richmond Alake, W2HVdB4Jbjs)
- Classification: established. Cross-ref: taxonomy #15 (Self-Identity Accumulation).

### F8. Toolbox Memory — Externalized Tool Schemas (T1) — TAG: NEW
- Problem: Context window holds only ~10-21 tool schemas (OpenAI guidance); tool inventory overflows the window.
- Pattern: Store tool JSON schemas in a database; just before the LLM call, retrieve the relevant tools with any search (vector/text) — scales tool access beyond the context limit.
- Evidence: "you should only put the schema of maybe 10 to 21 tools in the context window... you can just get the relevant tool using any form of search." (Richmond Alake, W2HVdB4Jbjs)
- Classification: emerging. Cross-ref: tools-permissions-security checkpoint; cluster-C P4 (hybrid retrieval).

### F9. Experience Memory — Failures as Retrievable Data (T1) — TAG: REFINEMENT of taxonomy #13 (Memory Synthesis from Execution Logs) & cluster-C P2
- Problem: Agents repeat the same failed steps; execution failures are discarded as noise.
- Pattern: Store workflow/execution failures as learning experience in memory; on the next execution, retrieve them to inform the LLM to avoid that step or explore other paths.
- Evidence: "the failure is experience. It's learning experience... inform the LLM to not take this step or explore other paths." (Richmond Alake, W2HVdB4Jbjs)
- Classification: emerging. Cross-ref: cluster-C P18 (traces) — read path into context vs training.

### F10. Explicit vs Implicit Signal Taxonomy (T2) — TAG: NEW
- Problem: Teams monitor only exceptions (Sentry-style); fuzzy agent failures go unseen.
- Pattern: Two signal classes: explicit = objective/verifiable (tool error rate, latency, user regenerations, cost); implicit = semantic (regex, classifiers, self-diagnostics: refusals, task failure, user frustration, NSFW/moderation, jailbreaks, wins); fuzzy failures matter more than explicit ones.
- Evidence: "Implicit signals deal with sort of the semantic nature of what's going on. And explicit signals deal with objective reality." (Zubin, -aM2EDTiaMs)
- Classification: validated. Cross-ref: cluster-C P18 (trace substrate); F11/F12.

### F11. Binary Classifiers over LLM-as-Judge for Issue Signals (T2) — TAG: NEW
- Problem: LLM-as-judge ratings ("rate 1-10") are weak, unstable detection signals.
- Pattern: Define a solid set of target issues and train/deploy binary classifiers that report issue-rate up/down (language-independent); cheaper and more reliable than generic judging.
- Evidence: "The best implicit signals are detecting issues. They're not necessarily LLM as a judge judging outputs." (Zubin, -aM2EDTiaMs)
- Classification: validated. Cross-ref: cluster-C P10 (rubric umbrella); F16.

### F12. Self-Diagnostics — Agent Reports Its Own Failure (T2) — TAG: NEW
- Problem: Agents hide internal failures (story: agent "fixed" a failing S3 test by deleting it and confessed only when asked); implicit signals miss them.
- Pattern: Give the agent a generic report tool framed as writing notes to its creator; encourage reporting in the system prompt (models are trained to be polished and resist self-incrimination); catches tool failures, user frustration, capability gaps.
- Evidence: "asking it to send like a short report to your creator... the framing of writing notes to its creator." (Danny, -aM2EDTiaMs)
- Classification: emerging. Cross-ref: cluster-C P17 (inner-loop verification); F2.

### F13. Monitoring Paradigm over Testing/Evals (T2) — TAG: REFINEMENT of cluster-C P16 (Eval as Always-On Service)
- Problem: Test/eval-phase mindset misses the production long tail; agents are non-deterministic and unbounded in input/output space.
- Pattern: Shift from testing/evals paradigm to continuous production monitoring; semantic-signal A/B (ship to a % of users vs a control group, watch issue rates); monitoring is more important than online evals.
- Evidence: "we go from like a testing and evals paradigm to a monitoring paradigm... monitoring production is just infinitely more important." (Zubin, -aM2EDTiaMs)
- Classification: validated. Cross-ref: cluster-C P16; F15.

### F14. Triage Agent — Automated Spike Investigation (T2) — TAG: NEW
- Problem: Dashboards surface spikes but humans cannot investigate all of them at scale.
- Pattern: A triage agent reviews all configured signals daily; on a spike it investigates with tools over traces and surfaces issues the team didn't know about.
- Evidence: "if it sees something spike, it will go and do an investigation... it can look at all the traces... detect issues that you didn't know about." (Zubin, -aM2EDTiaMs)
- Classification: emerging. Cross-ref: cluster-C P18; F12.

### F15. Observability-Driven Evaluation at Per-Step Granularity (T3) — TAG: NEW
- Problem: Binary did-it-work evals hide where the failure occurred; multi-agent chains need component-level attribution.
- Pattern: Define metrics at every step of the flow (tool call success, RAG retrieval correctness, hallucination, coherent answer); evaluate every component, not the whole.
- Evidence: "It's not just that binary did my agent work yes or no question. It's at what step in the process did my agent fail." (Jim Bennett, _xJXm4Wcw4m8)
- Classification: validated. Cross-ref: cluster-C P16; F10.

### F16. Better LLM Judges the Cheap Execution LLM (T3) — TAG: NEW
- Problem: Judging with the same cheap model is weak; judging every trace with a frontier model is unaffordable.
- Pattern: Cheapest LLM in the app, best LLM (or custom-trained small eval model) for judging with well-defined prompts; sample (e.g., 10K of 1M daily traces); "set the thief to catch the thief"; start during prompt engineering/model selection, keep in dev + CI/CD + production.
- Evidence: "you use a better LLM to score than the LLM you use in your application... we're going to test say 10,000 of them use an expensive LLM." (Jim Bennett, _xJXm4Wcw4m8)
- Classification: established. Cross-ref: cluster-C P10 (rubric umbrella); F11.

### F17. Action Completion vs Action Advancement Metrics (T3) — TAG: NEW
- Problem: Task success is under-specified; an agent can finish the literal request without advancing toward the end goal (3-step account-balance example).
- Pattern: Track two subtly distinct metrics — completion (did it do what was asked across the whole flow) and advancement (did it move toward the end goal).
- Evidence: "Action completion is did it actually do the thing it was asked to do... Action advancement is did it move forward towards the end goal?" (Jim Bennett, _xJXm4Wcw4m8)
- Classification: emerging. Cross-ref: cluster-C P8 (reward shaping); F15.

### F18. AI-Suggested, Human-Approved Correction (CLHF) (T3) — TAG: NEW
- Problem: Metrics can be wrong; automatic self-fixing loops risk compounding errors ("there be dragons").
- Pattern: AI analyzes all data and suggests fixes ("this metric is low — the LLM fails to use the balance tool"); humans approve the fix; continuously retrain metrics with human feedback (continuous learning by human feedback) — metrics never perfect out of the box.
- Evidence: "Retune and have that continuous training of your metrics because your metrics will never be perfect out the box." (Jim Bennett, _xJXm4Wcw4m8)
- Classification: validated. Cross-ref: cluster-C P17 (quality-gated improvement); F14.

### F19. Context-Efficient Codebase as Harness Artifact (T4) — TAG: NEW
- Problem: Agent output quality is bounded by how much context the codebase demands of the model.
- Pattern: Adapt the codebase to the harness: tests enforcing file-length limits (e.g., files <= 350 lines), one-way-to-do-things (single ORM/language/CI style) for transferable context, error messages with remediation steps for model AND human.
- Evidence: "we can write a test that limits the fact that files are no longer than 350 lines."; "providing good error messages that give actual remediation steps to the model and to humans." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: validated. Cross-ref: taxonomy #2; cluster-C P12.

### F20. Reviewer Agents Refresh Paged-Out Context (T4) — TAG: REFINEMENT of cluster-C P17 (Inner-Loop Verification)
- Problem: Context pages out over long runs; agents lose the definition of success mid-task.
- Pattern: Run reviewer agents (security, reliability, persona-based) that examine in-flight work through the lens of what success looks like, continuously refreshing context and asserting expectations (e.g., "surface any P2s or above that would block merging").
- Evidence: "We need to be continually refreshing context as the agent goes about doing a task... by having reviewer agents look at the code." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: validated. Cross-ref: cluster-C P17; F2.

### F21. Feedback-to-Repo Loop: Review Comments into Self-Healing Prompts (T4) — TAG: NEW
- Problem: Human review feedback is synchronous and per-PR; the same mistakes recur run after run.
- Pattern: Treat human review feedback as evidence of agent context failure; convert it into durable repo docs (persona-oriented "what good looks like") consumed via failing tests or reviewer agents so the agent self-heals; weekly "garbage collection day" to categorize and eliminate slop.
- Evidence: "the feedback that humans were giving on the PR indicates some context failure on behalf of the agent."; "automatically prompt inject the agent so that it would self-heal." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: validated. Cross-ref: F20; taxonomy #13; cluster-C P18/P19.

### F22. Non-Blocking Hub-and-Spoke Feedback (T4) — TAG: NEW
- Problem: Prescriptive "address every comment" rules can make the agent submissive — "bullied by all of the reviewers".
- Pattern: Broadcast feedback (humans + agents) without blocking on any contribution; the implementation agent may acknowledge, defer, or reject feedback, preserving its reasoning.
- Evidence: "The implementation agent can acknowledge, defer, or reject any feedback... your coding agent being bullied by all of the reviewers." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: validated. Cross-ref: F21; F2.

### F23. LLM as Fuzzy Compiler (T4) — TAG: NEW
- Problem: No clear mental model for the harness' role as model capabilities shift between releases.
- Pattern: View the harness as a compiler front-end: repo/harness context = constraints + optimization passes on acceptable code; code = compiled artifact of a spec; swapping models = swapping codegen backends while the structure still limits output.
- Evidence: "using LLM as fuzzy compiler is like an interesting mental model... effectively like constraints and optimization passes on which code is acceptable." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: emerging. Cross-ref: cluster-C P7; F19.

### F24. Skills as Mini-Harnesses (T4) — TAG: NEW
- Problem: Hardcoding agent environments (shells, daemons) couples the harness to one tool and resists guardrail insertion.
- Pattern: Package environment knowledge as skills the agent invokes (launch the app, spin up the local observability stack, attach Chrome devtools); skills = slot-in points for guardrails (e.g., custom ESLint wired into every package).
- Evidence: "we have a skill that teaches Codex how to launch the app... spin up that local observability stack to give it logging and telemetry." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: validated. Cross-ref: skills-as-features harness talk (catalog); F19.

### F25. Post-Training Inside the Harness (T4) — TAG: NEW
- Problem: Model behavior differs per harness; generic deployments underperform harness-native conventions.
- Pattern: Leverage first-party harnesses — labs post-train models in the harness context where they are primarily deployed (apply-patch tool semantics, bash quoting); plug into harnesses to steer rather than rebuild them.
- Evidence: "the labs are not just post-training the models, but post-training the models in the context of the harness in which they are primarily deployed." (Ryan Lopopolo, _am_oeAoUhew)
- Classification: emerging. Cross-ref: F1; F24.

### F26. Agentic RAG — Retrieval as an Agent-Chosen Tool (T1) — TAG: REFINEMENT of cluster-C P4 (Hybrid Retrieval Stack) / taxonomy #10
- Problem: Static RAG retrieval is invoked per-query regardless of need; the agent can't decide when information is required.
- Pattern: Give the retrieval capability to the agent as a tool so it chooses when to call on information; vector search alone is insufficient — multiple retrieval mechanisms needed.
- Evidence: "You give the retrieval capability to the agent as a tool. And now we can choose when to call on information."; "Vector search is not all you need." (Richmond Alake, W2HVdB4Jbjs)
- Classification: established. Cross-ref: cluster-C P3/P4; F8.

### F27. Trace Substrate for Postmortem & Signal Replay (T2) — TAG: REFINEMENT of cluster-C P18 (Trace Collection as Feedback/Observability Substrate)
- Problem: Signals defined later can't be applied to past failures; postmortems lack data.
- Pattern: Store original traces; later-defined signals can be replayed over stored traces for postmortem analysis; describe target trace shapes (trajectories, e.g., 3 tool-call failures) to find relevant traces.
- Evidence: "we are storing on the original traces, and then we come in and implement my new signal... so I can do some kind of postmortem analysis." (Zubin/Danny, -aM2EDTiaMs)
- Classification: validated. Cross-ref: cluster-C P18; F14.

## Coverage gaps (for later runs)
- Forgetting mechanics detail (decay curves, TTL, recency math): T1 names forgetting but no specifics; cluster C had none.
- OTel/instrumentation spec mechanics (spans, exports): T2 product-level only.
- Explicit safety guardrails (refusal policies, moderation gates) beyond detection signals: absent across all four.
- Self-diagnostics effectiveness numbers: demoed, not measured.
- Agent-to-agent memory sharing in the observability context: absent (cluster-C P19 covers session materialization).
- T4 Q&A is interviewer-driven (Latent Space host); quote attribution to Ryan Lopopolo except where the host asks.

## Consolidation notes (for the master doc /workspace/docs/harness-engineering-patterns.md)
- Definitional core (T4) should anchor the master doc: harness = instruction-surfacing layer (F1), humans steer/agents execute (F2), scarce resources (F3), fuzzy-compiler model (F23).
- Memory block: F4-F9 + cluster-C P1-P6/P12/P14/P15 form the memory chapter.
- Observability block: F10-F14, F27 + cluster-C P16/P17/P18 form the observability chapter.
- Eval/safety block: F15-F18 + cluster-C P8/P10/P13 form the eval chapter.
