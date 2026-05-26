# Hypothesis
Persisting Q4-quantized KV caches on-device and restoring them into the model's BatchQuantizedKVCache will reduce time-to-first-token and enable practical multi-agent context residency on constrained devices, improving end-to-end latency for multi-agent flows by at least 2x without increased memory allocation at runtime.

# Motivation
docs/ideas.md (Agent Memory Below the Prompt) identifies KV-cache persistence as high-impact for edge agents: by avoiding repeated prefill costs we can dramatically speed inference startup for agents that switch contexts or spawn subagents. This is low-cost (prototype-level changes, no model retrain) and high-impact for user-perceived latency.

# Type
Proof-of-concept + microbenchmarking experiment (implementation + measurement). Focus: infra + runtime integration, not model training.

# Mutation surface
- New prototype module: `experiments/kv_cache_persistence/kv_cache_manager.py` (persist/load Q4 safetensors)
- Small loader/injector that restores persisted KV tensors into BatchQuantizedKVCache used by local inference runtime
- Microbench scripts: `experiments/kv_cache_persistence/bench_time_to_first_token.py`
- Tests: `tests/test_kv_cache_persistence.py`
- Lightweight docs and runbook in `experiments/kv_cache_persistence/README.md`

# Implementation Instructions
1. Add `experiments/kv_cache_persistence/kv_cache_manager.py` implementing:
   - save_kv_cache(model_id, agent_id, kv_cache_path) -> writes Q4 safetensors (or compatible format) atomically
   - load_kv_cache(kv_cache_path) -> returns bytes/tensors ready for injection
   - safe-rotate policy and size cap (e.g., 32MB per agent) and optional compression flag
2. Add `experiments/kv_cache_persistence/injector.py` with an API:
   - inject_kv_cache_into_runtime(runtime, kv_bytes) that maps the persisted Q4 KV into the runtime's BatchQuantizedKVCache API (fallback to no-op if runtime lacks the interface)
3. Create `bench_time_to_first_token.py` that:
   - starts the local runtime, measures a cold-run time-to-first-token (prefill cost), persists resulting KV cache, restarts runtime, loads persisted KV cache, and measures warm-run time-to-first-token
   - run benchmarks for 1) single-agent large context, 2) spawning subagent flows (3 agents switching contexts)
4. Add test `tests/test_kv_cache_persistence.py` validating save/load roundtrip and injector no-op safety path (mock runtime)
5. Add README with how to run: `just autoresearch experiment run --name kv-cache-persistence --bench` (or equivalent pattern used by repo)
6. Keep changes isolated to `experiments/kv_cache_persistence/` and `tests/` so rollback is trivial.

# Validation (code, prompts, tasks)
- Code: unit tests pass: `pytest tests/test_kv_cache_persistence.py`
- Benchmarks: run `python experiments/kv_cache_persistence/bench_time_to_first_token.py` and collect:
  - cold TTF token (ms)
  - warm TTF token after load (ms)
  - memory overhead at rest and during injection
  - target: warm TTF <= 50% of cold TTF (>=2x improvement)
- Prompt/task: run an agentic multi-agent scenario (3 agents exchange context) and measure end-to-end latency improvement and correctness parity on short tasks (sanity prompts used by existing agent tests)

# Anticipated missteps and fallbacks
- Format incompatibility with runtime: implement loader with feature-detect; if runtime lacks BatchQuantizedKVCache, experiment falls back to a simulation mode that measures prefill reduction by mocking prefill workload.
- Persistence size/IO overhead: cap persisted cache size and add compression; benchmark both enabled/disabled.
- Privacy/IO safety: persist to a sandboxed local path controlled by the repo (experiments/tmp) and ensure files are not committed; document encryption options for later iterations.

# Sources
- docs/ideas.md — Agent Memory Below the Prompt (2603.04428)
- lines referencing KV-cache persistence and BatchQuantizedKVCache

# Notes
- Keep prototype minimal and reversible. The goal is empirical signal (does persisted Q4 KV help on-device agent flows?) not production-ready integration.
- If successful, follow-ups: integrate into harness (memory manager), add eviction policy and encrypted store, add telemetry for cache hit-rate in multi-agent flows.