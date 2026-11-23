import { Effect, Exit } from 'effect'

import { describe, expect, it } from 'vitest'

import { createStateMachinePlugin } from '@plugins/state-machine'

import { boot } from '@tests/helpers/state-machine/session-loop-fixtures'

import { makeHarness } from '@tests/helpers/state-machine/harness'

describe('registration', () => {
  it('registers the signal tool in code mode', async () => {
    const harness = await boot()
    const tool = harness.tools.get('signal_send')

    expect(tool).toBeDefined()
    expect(tool?.options?.codemode).toBe(true)
  })

  it('opens the signal payload to the fields the current state declares', async () => {
    const harness = await boot()
    const input = harness.tools.get('signal_send')?.input as {
      readonly additionalProperties?: boolean
      readonly required?: readonly string[]
      readonly properties?: {
        readonly payload?: {
          readonly properties?: unknown
          readonly additionalProperties?: boolean
        }
      }
    }

    const payload: { properties?: unknown, additionalProperties?: boolean } = { ...input.properties?.payload }
    expect(payload.properties).toBeUndefined()
    expect(payload.additionalProperties).not.toBe(false)
    expect(input.additionalProperties).toBe(false)
    expect(input.required).toEqual(['type'])
  })

  it('fails the plugin load when the state library cannot load', async () => {
    const harness = makeHarness()
    const failing = createStateMachinePlugin(() => Promise.reject(new Error('library missing')))

    const exit = await Effect.runPromiseExit(Effect.scoped(failing.effect(harness.context)))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(harness.tools.size).toBe(0)
  })
})
