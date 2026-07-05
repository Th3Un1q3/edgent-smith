import { vi } from 'vitest'
import type { OpencodeClient } from '@opencode-ai/sdk'

type DeepMockOverride<T> = {
  [K in keyof T]?: T[K] extends (...args: infer A) => infer R
    ? import('vitest').MockedFunction<(...args: A) => R>
    : T[K] extends object
      ? DeepMockOverride<T[K]>
      : T[K]
}

/**
 * Creates a typed OpencodeClient mock where every accessed method is a
 * Vitest mock function. Optional overrides can replace specific methods or
 * nested service objects.
 */
export function createOpencodeClientMock(
  overrides: DeepMockOverride<OpencodeClient> = {},
): OpencodeClient {
  const createProxy = (levelOverrides: unknown): unknown => {
    return new Proxy(() => {}, {
      get(_target, prop) {
        const override = (levelOverrides as Record<PropertyKey, unknown> | undefined)?.[prop]
        if (override !== undefined) {
          if (typeof override === 'function') {
            return override
          }
          return createProxy(override)
        }
        return createProxy(undefined)
      },
      apply(_target, _thisArg, args) {
        if (typeof levelOverrides === 'function') {
          return levelOverrides.apply(_thisArg, args)
        }
        return undefined
      },
    })
  }

  return createProxy(overrides) as OpencodeClient
}
