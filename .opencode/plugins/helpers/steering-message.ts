/**
 * Both delivery paths append one `<steering>` wrapper: the instructions loader
 * (file-visit instructions) and the quality-gate enforcer (gate results). The
 * attribute schema is `.opencode/instructions/steering-message.md`.
 */
export interface SteeringAttributes {
  readonly priority?: 'info' | 'warning' | 'high'
  readonly reason?: string
  readonly type?: 'instructions' | 'quality-gate' | 'todo'
  readonly result?: 'pass' | 'fail'
  readonly gateId?: string
}

const openTag = (attributes: SteeringAttributes): string => {
  const {
    priority = 'high',
    reason = 'relevant files touched',
    type = 'instructions',
    result,
    gateId,
  } = attributes
  const resultAttribute = result === undefined ? '' : ` result="${result}"`
  const gateAttribute = gateId === undefined ? '' : ` gate-id="${gateId}"`
  return `<steering priority="${priority}" reason="${reason}" type="${type}"${resultAttribute}${gateAttribute}>`
}

export function buildSteeringMessage(attributes: SteeringAttributes, body: string): string
export function buildSteeringMessage(body: string): string
export function buildSteeringMessage(attributesOrBody: SteeringAttributes | string, body?: string): string {
  const isBodyOnly = typeof attributesOrBody === 'string'
  const attributes = isBodyOnly ? {} : attributesOrBody
  const inner = isBodyOnly ? attributesOrBody : (body ?? '')
  return `${openTag(attributes)}\n${inner}\n</steering>`
}
