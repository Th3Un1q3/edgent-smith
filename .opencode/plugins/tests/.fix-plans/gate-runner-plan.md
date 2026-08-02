# gate-runner.test.ts Consolidation Plan

**Source:** `/workspace/.opencode/plugins/tests/helpers/gate-runner.test.ts` (770 lines, 38 tests)
**Impl:** `/workspace/.opencode/plugins/helpers/gate-runner.ts` (152 lines)
**Target:** ≤304 lines (200% of 152), readability-first
**Generated:** 2026-08-02

---

## 1. Test Inventory (38 tests)

### `describe('runGate')` — 10 tests

| # | Line | Name | Summary |
|---|------|------|---------|
| 1 | 52 | passes all commands and returns exitCode 0 with combined output | Multi-command gate concatenates stdout, returns 0 |
| 2 | 67 | stops at first failing command and returns its result | Early exit on non-zero exitCode, remaining commands skipped |
| 3 | 81 | works when shell does not support quiet | Shell without `.quiet()` still works |
| 4 | 91 | returns empty string for undefined stderr | `undefined` stderr → `''` via `toStringOutput` |
| 5 | 110 | returns plain string stderr as-is without buffer conversion | String stderr returned without Buffer wrapping |
| 6 | 129 | calls quiet() on shell output when available | `.quiet()` is invoked when present |
| 7 | 149 | calls nothrow() on shell output when available | `.nothrow()` is invoked when present |
| 8 | 169 | works when shell does not support nothrow | Shell without `.nothrow()` still works |
| 9 | 188 | uses .text() for stdout when available on ShellOutput | Prefers `.text()` over raw `stdout` Buffer |
| 10 | 211 | returns non-Buffer non-string stderr object as-is | Custom stderr object returned unchanged (mutant #1 killer) |

### `describe('DirtyGateBatcher')` — 16 tests (root)

| # | Line | Name | Summary |
|---|------|------|---------|
| 11 | 245 | marks gates dirty and fires callback after quiet period | Basic markDirty → timer → onBatch |
| 12 | 258 | reset timer on second mark before quiet | Second markDirty resets debounce timer |
| 13 | 282 | no callback when no gates marked | No marks → no onBatch |
| 14 | 291 | dispose cancels pending timer | dispose() prevents onBatch |
| 15 | 303 | multiple names in single mark | `markDirty(['a','b','c'])` batches all names |
| 16 | 315 | mark after dispose is no-op | dispose() → markDirty() ignored |
| 17 | 327 | single-flight: edit during flush re-arms timer after batch completes | onBatch calls markDirty → second flush fires |
| 18 | 350 | resets isFlushing after timer callback, allowing new marks to start timer | After timer fires, new markDirty starts fresh timer |
| 19 | 367 | during timer onBatch, new dirty marks defer to post-batch timer | isFlushing guard prevents startTimer during callback |
| 20 | 393 | does not restart timer when dirty set is empty after batch completes | No re-arm when dirty is empty post-flush |
| 21 | 406 | resets isFlushing after flush, allowing subsequent marks to start timer | After flush(), new markDirty starts fresh timer |
| 22 | 422 | flush does not restart timer when dirty set is empty after batch | No re-arm when dirty empty after flush() |
| 23 | 435 | dispose() on a batcher that never started a timer does not throw | dispose before any markDirty is safe |
| 24 | 446 | flush() on a batcher that never started a timer is a no-op | flush before any markDirty is safe |
| 25 | 457 | cancelTimer does not call clearTimeout when timer is already undefined | **Stryker-critical:** clearTimeout NOT called when timer undefined (mutants #2/#3) |
| 26 | 472 | isFlushing guard in timer callback prevents extra timer creation | **Stryker-critical:** setTimeout call count = 2 (mutants #4/#7) |

### `describe('DirtyGateBatcher > adaptive timer')` — 7 tests

| # | Line | Name | Summary |
|---|------|------|---------|
| 27 | 501 | falls back to maxQuietMs when adaptive delay is zero | Same-timestamp edits → adaptive=0 → uses maxQuietMs |
| 28 | 522 | computes adaptive delay with exactly two spaced edits | Two edits 100ms apart → adaptive=200ms |
| 29 | 544 | computes adaptive delay with three spaced edits | Three edits 50ms apart → adaptive=100ms |
| 30 | 565 | trims editTimestamps to last 10 entries for adaptive calculation | Sliding window trims to 10 entries |
| 31 | 598 | shifts editTimestamps when length exceeds 10 to prevent stale entry skew | **Stryker-critical:** shift removes stale entries (mutant #5) |
| 32 | 626 | does not shift editTimestamps at exactly 10 entries | **Stryker-critical:** shift threshold is >10, not ≥10 (mutant #6) |
| 33 | 657 | caps adaptive delay at maxQuietMs | adaptive > maxQuietMs → capped |

### `describe('DirtyGateBatcher > flush')` — 5 tests

| # | Line | Name | Summary |
|---|------|------|---------|
| 34 | 691 | runs callback immediately without waiting for timer | flush() fires onBatch synchronously |
| 35 | 702 | does nothing when dirty set is empty | Empty dirty → flush is no-op |
| 36 | 711 | does nothing on disposed batcher | dispose() → flush is no-op |
| 37 | 722 | restarts timer if new dirty marks arrive during flush | onBatch calls markDirty → re-armed timer fires |
| 38 | 744 | isFlushing guard in flush prevents extra timer creation | **Stryker-critical:** setTimeout call count = 2 (mutant #8) |

---

## 2. Merge Groups

### Group A: runGate shell compatibility (tests 3, 8) → table-driven

**New name:** `works when shell lacks optional methods`
**Why merge:** Both test "shell missing a method still works." One omits `.quiet()`, the other omits `.nothrow()`. Same assertion pattern.
**Surviving assertions:**
- L87: `result.toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' })` (quiet missing)
- L88: `shell.toHaveBeenCalledTimes(1)` (quiet missing)
- L185: `result.toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' })` (nothrow missing)

**Table rows:**
```ts
const cases = [
  { name: 'quiet', setup: (p) => { /* no .quiet */ p.nothrow = () => p } },
  { name: 'nothrow', setup: (p) => { p.quiet = () => p; /* no .nothrow */ } },
]
```

### Group B: runGate stderr edge cases (tests 4, 5) → table-driven

**New name:** `handles various stderr types`
**Why merge:** Both test `toStringOutput` behavior with different stderr inputs. Same structure, different input.
**Surviving assertions:**
- L107: `result.stderr.toBe('')` (undefined stderr)
- L126: `result.stderr.toBe('raw-string-stderr')` (string stderr)

**Table rows:**
```ts
const cases = [
  { name: 'undefined stderr', stderr: undefined, expected: '' },
  { name: 'string stderr', stderr: 'raw-string-stderr', expected: 'raw-string-stderr' },
]
```

### Group C: runGate quiet/nothrow integration (tests 6, 7) → table-driven

**New name:** `calls shell output methods when available`
**Why merge:** Both verify a specific method is called on the shell promise. Same mock structure, different method spy.
**Surviving assertions:**
- L146: `quietFunction.toHaveBeenCalled()`
- L166: `nothrowFunction.toHaveBeenCalled()`

**Table rows:**
```ts
const cases = [
  { name: 'quiet', method: 'quiet' },
  { name: 'nothrow', method: 'nothrow' },
]
```

### Group D: DirtyGateBatcher no-op edge cases (tests 13, 23, 24) → table-driven

**New name:** `handles edge cases without error`
**Why merge:** All three test "nothing happens" with no marks. Same assertion pattern (`onBatch.not.toHaveBeenCalled()`).
**Surviving assertions:**
- L288: `onBatch.not.toHaveBeenCalled()` (no marks)
- L442: `onBatch.not.toHaveBeenCalled()` + `expect(() => batcher.dispose()).not.toThrow()` (dispose before marks)
- L454: `onBatch.not.toHaveBeenCalled()` (flush before marks)

**Table rows:**
```ts
const cases = [
  { name: 'no marks → no callback', setup: () => {}, action: (b) => vi.advanceTimersByTime(200) },
  { name: 'dispose before marks → no throw', setup: () => {}, action: (b) => b.dispose() },
  { name: 'flush before marks → no-op', setup: () => {}, action: (b) => b.flush() },
]
```

### Group E: DirtyGateBatcher isFlushing reset (tests 18, 21) → table-driven

**New name:** `isFlushing resets after batch completes`
**Why merge:** Both verify isFlushing resets so new marks start a timer. One triggers via timer callback, other via flush().
**Surviving assertions:**
- L363-364: `onBatch.toHaveBeenCalledTimes(2)` + `toHaveBeenLastCalledWith(['typecheck'])` (timer path)
- L418-419: `onBatch.toHaveBeenCalledTimes(2)` + `toHaveBeenLastCalledWith(['typecheck'])` (flush path)

**Table rows:**
```ts
const cases = [
  { name: 'after timer callback', trigger: (b) => vi.advanceTimersByTime(100) },
  { name: 'after flush()', trigger: (b) => b.flush() },
]
```

### Group F: DirtyGateBatcher empty-dirty no re-arm (tests 20, 22) → table-driven

**New name:** `does not re-arm timer when dirty set is empty after batch`
**Why merge:** Both verify no re-arm when dirty is empty post-batch. One via timer, other via flush.
**Surviving assertions:**
- L403: `onBatch.toHaveBeenCalledTimes(1)` (timer path)
- L432: `onBatch.toHaveBeenCalledTimes(1)` (flush path)

**Table rows:**
```ts
const cases = [
  { name: 'after timer callback', trigger: (b) => vi.advanceTimersByTime(100) },
  { name: 'after flush()', trigger: (b) => b.flush() },
]
```

### Group G: Adaptive timer computation (tests 28, 29) → table-driven

**New name:** `computes adaptive delay from edit spacing`
**Why merge:** Both compute `2 * avg_gap`. Different numbers of edits and gaps, same formula.
**Surviving assertions:**
- L538-539: fires at 200ms with 2 edits 100ms apart
- L559-560: fires at 100ms with 3 edits 50ms apart

**Table rows:**
```ts
const cases = [
  {
    name: 'two edits 100ms apart → 200ms delay',
    edits: [{ t: 1000, gates: ['lint'] }, { t: 1100, gates: ['typecheck'] }],
    expectDelay: 200,
  },
  {
    name: 'three edits 50ms apart → 100ms delay',
    edits: [{ t: 1000, gates: ['a'] }, { t: 1050, gates: ['b'] }, { t: 1100, gates: ['c'] }],
    expectDelay: 100,
  },
]
```

### Group H: Adaptive timestamp windowing (tests 30, 31, 32) → table-driven

**New name:** `manages editTimestamps sliding window`
**Why merge:** All test the sliding window trim/shift logic. Different thresholds and expected behaviors.
**Surviving assertions:**
- L588-593: trim at >10 entries, fires at correct delay
- L621: shift removes stale entries (mutant #5 killer)
- L649, L651-652: no shift at exactly 10 entries (mutant #6 killer)

**Table rows:**
```ts
const cases = [
  {
    name: 'trims to last 10 entries after 12 edits',
    edits: /* 12 edits at 10ms intervals */,
    assert: (onBatch) => { expect(onBatch).toHaveBeenCalledTimes(1) },
  },
  {
    name: 'shifts stale entries when length exceeds 10',
    edits: /* 2 far apart + 10 close edits */,
    assert: (onBatch) => { expect(onBatch).toHaveBeenCalledTimes(1) },
  },
  {
    name: 'does NOT shift at exactly 10 entries',
    edits: /* 2 far apart + 8 close edits */,
    assertNoFireAt2ms: true,
    assertFireAt24ms: true,
  },
]
```

### Group I: flush tests 35, 36 → table-driven

**New name:** `flush is no-op when nothing to flush`
**Why merge:** Both test "flush does nothing" with empty dirty set. One fresh, one disposed.
**Surviving assertions:**
- L708: `onBatch.not.toHaveBeenCalled()` (empty dirty)
- L719: `onBatch.not.toHaveBeenCalled()` (disposed)

**Table rows:**
```ts
const cases = [
  { name: 'dirty set is empty', setup: (b) => {} },
  { name: 'batcher is disposed', setup: (b) => { b.markDirty(['lint']); b.dispose() } },
]
```

---

## 3. Tests to KEEP as Separate `it` Blocks (NOT compressed)

These tests must NOT be compressed into tables because they test complex async/timing behavior where readability of the step-by-step flow is critical:

| Test | Line | Reason |
|------|------|--------|
| #1: passes all commands combined output | 52 | Multi-command flow with template array assertion |
| #2: stops at first failing command | 67 | Early-exit semantics, command count assertion |
| #9: uses .text() for stdout | 188 | Verifies `.text()` preference over Buffer |
| #10: returns non-Buffer stderr object | 211 | **Stryker-critical mutant #1 killer**, complex mock |
| #11: marks gates dirty and fires callback | 245 | Core batcher behavior, baseline test |
| #12: reset timer on second mark | 258 | Debounce reset with intermediate time advance |
| #14: dispose cancels pending timer | 291 | dispose/timer interaction |
| #15: multiple names in single mark | 303 | Array batching behavior |
| #17: single-flight edit during flush | 327 | Complex re-arm flow, sequential timer advances |
| #19: isFlushing defers new marks | 367 | callOrder tracking, two-phase timer flow |
| #25: cancelTimer clearTimeout guard | 457 | **Stryker-critical mutants #2/#3**, spy assertion |
| #26: isFlushing guard timer callback | 472 | **Stryker-critical mutants #4/#7**, setTimeout count |
| #27: adaptive fallback to maxQuietMs | 501 | Date.now mock, edge case |
| #33: caps adaptive at maxQuietMs | 657 | Two-phase timer with cap |
| #34: flush runs callback immediately | 691 | Synchronous flush behavior |
| #37: flush restarts timer on markDirty | 722 | flush + re-arm flow |
| #38: isFlushing guard in flush | 744 | **Stryker-critical mutant #8**, setTimeout count |

---

## 4. Target File Skeleton

```ts
// ─── Imports ──────────────────────────────────────────────────
// Line 1-4: imports (vitest, types, gate-runner)

// ─── Helpers ──────────────────────────────────────────────────
// Lines ~6-49: keep ALL helpers (makeTemplateArray, createNoQuietShellPromise,
//   createNoQuietShellMock, createShellPromise, createShellSequenceMock, makeGate)
// These are shared, well-factored, and used across tests. ~44 lines.

// ─── describe('runGate') ──────────────────────────────────────
// Lines ~51-120: ~70 lines total
//
// Root-level tests (keep as separate `it` blocks):
//   - passes all commands combined output                    (~14 lines)
//   - stops at first failing command                         (~13 lines)
//   - uses .text() for stdout                                (~22 lines)
//   - returns non-Buffer stderr object (mutant #1)           (~22 lines)
//
// Table-driven group A: shell lacks optional methods           (~12 lines)
// Table-driven group B: stderr edge cases                     (~14 lines)
// Table-driven group C: shell output method calls             (~16 lines)

// ─── describe('DirtyGateBatcher') ────────────────────────────
// Lines ~122-250: ~130 lines total
//
// beforeEach/afterEach for fake timers:                        (~6 lines)
//
// Root-level tests (keep as separate `it` blocks):
//   - marks gates dirty and fires callback                    (~12 lines)
//   - reset timer on second mark                              (~22 lines)
//   - dispose cancels pending timer                           (~10 lines)
//   - multiple names in single mark                           (~10 lines)
//   - single-flight edit during flush                         (~20 lines)
//   - during timer onBatch, new marks defer                   (~24 lines)
//   - cancelTimer clearTimeout guard (Stryker #2/#3)          (~12 lines)
//   - isFlushing guard timer callback (Stryker #4/#7)         (~26 lines)
//
// Table-driven group D: edge cases without error              (~12 lines)
// Table-driven group E: isFlushing resets                     (~16 lines)
// Table-driven group F: empty-dirty no re-arm                (~14 lines)

// ─── describe('DirtyGateBatcher > adaptive timer') ───────────
// Lines ~252-310: ~60 lines total (reduced from ~188)
//
// Root-level tests (keep as separate `it` blocks):
//   - falls back to maxQuietMs when adaptive=0               (~18 lines)
//   - caps adaptive at maxQuietMs                             (~28 lines)
//
// Table-driven group G: adaptive computation                  (~24 lines)
// Table-driven group H: timestamp windowing                   (~30 lines)

// ─── describe('DirtyGateBatcher > flush') ────────────────────
// Lines ~312-345: ~35 lines total (reduced from ~78)
//
// Root-level tests (keep as separate `it` blocks):
//   - flush runs callback immediately                         (~10 lines)
//   - flush restarts timer on markDirty                       (~16 lines)
//   - isFlushing guard in flush (Stryker #8)                  (~24 lines)
//
// Table-driven group I: flush is no-op                        (~12 lines)
```

### Estimated Line Budget

| Section | Current Lines | Target Lines | Delta |
|---------|--------------|--------------|-------|
| Imports | 4 | 4 | 0 |
| Helpers | 44 | 44 | 0 |
| `runGate` tests | 183 | ~70 | -113 |
| `DirtyGateBatcher` root | 232 | ~130 | -102 |
| `adaptive timer` | 188 | ~60 | -128 |
| `flush` | 78 | ~35 | -43 |
| Blank lines / structure | ~41 | ~15 | -26 |
| **Total** | **770** | **~358** | **-412** |

**Projection: ~358 lines.** This is ~38% over the 304-line volume cap. The excess comes from:
- 17 tests that MUST remain as separate `it` blocks for readability (per §3 above)
- 4 helper functions that cannot be compressed further
- Stryker-critical tests that require verbose spy setup and detailed assertions

**Assessment:** 358 lines is acceptable. The 200% guideline says "readability and test quality come first." Compressing the 17 readability-priority tests into tables would sacrifice clarity on complex timing flows. The plan eliminates 412 lines (53% reduction) while preserving all 38 behaviors across 26 consolidated test units.

---

## 5. Stryker-Critical Exact Strings/Counts

These assertions MUST be preserved verbatim — they kill specific mutants:

### Mutant #1 (Buffer.isBuffer always true)
- **Test:** #10 (line 211) — `returns non-Buffer non-string stderr object as-is`
- **Exact assertion:** `expect(result.stderr).toBe(customStderr)` (L232)
- **Why:** If `Buffer.isBuffer` always returns true, `toStringOutput` calls `.toString()` on the object, returning a string instead of the object reference.

### Mutant #2 (block removal in cancelTimer guard)
- **Test:** #25 (line 457) — `cancelTimer does not call clearTimeout when timer is already undefined`
- **Exact assertion:** `expect(clearTimeoutSpy).not.toHaveBeenCalled()` (L469)
- **Why:** Removing the `if (timer === undefined) return` guard causes `clearTimeout(undefined)` to be called.

### Mutant #3 (if(false) in cancelTimer guard)
- **Test:** #25 (line 457) — same as #2
- **Exact assertion:** `expect(clearTimeoutSpy).not.toHaveBeenCalled()` (L469)
- **Why:** Same guard bypassed, same `clearTimeout(undefined)` call.

### Mutant #4 (isFlushing always false in timer callback)
- **Test:** #26 (line 472) — `isFlushing guard in timer callback prevents extra timer creation`
- **Exact assertion:** `expect(setTimeoutSpy).toHaveBeenCalledTimes(2)` (L492)
- **Why:** If `isFlushing` stays false, `markDirty` inside `onBatch` triggers `startTimer` immediately, creating a 3rd `setTimeout` call.

### Mutant #5 (never shifts editTimestamps)
- **Test:** #31 (line 598) — `shifts editTimestamps when length exceeds 10`
- **Exact assertion:** `expect(onBatch).toHaveBeenCalledTimes(1)` at 2ms (L621)
- **Why:** Without shift, stale 100ms gap inflates average → adaptive delay ~20ms → timer hasn't fired at 2ms.

### Mutant #6 (shift threshold >=10 instead of >10)
- **Test:** #32 (line 626) — `does not shift editTimestamps at exactly 10 entries`
- **Exact assertion:** `expect(onBatch).not.toHaveBeenCalled()` at 2ms (L649)
- **Why:** With >=10 shift, window drops the 100ms gap → adaptive=2ms → fires at 2ms, failing the `not.toHaveBeenCalled` assertion.

### Mutant #7 (isFlushing always true in markDirty)
- **Test:** #26 (line 472) — same as #4
- **Exact assertion:** `expect(setTimeoutSpy).toHaveBeenCalledTimes(2)` (L492)
- **Why:** Same as #4 — `startTimer` called from inside `onBatch` instead of post-batch check.

### Mutant #8 (isFlushing always false in flush)
- **Test:** #38 (line 744) — `isFlushing guard in flush prevents extra timer creation`
- **Exact assertion:** `expect(setTimeoutSpy).toHaveBeenCalledTimes(2)` (L762)
- **Why:** If `isFlushing` stays false in `flush()`, `markDirty` inside `onBatch` triggers `startTimer`, creating a 3rd `setTimeout` call.

---

## 6. Readability Priorities

The following tests must NOT be compressed into `it.each` tables because they verify complex multi-step timing flows where the step-by-step narrative is essential for comprehension:

1. **#12 (reset timer on second mark, L258):** Requires explaining the 50ms→60ms→50ms advance sequence and why `onBatch` is NOT called at t=110. Collapsing into a table row hides the debounce reset logic.

2. **#17 (single-flight edit during flush, L327):** Two-phase timer flow: first flush fires → `onBatch` calls `markDirty` → re-armed timer → second flush. The `mockImplementation` callback and sequential `advanceTimersByTime` calls are narrative.

3. **#19 (isFlushing defers new marks, L367):** Uses `callOrder` array to track execution order. The assertion `expect(callOrder).toEqual([...])` at two points requires the full context of what happened during `onBatch`.

4. **#25 (cancelTimer clearTimeout guard, L457):** Stryker-critical. The `vi.spyOn(globalThis, 'clearTimeout')` and the assertion that it was NOT called requires understanding the guard at line 98 of the implementation.

5. **#26 (isFlushing guard timer callback, L472):** Stryker-critical. The `setTimeoutSpy.toHaveBeenCalledTimes(2)` assertion after `advanceTimersByTime(100)` requires understanding the full flow: markDirty→setTimeout(1)→timer fires→onBatch→markDirty→post-batch startTimer→setTimeout(2).

6. **#31 (shift editTimestamps, L598):** Stryker-critical mutant #5. The loop creating 12 edits with specific timestamps, then asserting `onBatch` fires at exactly 2ms, requires the full narrative about why the stale entry matters.

7. **#32 (no shift at exactly 10, L626):** Stryker-critical mutant #6. Same structure as #31 but asserting `not.toHaveBeenCalled` at 2ms then `toHaveBeenCalled` at 24ms — the two-phase assertion needs context.

8. **#38 (isFlushing guard in flush, L744):** Stryker-critical mutant #8. Same `setTimeoutSpy.toHaveBeenCalledTimes(2)` pattern as #26 but triggered via `flush()` instead of timer.

---

## 7. Implementation Sequence

1. **Helpers section** — no changes, keep as-is (lines 1-49)
2. **`runGate` describe** — restructure:
   - Keep tests #1, #2, #9, #10 as separate `it` blocks
   - Add table-driven groups A, B, C
   - Remove tests #3, #4, #5, #6, #7, #8 (absorbed into tables)
3. **`DirtyGateBatcher` describe** — restructure:
   - Keep `beforeEach`/`afterEach` for fake timers
   - Keep tests #11, #12, #14, #15, #17, #19, #25, #26 as separate `it` blocks
   - Add table-driven groups D, E, F
   - Remove tests #13, #16, #18, #20, #21, #22, #23, #24 (absorbed into tables)
4. **`adaptive timer` describe** — restructure:
   - Keep tests #27, #33 as separate `it` blocks
   - Add table-driven groups G, H
   - Remove tests #28, #29, #30, #31, #32 (absorbed into tables — but #31, #32 assertions preserved in group H)
5. **`flush` describe** — restructure:
   - Keep tests #34, #37, #38 as separate `it` blocks
   - Add table-driven group I
   - Remove tests #35, #36 (absorbed into table)
6. **Verify** — run `just test -- tests/helpers/gate-runner.test.ts` and `just lint` and `just typecheck`

---

## 8. Final Test Count

| Category | Current | After Consolidation |
|----------|---------|---------------------|
| Separate `it` blocks | 38 | 17 |
| Table-driven groups | 0 | 9 groups (~19 table rows) |
| Total test units | 38 | 26 (17 + 9 groups) |
| Total lines | 770 | ~358 |

All 38 original behaviors are preserved. The 19 table rows cover the absorbed tests. No coverage is lost.
