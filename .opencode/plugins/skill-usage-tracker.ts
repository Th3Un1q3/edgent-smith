/**
 * skill-usage-tracker — PROTOTYPE (review me before implementing the real logic)
 *
 * Tracks which configured skills a session loaded and how many steps the session took,
 * then writes a ProblemStatement into the shared `sessionReview` key the moment a
 * skill's step threshold is crossed (no idle-time evaluation; tool-limit-reminder
 * collects review problems at session.idle).
 *
 * Prototype scope: hook wiring + SessionStorage plumbing + config import are REAL;
 * business logic is implemented (skill load detection, step counting, threshold
 * crossing → ProblemStatement writes via the shared review helper).
 *
 * Hooks (4): chat.message, tool.execute.after, tool.execute.before, dispose
 * State: SessionStorage under 'skillUsageTracker' namespace, persisted to
 *        .opencode/plugins/sessions/{sessionID}.json
 * Config: .opencode/plugins/config/harness.config.ts (modular eslint-style)
 *
 * Plugin system interfaces (source of truth for hook/type shapes):
 *   - .opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts — Plugin (:51),
 *     PluginInput (:36-46), chat.message (:187-199),
 *     tool.execute.before (:235-241), tool.execute.after (:249-258), dispose (:174)
 *   - .opencode/node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts — ToolPart (:263-274),
 *     TextPart (:142-157), StepStartPart (:275-281), StepFinishPart (:282-299), Part (:345-353)
 *
 * Conventions & test infra:
 *   - .opencode/plugins/AGENTS.md — naming, quality gates, import style
 *   - .opencode/plugins/tests/AGENTS.md — 1:1 test mapping
 *   - .opencode/instructions/opencode-plugin-interfaces.instructions.md — Rule 1 namespacing
 *   - .opencode/justfile — test/lint/typecheck recipes
 *   - Tests: .opencode/plugins/tests/skill-usage-tracker.test.ts
 *   - Test helpers: .opencode/plugins/tests/helpers/mock-utilities.ts,
 *     .opencode/plugins/tests/__utils/kv-store.mock.ts
 *
 * Reference patterns:
 *   - SessionStorage: .opencode/plugins/helpers/kv-store.ts (SessionStorage, FileSystemSessionStorageAdapter)
 *   - Session storage usage: .opencode/plugins/session-tracker.ts (readState + updateState pattern)
 *   - Review collection at idle: .opencode/plugins/tool-limit-reminder.ts (session.idle → export + problems.md)
 *   - Skill XML format: .opencode/plugins/skills-loader.ts:96-108 (<task_skills>/<skill name=...>)
 *   - Config: .opencode/plugins/config/harness.config.ts (modular eslint-style)
 *   - Session data: .agents/skills/session-insights/references/schema.md
 */

import type { Plugin, PluginInput } from '@opencode-ai/plugin'
import { SessionStorage, FileSystemSessionStorageAdapter } from './helpers/kv-store'
import { log } from './helpers/logger'
import { addProblem, skillProblemStatement } from './helpers/review'
import { harnessConfig } from './config/harness.config'

// ── Module-level constants ───────────────────────────────────────────────────

/** Session storage namespace key per Rule 1 of opencode-plugin-interfaces.instructions.md */
const NAMESPACE = 'skillUsageTracker'

/** Fallback thresholds when config section is absent from harness.config.ts */
const DEFAULT_THRESHOLDS: Record<string, number> = {}

// ── State model ──────────────────────────────────────────────────────────────

interface SkillLoadInfo {
  source: 'tool' | 'prompt'
  loadedAtStep: number
}

interface SkillUsageTrackerState {
  stepCount: number
  loadedSkills: Record<string, SkillLoadInfo>
}

// ── Config loading (real plumbing — reads harness.config.ts section) ─────────

/**
 * Reads the 'skill-usage-tracker' section from .opencode/plugins/config/harness.config.ts
 * (modular eslint-style config). Falls back to empty object if section is absent.
 *
 * REAL: This is not a stub — it's a trivial property lookup that reads the actual config.
 * Test: L262 — reads per-skill thresholds from harness.config.ts (real-config integration, generic over Object.entries)
 */
function loadThresholdConfig(): Record<string, number> {
  return harnessConfig.plugins['skill-usage-tracker']?.thresholds ?? DEFAULT_THRESHOLDS
}

// ── State helpers (real plumbing — SessionStorage read/write under namespace) ─

/**
 * Reads tracked state under the NAMESPACE key from session storage.
 * Returns null if no state has been persisted yet (first message / fresh session).
 *
 * REAL: Uses SessionStorage.readState from kv-store.ts:50-54.
 * Pattern: session-tracker.ts readState usage (e.g., L33-36 reading toolCalls field).
 */
async function readTrackedState(storage: SessionStorage, sessionID: string): Promise<SkillUsageTrackerState | undefined> {
  return storage.readState<Record<string, unknown>, SkillUsageTrackerState | undefined>(
    sessionID,
    s => s[NAMESPACE] as SkillUsageTrackerState | undefined,
  )
}

/**
 * Writes tracked state under the NAMESPACE key to session storage.
 * Preserves all other keys in the session state object (Rule 3: preserve existing state).
 *
 * REAL: Uses SessionStorage.updateState from kv-store.ts:56-61.
 * Pattern: session-tracker.ts updateState usage (e.g., L10-14 setSessionField).
 * Pattern: tool-limit-reminder.ts updateState usage (e.g., L114-117 clearing needsReview).
 */
async function writeTrackedState(storage: SessionStorage, sessionID: string, state: SkillUsageTrackerState): Promise<void> {
  storage.updateState(sessionID, (s: Record<string, unknown>): Record<string, unknown> => ({
    ...s,
    [NAMESPACE]: state,
  }))
}

// ── Business logic ────────────────────────────────────────────────────────────
//
// Functions below detect skill loads, count steps, and evaluate thresholds.
// All functions have been implemented from their original stubs.

function extractSkillNamesFromPrompt(parts: unknown[]): string[] {
  const names = new Set<string>()
  const pattern = /<skill\s+name="([^"]+)"/g
  for (const part of parts) {
    const part_ = part as { type?: unknown, text?: unknown }
    if (part_.type !== 'text' || typeof part_.text !== 'string') continue
    let match: RegExpExecArray | null
    while ((match = pattern.exec(part_.text)) !== null) {
      names.add(match[1])
    }
  }
  return [...names]
}

function extractSkillNameFromToolCall(arguments_: unknown): string | undefined {
  const name = (arguments_ as { name?: string }).name
  return typeof name === 'string' ? name : undefined
}

function isInitialUserMessage(state: SkillUsageTrackerState | undefined): boolean {
  return state === undefined
}

function countStep(s: SkillUsageTrackerState): SkillUsageTrackerState {
  return { ...s, stepCount: s.stepCount + 1 }
}

function recordSkillLoad(s: SkillUsageTrackerState, name: string, source: 'tool' | 'prompt'): SkillUsageTrackerState {
  if (Object.hasOwn(s.loadedSkills, name)) return s // first load wins — preserve loadedAtStep
  return {
    ...s,
    loadedSkills: {
      ...s.loadedSkills,
      [name]: { source, loadedAtStep: s.stepCount },
    },
  }
}

function getMaxSteps(config: Record<string, number>, skillName: string): number | undefined {
  // REAL: Simple key lookup from config.thresholds. Not mocked because this is trivial.
  // Test: used by crossing-time evaluation; returns undefined for unconfigured skills → skip.
  return config[skillName]
}

// ── Plugin factory ────────────────────────────────────────────────────────────

export const skillUsageTracker: Plugin = async ({ client }: PluginInput, options?: { thresholds?: Record<string, number> }) => {
  const storage = new SessionStorage(new FileSystemSessionStorageAdapter())
  // Injected thresholds (tests / programmatic use) take precedence over the real
  // harness.config; opencode runtime calls with PluginInput only → backward compatible.
  const config = options?.thresholds ?? loadThresholdConfig()
  await log(client, 'info', 'init', 'skill-usage-tracker')

  return {
    // ── Hook 1: chat.message — detect skill loads from initial user prompt ──────
    //
    // Scans the FIRST user message text parts for <skill name="${name}"> XML markers.
    // Skill XML format: skills-loader.ts:96-108 (<task_skills>/<skill name=...>)
    // Hook signature: plugin/dist/index.d.ts:187-199
    // Test: L11 (prompt-loaded skill), L27-28 (from first message)
    'chat.message': async (input, output) => {
      const state = await readTrackedState(storage, input.sessionID)
      if (!isInitialUserMessage(state)) return

      const names = extractSkillNamesFromPrompt(output.parts as unknown[])
      if (names.length === 0) return

      const current = state ?? { stepCount: 0, loadedSkills: {} }
      let next = current
      for (const name of names) {
        next = recordSkillLoad(next, name, 'prompt')
      }
      await writeTrackedState(storage, input.sessionID, next)
    },

    // ── Hook 2: tool.execute.after — detect skill loads from actual skill tool ───
    //
    // Detects skills loaded via the skill tool AFTER execution completes.
    // tool.execute.after guarantees the skill was actually loaded (vs before which doesn't).
    // ToolPart.state.input.name: sdk types.gen.d.ts:263-274
    // Hook signature: plugin/dist/index.d.ts:249-258
    // Test: L10 (tool-loaded skill), L22-24 (re-load — first load wins)
    'tool.execute.after': async (input, _output) => {
      if (input.tool !== 'skill') return

      const name = extractSkillNameFromToolCall(input.args)
      if (name === undefined) return

      const state = await readTrackedState(storage, input.sessionID)
      const current = state ?? { stepCount: 0, loadedSkills: {} }
      const next = recordSkillLoad(current, name, 'tool')
      await writeTrackedState(storage, input.sessionID, next)
    },

    // ── Hook 3: tool.execute.before — count steps for non-skill tool calls ──────
    //
    // Per FIXME L9 in test: step = number of tool calls, EXCEPT when tool is 'skill'.
    // Skill calls skip counting (they don't contribute to the step budget).
    // Only counts when tracked state already exists (chat.message or prior tool calls
    // have initialized it).
    // Pattern: tool-limit-reminder.ts:64 in-memory counter (persisted here via SessionStorage)
    // Hook signature: plugin/dist/index.d.ts:235-241
    'tool.execute.before': async (input, _output) => {
      if (input.tool === 'skill') return

      const state = await readTrackedState(storage, input.sessionID)
      if (!state) return

      const next = countStep(state)
      await writeTrackedState(storage, input.sessionID, next)

      // Crossing-time review: each loaded skill whose threshold is now exceeded
      // writes a ProblemStatement via the shared review helper. addProblem dedupes
      // by `source:thresholdName`, so repeated checks after the crossing are no-ops.
      for (const [skillName, info] of Object.entries(next.loadedSkills)) {
        const maxSteps = getMaxSteps(config, skillName)
        if (maxSteps === undefined) continue // unconfigured skill — no threshold to cross

        const actual = next.stepCount - info.loadedAtStep
        if (actual > maxSteps) {
          addProblem(storage, input.sessionID, skillProblemStatement(skillName, maxSteps, actual))
        }
      }
    },

    // ── Hook 4: dispose — cleanup on plugin unload ──────────────────────────────
    //
    // Hook signature: plugin/dist/index.d.ts:174
    'dispose': async () => {
      await log(client, 'info', 'dispose', 'skill-usage-tracker')
    },
  }
}
