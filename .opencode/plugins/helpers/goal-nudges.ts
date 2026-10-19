/**
 * Idle-loop timing constant for goal-continuation (ADR-008).
 *
 * Lives in helpers/ rather than the plugin root because plugin entry files may
 * only export Plugin-typed values (eslint plugin-export-guard).
 */
export const MAX_NUDGES = 3
