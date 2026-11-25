/**
 * Pure label model for labelled subagent sessions.
 *
 * A label is a session-scoped alias bound from a name to a child session id.
 * The whole binding set lives in ONE session entry (`workflow.labels`) as a
 * JSON document. This module owns every pure decision about that document:
 * label syntax, document shape, lookup, first-bind, refusals and one-line
 * rendering. It performs no I/O and imports nothing.
 */

/**
Label syntax: max 32 chars, lowercase start, then lowercase/digit/dot/underscore/hyphen.
*/
export const LABEL_PATTERN = /^[a-z][a-z0-9._-]{0,31}$/

/**
Hard cap on bindings inside one session's label document.
*/
export const MAX_LABEL_BINDINGS = 64

export interface LabelBinding {
  label: string
  taskId: string
  boundAt: string
}

export interface LabelDocument {
  version: 1
  bindings: LabelBinding[]
}

export type ChildState = 'ok' | 'empty' | 'running' | 'error' | 'aborted' | 'unknown'

type ResumeVerdict = { ok: true } | { ok: false, reason: 'running' | 'dead', message: string }

const BINDING_KEYS = ['label', 'taskId', 'boundAt'] as const
const SESSION_ID_PREFIX = 'ses_'
const DEAD_STATES: ReadonlySet<ChildState> = new Set(['error', 'aborted'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasStringFields(row: Record<string, unknown>): boolean {
  return BINDING_KEYS.every(key => typeof row[key] === 'string')
}

function isBindingRow(value: unknown): value is LabelBinding {
  return isRecord(value) && hasStringFields(value)
}

function isLabelRow(binding: LabelBinding): boolean {
  return LABEL_PATTERN.test(binding.label) && binding.taskId !== ''
}

function readBinding(row: unknown): LabelBinding | undefined {
  if (!isBindingRow(row)) return undefined
  const binding = { label: row.label, taskId: row.taskId, boundAt: row.boundAt }
  return isLabelRow(binding) ? binding : undefined
}

function isBinding(value: LabelBinding | undefined): value is LabelBinding {
  return value !== undefined
}

function emptyDocument(): LabelDocument {
  return { version: 1, bindings: [] }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return undefined
  }
}

function isLabelDocument(value: unknown): value is { version: 1, bindings: unknown[] } {
  return isRecord(value) ? value.version === 1 && Array.isArray(value.bindings) : false
}

function collectBindings(rows: unknown[]): LabelBinding[] {
  return rows.map(row => readBinding(row)).filter(isBinding)
}

function requireLabelText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError(`label must be a string, received ${JSON.stringify(value)}`)
  }
  if (value === '') throw new TypeError('label must not be empty')
  return value
}

function toBindingRow(binding: LabelBinding): LabelBinding {
  return { label: binding.label, taskId: binding.taskId, boundAt: binding.boundAt }
}

function renderBinding(binding: LabelBinding): string {
  return `${binding.label}=${binding.taskId} (${binding.boundAt})`
}

function isDeadState(state: ChildState): boolean {
  return DEAD_STATES.has(state)
}

function runningMessage(binding: LabelBinding): string {
  return `label "${binding.label}" is bound to running child ${binding.taskId}; wait for it or dispatch under a new label`
}

function deadMessage(binding: LabelBinding, state: ChildState): string {
  return `label "${binding.label}" is dead: child ${binding.taskId} ended in "${state}"; dispatch under a new label`
}

function requireLabelSyntax(label: string): string {
  if (LABEL_PATTERN.test(label) && !label.startsWith(SESSION_ID_PREFIX)) return label
  throw new TypeError(`label ${JSON.stringify(label)} must match ${LABEL_PATTERN.source} and must not look like a session id (${SESSION_ID_PREFIX})`)
}

/**
 * Returns `value` as a label or throws TypeError. Rejects, never normalizes:
 * no trimming, no lowercasing, no underscore-for-hyphen rewrite.
 */
export function parseLabel(value: unknown): string {
  return requireLabelSyntax(requireLabelText(value))
}

/**
Compact JSON for the label document, normalized to the three known fields.
*/
export function encodeLabelDocument(document: LabelDocument): string {
  return JSON.stringify({ version: 1, bindings: document.bindings.map(binding => toBindingRow(binding)) })
}

/**
 * Tolerant decoder: absent, empty, garbage and foreign-version input yields an
 * empty document; malformed rows inside a valid document are dropped. Never throws.
 */
export function decodeLabelDocument(text: string | undefined): LabelDocument {
  if (!text) return emptyDocument()
  const parsed = safeParse(text)
  return isLabelDocument(parsed) ? { version: 1, bindings: collectBindings(parsed.bindings) } : emptyDocument()
}

export function findBinding(document: LabelDocument, label: string): LabelBinding | undefined {
  return document.bindings.find(binding => binding.label === label)
}

/**
 * Appends a row for a label not yet present. A label already bound is never
 * rebound: the document comes back unchanged (one label, one child, for the
 * session's life).
 */
export function bindLabel(document: LabelDocument, label: string, taskId: string, boundAt: string): LabelDocument {
  if (findBinding(document, label)) return document
  if (document.bindings.length >= MAX_LABEL_BINDINGS) {
    throw new RangeError(`label document is full: MAX_LABEL_BINDINGS is ${MAX_LABEL_BINDINGS}`)
  }
  return { version: 1, bindings: [...document.bindings, { label, taskId, boundAt }] }
}

/**
Refuses a running or dead child; a finished child (ok/empty) is resumed with its context.
*/
export function checkResume(binding: LabelBinding, state: ChildState): ResumeVerdict {
  if (state === 'running') {
    return { ok: false, reason: 'running', message: runningMessage(binding) }
  }
  return isDeadState(state) ? { ok: false, reason: 'dead', message: deadMessage(binding, state) } : { ok: true }
}

/**
One-line rendering for logs; empty string when nothing is bound.
*/
export function renderLabelSummary(document: LabelDocument): string {
  return document.bindings.length === 0
    ? ''
    : `labels: ${document.bindings.map(binding => renderBinding(binding)).join(', ')}`
}
