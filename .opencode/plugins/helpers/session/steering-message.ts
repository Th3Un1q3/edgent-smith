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

const attribute = (name: string, value: string | undefined): string =>
  value === undefined ? '' : ` ${name}="${value}"`

const named = (name: string, value: string | undefined, fallback: string): string =>
  ` ${name}="${value ?? fallback}"`

const openTag = (attributes: SteeringAttributes): string =>
  `<steering${named('priority', attributes.priority, 'high')}`
  + `${named('reason', attributes.reason, 'relevant files touched')}`
  + `${named('type', attributes.type, 'instructions')}`
  + `${attribute('result', attributes.result)}${attribute('gate-id', attributes.gateId)}>`

export function buildSteeringMessage(attributes: SteeringAttributes, body: string): string
export function buildSteeringMessage(body: string): string
export function buildSteeringMessage(attributesOrBody: SteeringAttributes | string, body?: string): string {
  return typeof attributesOrBody === 'string' ? `${openTag({})}\n${attributesOrBody}\n</steering>` : `${openTag(attributesOrBody)}\n${body ?? ''}\n</steering>`
}
