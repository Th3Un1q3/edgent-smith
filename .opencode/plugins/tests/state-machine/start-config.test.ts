import { describe, expect, it } from 'vitest'

import { readStartConfig } from '@plugins/state-machine/core/machine'

describe('the start configuration', () => {
  it('maps known agents and reports entries naming an unknown state', () => {
    const config = readStartConfig({ rug: 'towards_goal.define_goal', broken: 'nowhere' })

    expect(config.startStateFor('rug')).toBe('towards_goal.define_goal')
    expect(config.startStateFor('broken')).toBeUndefined()
    expect(config.invalidAgents).toEqual(['broken'])
  })
})
