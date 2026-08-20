# Batch Research Checkpoints - Storage Format and Rules

When batch-researching multiple entities across subagent sessions, store intermediate progress in
serena memory after each batch of 5 entities - never wait for the end (sessions may be interrupted,
checkpoints prevent context loss).

Format: `mem:private/<site>-research/batch-<N>-<YYYY-MM-DD>`

Checkpoint content:

    # Batch <N> - <site> research (<date>)

    ## Processed
    - entity-1: cached -> mem:private/<site>-research/...
    - entity-2: FAILED (reason)

    ## Remaining
    - entity-4 through entity-<total>

    ## Stats
    - Processed: 3/<total>
    - Cached: 2
    - Failed: 1
    - Last checkpoint: batch-2-<date>

Rules:
1. One checkpoint after every 5 entities - one write_memory call per checkpoint.
2. On session resume, read the latest checkpoint first
   (`list_memories({topic: private/<site>-research/batch-})` + read_memory) to see which entities
   are done, which failed, and where to continue.
3. After the batch completes, delete or archive intermediate checkpoints and write the final
   synthesis.
4. Checkpoint writes are lightweight - a single write_memory call. Per-entity writes add
   overhead; 5-entity batches balance freshness against cost.