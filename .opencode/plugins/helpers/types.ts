/**
 * Shared plugin type definitions.
 * Keep this file types-only — no runtime logic.
 * Import via relative path in plugin source (e.g., `import type { ExportResult } from './helpers/types'`).
 */

/**
 * Result of exporting a session.
 * CQS pattern: return object with boolean fields, not boolean predicate.
 * Boolean fields use `is*` prefix to satisfy `unicorn/consistent-boolean-name`.
 */
export type ExportResult = {
  isSuccessful: boolean
  isComplete: boolean
  exitCode: number
}
