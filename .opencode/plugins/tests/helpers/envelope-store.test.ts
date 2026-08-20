// Tests for envelope-store — see plugins/helpers/envelope-store.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  DEFAULT_TTL_MS,
  createEnvelope,
  hasEnvelope,
  pruneStaleEnvelopes,
  resolveEnvelope,
  __peekEnvelopeForTests,
  __resetStoreForTests,
} from '@plugins/helpers/envelope-store'

import type { EnvelopeMetadata } from '@plugins/helpers/envelope-store'

const makeMetadata = (overrides?: Partial<EnvelopeMetadata>): EnvelopeMetadata => ({
  skills: [{ name: 'skill-a', mtimeMs: 100 }],
  unresolved: ['missing-skill'],
  ...overrides,
})

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('envelope-store', () => {
  beforeEach(() => {
    __resetStoreForTests()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createEnvelope', () => {
    it('round-trips the payload byte-identically through resolveEnvelope', async () => {
      const payload = '# Skill A\n\nBody with unicode: ünïcode 🚀\nline2'

      const key = await createEnvelope(payload, makeMetadata())

      expect(await resolveEnvelope(key)).toBe(payload)
    })

    it('returns a unique UUID key for each envelope', async () => {
      const firstKey = await createEnvelope('payload-1', makeMetadata())
      const secondKey = await createEnvelope('payload-2', makeMetadata())

      expect(firstKey).toMatch(UUID_PATTERN)
      expect(secondKey).toMatch(UUID_PATTERN)
      expect(secondKey).not.toBe(firstKey)
    })

    it('stores the metadata alongside the payload', async () => {
      const metadata = makeMetadata({
        skills: [
          { name: 'skill-a', mtimeMs: 100 },
          { name: 'skill-b', mtimeMs: 200 },
        ],
        unresolved: ['skill-c', 'skill-d'],
      })

      const key = await createEnvelope('payload', metadata)

      expect(__peekEnvelopeForTests(key)?.metadata).toEqual(metadata)
    })

    it('prunes entries older than the default TTL before storing a new envelope', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

      const staleKey = await createEnvelope('stale', makeMetadata())

      vi.setSystemTime(new Date('2026-01-03T00:00:00Z'))

      const freshKey = await createEnvelope('fresh', makeMetadata())

      expect(await resolveEnvelope(freshKey)).toBe('fresh')
      expect(await resolveEnvelope(staleKey)).toBeUndefined()
    })
  })

  describe('resolveEnvelope', () => {
    it('deletes the envelope on resolve (one-time semantics)', async () => {
      const key = await createEnvelope('payload', makeMetadata())

      expect(await resolveEnvelope(key)).toBe('payload')
      expect(await resolveEnvelope(key)).toBeUndefined()
      expect(__peekEnvelopeForTests(key)).toBeUndefined()
    })

    it('returns undefined for a never-created key without throwing', async () => {
      await expect(resolveEnvelope('00000000-0000-4000-8000-000000000000')).resolves.toBeUndefined()
    })

    it('resolves concurrent envelopes independently', async () => {
      const firstKey = await createEnvelope('payload-1', makeMetadata())
      const secondKey = await createEnvelope('payload-2', makeMetadata())

      expect(firstKey).not.toBe(secondKey)
      expect(await resolveEnvelope(firstKey)).toBe('payload-1')
      expect(await resolveEnvelope(secondKey)).toBe('payload-2')
      expect(await resolveEnvelope(firstKey)).toBeUndefined()
    })
  })

  describe('hasEnvelope', () => {
    it('returns true right after createEnvelope and false after resolveEnvelope consumes it', async () => {
      const key = await createEnvelope('payload', makeMetadata())

      expect(await hasEnvelope(key)).toBe(true)
      expect(await resolveEnvelope(key)).toBe('payload')
      expect(await hasEnvelope(key)).toBe(false)
      expect(__peekEnvelopeForTests(key)).toBeUndefined()
    })

    it('returns false for a never-created key without throwing', async () => {
      await expect(hasEnvelope('00000000-0000-4000-8000-000000000000')).resolves.toBe(false)
    })

    it('does not consume the envelope: resolve after hasEnvelope still returns the payload', async () => {
      const key = await createEnvelope('payload', makeMetadata())

      expect(await hasEnvelope(key)).toBe(true)
      expect(await hasEnvelope(key)).toBe(true)
      expect(await resolveEnvelope(key)).toBe('payload')
      expect(await hasEnvelope(key)).toBe(false)
    })
  })

  describe('pruneStaleEnvelopes', () => {
    it('removes only envelopes older than maxAgeMs and keeps fresh ones', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

      const staleKey = await createEnvelope('stale', makeMetadata())

      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))

      const freshKey = await createEnvelope('fresh', makeMetadata())

      vi.setSystemTime(new Date('2026-01-01T00:00:15Z'))

      const removed = await pruneStaleEnvelopes(10_000)

      expect(removed).toBe(1)
      expect(await resolveEnvelope(staleKey)).toBeUndefined()
      expect(await resolveEnvelope(freshKey)).toBe('fresh')
    })

    it('removes an envelope when maxAgeMs is negative', async () => {
      const key = await createEnvelope('payload', makeMetadata())

      const removed = await pruneStaleEnvelopes(-1)

      expect(removed).toBe(1)
      expect(await resolveEnvelope(key)).toBeUndefined()
    })

    it('keeps fresh envelopes when maxAgeMs is large', async () => {
      const key = await createEnvelope('payload', makeMetadata())

      const removed = await pruneStaleEnvelopes(DEFAULT_TTL_MS)

      expect(removed).toBe(0)
      expect(await resolveEnvelope(key)).toBe('payload')
    })

    it('returns 0 without throwing on an empty store', async () => {
      await expect(pruneStaleEnvelopes()).resolves.toBe(0)
    })
  })
})
