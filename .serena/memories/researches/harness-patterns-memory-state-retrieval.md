# Harness Patterns — Memory, State, Retrieval & Reasoning Loops

Extracted 2026-08-07 from MINED-TRANSCRIPT cluster C (AI Engineer channel, @aiDotEngineer). Method: in-sandbox keyword-filtered reads of cached verbatim transcripts (no full dumps into context); segments scored by keyword density, top matches returned. All quotes verbatim auto-captions (filler words preserved); attribution to track/video only — auto-captions carry no speaker labels, so speakers are NOT named except where the caption text itself attributes.

## Cached sources
- mem:cache/youtube-videos/ai-engineer/ai-engineer-worlds-fair-2025-graphrag_RR5le0K4Wtw (157K; WF2025 GraphRAG track)
- mem:cache/youtube-videos/ai-engineer/ai-engineer-worlds-fair-2025-reasoning-rl_-9E9_21tx04 (135K; WF2025 Reasoning+RL track)
- mem:cache/youtube-videos/ai-engineer/wf2026-autoresearch-keynotes-ft-anthropic-google-deepmind-am_4sX_He5c4sI (445K; WF2026 Autoresearch keynotes)
Taxonomy anchors: mem:researches/agentic-patterns-context-memory-patterns, mem:researches/agentic-patterns-memory-patterns (22-pattern Context & Memory catalog).

## Per-transcript coverage
- GraphRAG (T1): THICK on retrieval substrate (graph/vector/hybrid), agent-memory-vs-RAG framing, episodic state-change storage, one executor-agent loop with snapshot. THIN on RL, durable checkpointing, context-window economics.
- Reasoning+RL (T2): THICK on RL loop mechanics (rollouts, rewards, reward hacking, data recipe), context-compaction as memory. THIN on memory taxonomies, retrieval/RAG, persistence.
- Autoresearch (T3): THICK on memory-harness payoff, eval-driven loop control, trace observability, self-improvement gates. THIN on RL reward detail; breadth-over-depth keynote format.

## Patterns

### P1. Graph as Memory Substrate — explicit relationships over embeddings (T1)
- Problem: Vector memory stores facts but no explicit relationships, so related-but-dissimilar facts are unrecoverable and contradictions persist unresolved.
- Pattern: Use a knowledge graph as the agent memory substrate: entities + typed relationships give deterministic recall and explainable retrieval paths; vector/embedding stores keep only semantic similarity.
- Evidence: "There's no explicit relationships between these embeddings, these vector representations of the facts that we've generated for our memory."; "However, when we look at knowledge graphs, we can define explicit relationships." (WF2025 GraphRAG track)
- Classification: validated (track consensus; production legal/finance systems). Cross-ref: Schema-Guided Graph Retrieval (catalog #17), Episodic Memory Retrieval & Injection (#10).

### P2. State-Change Log on Graph — episodic memory as time-indexed graph (T1)
- Problem: Agents need to recall not just facts but how facts/states changed over time (preferences flip, evolving situations); a static store returns stale or contradictory state.
- Pattern: Persist a sequence of state changes onto the graph; the agent reasons over the change history, approximating human recall of changing state.
- Evidence: "we store a sequence of state changes on the graph which allows your agent to then reason with those state changes over time."; "a closer approximation to how humans might process and recall changing state over time." (WF2025 GraphRAG track)
- Classification: emerging. Cross-ref: Episodic Memory Retrieval & Injection (#10).

### P3. RAG Failure Modes as Agent Memory (T1)
- Problem: Naive vector RAG used as agent memory fails when facts conflict or when the query is most similar to a superseded fact (vector recall favors similarity over recency/validity).
- Pattern: Diagnose memory failures by asking whether the store encodes relationships and timeliness; when similarity-based recall returns stale/contradictory top hits, escalate to structured (graph) memory with explicit state.
- Evidence: "we actually sit with a bunch of contradictory embeddings with no resolution in the vector database."; "the preference changes however Robbie's follow-up question ... is most similar to the first Adidas fact and so if we're using a vector database, that fact may be at the top of the search results and the agent responds incorrectly." (WF2025 GraphRAG track)
- Classification: validated (demoed failure, widely-replicated failure mode). Cross-ref: Episodic Memory Retrieval & Injection (#10).

### P4. Hybrid Retrieval Stack — graph + semantic + BM25 (T1)
- Problem: No single retrieval primitive covers entity-relation queries, semantic similarity, and exact/full-text matches.
- Pattern: Combine subgraph identification (semantic search + BM25 full-text) with knowledge-graph traversal; measured retrieval wins over pure vector search on QA benchmarks.
- Evidence: "Graffiti uses semantic search and BM25 full text retrieval to identify subgraphs within the broader graffiti graph."; "compared our retrieval system ... with seven different vector search systems and we found that we had the best accuracy and the fastest response time." (WF2025 GraphRAG track)
- Classification: established. Cross-ref: Schema-Guided Graph Retrieval (#17), Semantic Context Filtering (#19).

### P5. Graph Snapshot Checkpoint in Agent Loop (T1)
- Problem: An agent acting on live/evolving data needs a consistent point-in-time view to plan and execute against.
- Pattern: Executor agent snapshots the current graph state (plus test cases and the incoming PR) before acting; snapshot = deterministic checkpoint decoupling agent work from concurrent updates.
- Evidence: "the exeutor agent goes looks at the test cases and then it goes into the knowledge graph and it's going to go ahead and actually do a snapshot of the most recent visual or most recent information about the network." (WF2025 GraphRAG track)
- Classification: emerging. Cross-ref: Filesystem-Based Agent State (#11).

### P6. Ontology-First Iterative Graph Construction (T1)
- Problem: Retrieval quality is bounded by schema quality; bad ontologies yield bad retrieval regardless of the store.
- Pattern: Spend the bulk of effort (~80%) iterating on the ontology/schema, then build vector and graph stores; treat schema as a living artifact refined against retrieval evals.
- Evidence: "this is where you'll spend uh 80% of your time to make sure you get the oncology right and you'll be going back and forth in an iterative manner to see how you can make it better over time."; "The better is a knowledge graph, the better is the retrieval." (WF2025 GraphRAG track)
- Classification: established. Cross-ref: Schema-Guided Graph Retrieval (#17).

### P7. RL Rollout as the Universal Agent-Harness Loop (T2)
- Problem: Agent-loop design and RL training loops are the same shape, but teams build them separately and lose the training/eval leverage.
- Pattern: Treat the harness as an RL environment: harness=environment, eval=reward, task=prompt, policy=LLM API; a rollout is initial state + while-loop until done, reusable for both serving and RL.
- Evidence: "environments are basically harnesses, rewards are basically eval, tasks are just prompts, and your policy in the RL sense hopefully should just be as simple as like an LLM API."; "you kind of set up some initial state stuff have a while loop for is it done yet?" (WF2025 Reasoning+RL track)
- Classification: established. Cross-ref: harness-loop taxonomy (agent loop as reward environment).

### P8. Turn-Count & Honesty Reward Shaping (T2)
- Problem: A pure success/fail reward does not shape efficiency or honesty; agents pad turns or hallucinate answers.
- Pattern: Compose rewards: solve eventually + bonus for fewer turns; penalize confident-wrong answers more than explicit "I don't know".
- Evidence: "you want to reward it for like uh solving the thing eventually but also like give it more rewards for doing it in less turns"; "we basically penalized it if ... the reward model said hey you got the answer wrong and but it hadn't tried to get an answer ... that was like a much lower reward than if it just said hey I don't know." (WF2025 Reasoning+RL track)
- Classification: established. Cross-ref: eval-driven loop control.

### P9. Prompted-Model-First Escalation Ladder (T2)
- Problem: Teams jump straight to RL/training; they cannot attribute wins to the harness vs the training.
- Pattern: Max out the prompted baseline first, then SFT warm-up (lowers RL barrier), then RL only when prompted baselines are provably exceeded.
- Evidence: "I would generally always recommend starting with getting the best performance you can with a prompted model before going to any training including reinforcement learning."; "SFT warm-up as a way of kind of lowering the barrier of entry." (WF2025 Reasoning+RL track)
- Classification: established. Cross-ref: eval-driven loop control.

### P10. Reward Hacking as Eval Difficulty; Rubric as Eval Umbrella (T2)
- Problem: Reward hacking looks like an RL failure but is really an eval-design failure; reward and eval are one system.
- Pattern: Unify reward models, reward functions, and LM-as-judge under a "rubric" concept; on-the-fly rubric generation by the reward model enables fine-grained RL signals without hand-authored criteria.
- Evidence: "reward hacking is really a message about the difficulty of building good evals."; "the term rubric as a conceptual general umbrella around reward models, reward functions, LM as judge setups like the criteria on which you are evaluating a thing." (WF2025 Reasoning+RL track)
- Classification: validated. Cross-ref: eval-driven loop control.

### P11. Synthetic Reasoning-Trace Data Recipe (T2)
- Problem: RL for reasoners needs reasoning traces, but human-written 10k-token traces with backtracking are infeasible to produce at scale.
- Pattern: Generate training data by sampling multiple reasoning traces per question (works well); bootstrap initial traces via expert-written 5-10 step plans and model checking; note trace rewriting was not helpful.
- Evidence: "sampling multiple answers so multiple reasoning traces per question in your data set works really really well."; "OpenAI spending like 12 to 18 months building these initial reasoning traces that they could then train an initial model on."; "a lot of expert people can write a five to 10 step plan that is very good or check the work." (WF2025 Reasoning+RL track)
- Classification: emerging. Cross-ref: Memory Synthesis from Execution Logs (#13) in inverse direction (synthesis feeds training, not context).

### P12. Context-Window Compaction as Runtime Memory Management (T2/T3)
- Problem: Long agent runs fill the context window; memory must be actively managed at runtime.
- Pattern: Compress memory when the window fills (Claude Code pattern); compaction cadence is a design lever and differs by harness (e.g., ~hourly vs ~20/hour), driven by window size.
- Evidence: "how do I manage a memory so we have cloud code compresses its memory when fills up its context window." (T2); "codex did a lot of compaction because it only had like 250k context window and cloud only do it like one per hour and codex was like 20 every one hour." (T3)
- Classification: validated. Cross-ref: Context Window Auto-Compaction (#5), Context Budget as Governed Resource (#2).

### P13. Verifiable-Reward RL + Parallel Rollouts (T2/T3)
- Problem: RL signal quality limits reasoning gains; hand-labeled rewards do not scale.
- Pattern: RL with verifiable rewards (math/code/execution checks): run many parallel rollouts per task, reward at the end; test-time compute scaling (more samples / best-of-n / self-consistency) compounds with RL training-time scaling.
- Evidence: "reinforcement learning with verifiable rewards post01 post deepseeck" (T2); "The current dominant paradigm is reinforcement learning with verified rewards where given a model and a task we perform a number of parallel rollouts and get rewards at the end." (T3); "such as a best of n sampling, self-consistency or verifiers that rerank the candidates." (T3)
- Classification: validated. Cross-ref: eval-driven loop control.

### P14. Memory Harness Payoff Is Context-Overflow-Bound (T3)
- Problem: Memory machinery adds cost; teams add memory without knowing when it earns its keep.
- Pattern: Memory harness pays off only when the full task + context does not fit the window; when everything fits, memory adds no capability. Long-horizon benchmarks exist to test this boundary.
- Evidence: "if I start to run tasks that are longer term horizon and the entire task and the relevant context doesn't uh fit, then having a good memory harness really starts to pay off."; "because for these tasks all the papers and all the information fit into the context, the memory actually didn't add more capability."; "It's completely outside of the context window and the model needs to use the memory harness to retrieve the specific answer from the right step." (WF2026 Autoresearch keynotes)
- Classification: established. Cross-ref: Context Window Auto-Compaction (#5), Episodic Memory Retrieval & Injection (#10).

### P15. Salience-Thresholded Episodic Storage (T3)
- Problem: Storing every event floods memory; retrieval quality degrades and costs grow.
- Pattern: The LLM scores each event's importance; only events above a threshold are written to a separate salient cache for better later retrieval (importance-gated episodic write).
- Evidence: "the agent will evaluate or the LM will evaluate uh an important score of an event and if it crosses a threshold, it will store that specific memory uh in a separate cache so that important context can be retrieved better later on." (WF2026 Autoresearch keynotes)
- Classification: emerging. Cross-ref: Episodic Memory Retrieval & Injection (#10), Proactive Agent State Externalization (#14).

### P16. Eval as Always-On Service with Go/No-Go Gates (T3)
- Problem: Treating eval as a pre-ship testing phase misses regressions in an evolving agent system.
- Pattern: Run evaluation as a continuous service; emit eval results to a shared dashboard; make go/no-go decisions on prompt/architecture changes; hold out a fixed eval set the loop never sees; feed decisions into an improvement loop (hypothesize -> candidate agents -> analyze evals).
- Evidence: "evaluation is an always running service not a testing phase."; "we emit our evaluation results to weave where we have a common dashboard that we can make go no-go decisions on various prompt changes or architectural changes that then feeds into a research loop which we call our improvement loop."; "We also hold out the 19 evaluation task ... the loop never sees." (WF2026 Autoresearch keynotes)
- Classification: established. Cross-ref: eval-driven loop control, Context Budget as Governed Resource (#2).

### P17. Inner-Loop Verification & Quality-Gated Self-Improvement (T3)
- Problem: Feedback arrives only at the end of long runs; agents drift and self-improvement loops submit bad changes.
- Pattern: Give the agent verification while it works (in-loop verification: data flows, control flows, secrets + agentic checks of intent/business logic); gate submissions on quality gates (e.g., PR only after findings pass); multi-agent self-improvement loops (read papers/PRs, run experiments, submit PR past gate).
- Evidence: "the agent is getting verification as it's working"; "a combination of algorithmic verification looking at things like data flows, control flows, known patterns, secrets ... combined with ... agentic verification looking at intent, business logic, the unknown unknowns."; "run its own experiments and submit a PR once the findings pass a quality gate." (WF2026 Autoresearch keynotes)
- Classification: emerging. Cross-ref: eval-driven loop control; Self-Rewriting Meta-Prompt Loop (other-category).

### P18. Trace Collection as Feedback/Observability Substrate (T3)
- Problem: Without run traces you cannot debug, evaluate, or improve an agent loop.
- Pattern: Collect structured traces during runs — observations, conversations, memory writes, retrievals, belief updates — plus environment feedback (command success/failure); log all agent-user interactions; use traces as the dataset for evals and iteration.
- Evidence: "During the run, we collect structured traces, observations, conversations, memory rights, retrievals, belief updates, whatever is relevant to us in that case, we collect."; "there's also environment feedback where you know what actually happened when the code run whether the command succeeded or failed."; "if you are building an agentic app ... you should definitely be logging your agentic traces." (WF2026 Autoresearch keynotes)
- Classification: established. Cross-ref: Memory Synthesis from Execution Logs (#13).

### P19. Session-State Materialization & Memory Sharing (T3)
- Problem: Handing off long-running sessions between agents/machines loses context.
- Pattern: Materialize full session state so another agent on another machine can continue it; treat this as state transfer (state of the world attached to the session), not just narrative memory; share memories across agents.
- Evidence: "we can share our memories although we use two different agents of different machine the full state of my session kind of get materialized on their machine it kind of less memory and more about the state right the state of the world attached to the session uh you know is what enables them to continue my session." (WF2026 Autoresearch keynotes)
- Classification: emerging. Cross-ref: Filesystem-Based Agent State (#11), Cross-Agent Lesson Sharing via Git (#6).

### P20. Explicit Memory & State Policy Configuration (T3)
- Problem: Memory behavior (what to write, what to retrieve, when to replan) is implicit and unconfigurable.
- Pattern: Expose memory as policy knobs: memory writing policy, retrieval policy, trust rules, source attribution, replanning triggers — a configurable memory contract for the harness.
- Evidence: "for us that meant things like memory writing policy, retrieval policy, communication prompt, belief, trust rules, source attribution, replanning triggers, etc." (WF2026 Autoresearch keynotes, Project Paradox)
- Classification: emerging. Cross-ref: Dynamic Context Injection (#9), Context Budget as Governed Resource (#2).

## Coverage gaps (for consolidation)
- Forgetting/selective deletion: nearly absent across all three (delete/forget hits ~1-2 each) — no transcript covers memory eviction or TTL pruning.
- Persona/identity memory (Self-Identity Accumulation) and memory cascading: not addressed.
- T1 lacks RL/reasoning-loop and durable-checkpoint content; T2 lacks retrieval/memory-taxonomy content; T3 (keynotes) lacks RL reward-shaping detail and per-subsystem depth.
- Speaker attribution impossible for multi-speaker tracks (single-stream auto-captions, no speaker labels) — quotes attributed to track/video only.
- Transcript verbatim quotes contain caption fillers (uh/um) and auto-caption mis-transcriptions (e.g., "oncology" for ontology, "cloud code" for Claude Code) — preserved as-is.