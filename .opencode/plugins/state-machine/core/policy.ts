/**
 * The tool-policy gate: the one decision function the `execute.before` hook
 * calls. The rule itself is declared in the loop definition, installed on entry
 * and cleared on exit, so the session context and its snapshot carry the policy
 * that applies; this module only decides from what it is handed.
 */
import type { LoopStateId } from './machine'
import type { ToolPolicyRule } from './snapshot'

export const GATE_AGENT = 'rug'

/**
 * The state a block names when the session's machine could not be read. No
 * machine state carries this id, so the block never claims a position the
 * session does not hold.
 */
export const UNAVAILABLE_STATE = 'unavailable'

const substitute = (text: string, token: string, value: string): string => text.split(token).join(value)

export const renderPolicyMessage = (rule: ToolPolicyRule, tool: string): string =>
  substitute(substitute(rule.errorMessage, '<name>', tool), '<state>', rule.stateId)

export interface GateInput {
  readonly agent: string
  readonly isChild: boolean
  readonly state?: LoopStateId
  readonly policy?: ToolPolicyRule
  readonly tool: string
}

export type GateDecision
  = | { readonly allowed: true }
    | { readonly allowed: false, readonly message: string }

/**
 * An absent state is a machine the gate could not read, and it blocks: allowing
 * would run the tool against a session the loop has no position for, which is
 * how a failed read became an allow.
 */
export const unavailableMessage = (tool: string, reason: string): string =>
  'Tool ' + tool + ' is blocked in ' + UNAVAILABLE_STATE
  + ': the session gate could not read the session (' + reason + ').'

/**
 * Order matters: the agent and child checks avoid a restore at all, a state
 * with no rule allows, an absent state blocks, and only then does the allowlist
 * decide.
 */
const isGateSubject = (input: GateInput): boolean =>
  input.agent === GATE_AGENT && !input.isChild

interface GatedInput extends GateInput {
  readonly state: LoopStateId
  readonly policy: ToolPolicyRule
}

const hasRule = (input: GateInput): input is GatedInput =>
  input.state !== undefined && input.policy !== undefined

const isGated = (input: GateInput): input is GatedInput =>
  isGateSubject(input) && hasRule(input)

const allowsTool = (policy: ToolPolicyRule, tool: string): GateDecision =>
  policy.allowedTools.includes(tool) ? { allowed: true } : { allowed: false, message: renderPolicyMessage(policy, tool) }

const decidesUnavailable = (input: GateInput): GateDecision =>
  input.state === undefined
    ? { allowed: false, message: unavailableMessage(input.tool, 'no-state') }
    : { allowed: true }

const decideForSubject = (input: GateInput): GateDecision =>
  isGated(input) ? allowsTool(input.policy, input.tool) : decidesUnavailable(input)

export const decide = (input: GateInput): GateDecision =>
  isGateSubject(input) ? decideForSubject(input) : { allowed: true }
