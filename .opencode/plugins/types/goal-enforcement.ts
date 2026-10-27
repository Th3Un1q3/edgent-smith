/**
 * Types and defaults for the goal-first enforcement gate (ADR-008).
 *
 * The gate is an `execute.before` hook inside `goal-continuation.ts`, not a
 * separate plugin: it denies non-read-only tools until the agent has declared a
 * goal for the turn, and injects a capped steering nudge with the remedy.
 *
 * Config lives in `config/harness.config.ts` under `plugins['goal-continuation']`.
 */

export interface GoalEnforcementConfig {
  /**
  True: every agent is enforced unless listed in `optOut`.
  */
  enforceAll: boolean
  /**
  Enforced agent ids when `enforceAll` is false. Empty = nothing enforced.
  */
  agents: string[]
  /**
  Agent ids exempt from enforcement even under `enforceAll`.
  */
  optOut: string[]
  /**
  Tools permitted before the goal is set (read-only / non-mutating).
  */
  readOnlyAllowlist: string[]
  /**
  Max steering nudges per turn (N). Clamped to >= 0 at use; 0 keeps the denial, drops steering.
  */
  maxSteeringRepeats: number
}

// Enforcement off by default: an unconfigured gate enforces nothing.
export const DEFAULT_GOAL_ENFORCEMENT: GoalEnforcementConfig = {
  enforceAll: false,
  agents: [],
  optOut: [],
  readOnlyAllowlist: ['question', 'execute', 'read', 'glob', 'grep', 'skill'],
  maxSteeringRepeats: 3,
}
