/**
 * Cross-session, in-memory envelope store.
 *
 * An envelope holds a payload (full skill content) that a producing session
 * stores in a module-scope Map and a consuming session unwraps exactly once.
 * The envelope lives only for the brief window between the tool.execute.before
 * hook (parent session) and the chat.message hook (recipient session) — both
 * run in the same opencode server process, so a module-scope Map is shared
 * across sessions. No file I/O: the payload never travels through a prompt.
 */

import { randomUUID } from 'node:crypto'

export interface EnvelopeSkill {
  name: string
  mtimeMs: number
}

export interface EnvelopeMetadata {
  skills: EnvelopeSkill[]
  unresolved: string[]
}

export interface Envelope {
  key: string
  createdAt: number
  payload: string
  metadata: EnvelopeMetadata
}

/** Envelopes older than this are pruned on create to bound store growth. */
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

/** Module-scope store shared across sessions in the same opencode server process. */
const envelopes = new Map<string, Envelope>()

/**
 * Stores a payload in a new envelope and returns its key. Prunes stale entries
 * first so the store stays bounded across sessions.
 */
export async function createEnvelope(payload: string, metadata: EnvelopeMetadata): Promise<string> {
  await pruneStaleEnvelopes()
  const key = randomUUID()
  envelopes.set(key, { key, createdAt: Date.now(), payload, metadata })
  return key
}

/**
 * Delivers an envelope's payload exactly once: looks up the key, deletes the
 * entry, and returns the payload. A second call for the same key returns
 * undefined. Lookup and delete happen synchronously within the single-threaded
 * event loop, so a concurrent resolve of the same key cannot observe it twice.
 */
export async function resolveEnvelope(key: string): Promise<string | undefined> {
  const envelope = envelopes.get(key)
  if (!envelope) return undefined
  envelopes.delete(key)
  return envelope.payload
}

/**
 * Removes entries whose createdAt is older than maxAgeMs and returns how many
 * were removed. Never throws.
 */
export async function pruneStaleEnvelopes(maxAgeMs: number = DEFAULT_TTL_MS): Promise<number> {
  const now = Date.now()
  let removed = 0
  for (const [key, envelope] of envelopes) {
    const isStale = now - envelope.createdAt > maxAgeMs
    if (!isStale) continue
    envelopes.delete(key)
    removed += 1
  }
  return removed
}

/** Test-only: clears the module-scope store so tests run in isolation. */
export function __resetStoreForTests(): void {
  envelopes.clear()
}

/** Test-only: returns a stored envelope so tests can inspect stored metadata. */
export function __peekEnvelopeForTests(key: string): Envelope | undefined {
  return envelopes.get(key)
}
