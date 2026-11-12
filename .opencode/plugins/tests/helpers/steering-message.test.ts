import { describe, expect, it } from 'vitest'

import { buildSteeringMessage } from '@plugins/helpers/steering-message'

describe('buildSteeringMessage', () => {
  it('renders priority, reason, and type from explicit attributes', () => {
    const rendered = buildSteeringMessage(
      { priority: 'warning', reason: 'ran quality checks', type: 'quality-gate' },
      'gate body',
    )

    expect(rendered).toBe(
      '<steering priority="warning" reason="ran quality checks" type="quality-gate">\ngate body\n</steering>',
    )
  })

  it('emits result and gate-id only when they are present', () => {
    const withBoth = buildSteeringMessage(
      { priority: 'warning', reason: 'r', type: 'quality-gate', result: 'fail', gateId: 'lint' },
      'x',
    )

    expect(withBoth).toContain('result="fail" gate-id="lint"')

    const withNeither = buildSteeringMessage({ priority: 'info', reason: 'r', type: 'quality-gate' }, 'x')

    expect(withNeither).not.toContain('result=')
    expect(withNeither).not.toContain('gate-id=')
  })

  it('wraps the body in one leading and one trailing newline', () => {
    const rendered = buildSteeringMessage({}, 'body')

    expect(rendered).toBe(
      '<steering priority="high" reason="relevant files touched" type="instructions">\nbody\n</steering>',
    )
  })

  it('defaults to the instruction attributes when called with a body only', () => {
    const rendered = buildSteeringMessage('<instruction></instruction>')

    expect(rendered).toBe(
      '<steering priority="high" reason="relevant files touched" type="instructions">\n<instruction></instruction>\n</steering>',
    )
  })
})
