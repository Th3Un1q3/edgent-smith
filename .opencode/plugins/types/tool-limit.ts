/**
 * Types for the tool-limit reminder (three-tier gate).
 *
 * The gate lives in `tool-limit-reminder.ts`, not a separate module: an
 * `execute.before` hook counts attempts per turn and drives three tiers —
 * REMINDER at the budget, REVIEW in the padding band, BLOCK past it.
 *
 * Thresholds derive from the agent's step budget, not from config:
 * `T = limits[agentID] ?? floor(steps * factor)`; `T + padding` is the block
 * edge. An unknown agent or a missing/non-numeric `steps` means unlimited.
 *
 * Config lives in `config/harness.config.ts` under
 * `plugins['tool-limit-reminder']`; the runtime defaults live in
 * `helpers/tool-limit.ts`.
 */

export interface ToolLimitReviewConfig {
  /**
  Run `command` on idle when a session needs review.
  */
  export: boolean
  /**
  Export command invoked with the session id; exit 0 clears review state.
  */
  command: string
  /**
  Write the rendered problems list to `.tmp/session-review/<id>/problems.md`.
  */
  writeMarkdown: boolean
}

export interface ToolLimitConfig {
  /**
  Budget multiplier: `floor(steps * factor)` sets the reminder threshold T.
  */
  factor: number
  /**
  Calls allowed past T before blocking (PADDING_TILL_ERROR); T+P is the block edge.
  */
  padding: number
  /**
  Per-agent budget override keyed by agent id; wins over `floor(steps * factor)`.
  */
  limits: Record<string, number>
  /**
  Tools never counted by either counter (e.g. 'goal').
  */
  ignoreTools: string[]
  /**
  Review/export pipeline settings.
  */
  review: ToolLimitReviewConfig
}

/**
A threshold violation collected for export. Dedupe identity is
`source:thresholdName`, so repeated crossings of one threshold append once.
*/
export interface ProblemStatement {
  source: 'skill' | 'agent'
  thresholdName: string
  expectedMax: number
  actual: number
  message: string
}
