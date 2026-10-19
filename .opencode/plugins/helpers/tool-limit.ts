/**
 * Runtime budget resolution for the tool-limit gate.
 *
 * `limits[id]` wins over `floor(steps * factor)`; an absent or non-numeric step
 * budget with no override is unlimited (`undefined`). Defaults live here rather
 * than in `types/`, which holds interfaces only.
 */
import type { ToolLimitConfig } from '../types/tool-limit'

/**
Fallback when the `tool-limit-reminder` config section is missing or partial:
`goal` is exempt from counting, no per-agent overrides.
*/
export const DEFAULT_TOOL_LIMIT: ToolLimitConfig = {
  factor: 0.8,
  padding: 2,
  limits: {},
  ignoreTools: ['goal'],
  review: {
    export: true,
    command: 'just agent_utils/export-opencode-session',
    writeMarkdown: true,
  },
}

/**
Resolves the reminder threshold T for one agent: an explicit `limits` override
first, then `floor(steps * factor)`. `undefined` means unlimited, so an
unconfigured gate cannot block a call it has no budget for.
*/
export const resolveBudget = (
  agentID: string,
  steps: number | undefined,
  limits: Record<string, number>,
  factor: number,
): number | undefined =>
  limits[agentID] ?? (steps === undefined ? undefined : Math.floor(steps * factor))
