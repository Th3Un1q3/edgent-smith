/**
 * The tool-policy gate: the one decision function the `execute.before` hook
 * calls. The rule itself is declared in the loop definition, installed on entry
 * and cleared on exit, so the session context and its snapshot carry the policy
 * that applies; this module only decides from what it is handed.
 */
import type { LoopStateId } from './machine'
import type { ToolPolicyRule } from './snapshot'

export const GATE_AGENT = 'rug'

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
 * Order matters: the agent and child checks avoid a restore at all, a state
 * without a rule allows, and only then does the allowlist decide.
 */
const isGatedSession = (input: GateInput): boolean =>
  input.agent === GATE_AGENT
  && !input.isChild
  && input.state !== undefined

const isGated = (input: GateInput): input is GateInput & { readonly policy: ToolPolicyRule } =>
  isGatedSession(input) && input.policy !== undefined

export const decide = (input: GateInput): GateDecision => {
  if (!isGated(input)) return { allowed: true }
  return input.policy.allowedTools.includes(input.tool) ? { allowed: true } : { allowed: false, message: renderPolicyMessage(input.policy, input.tool) }
}
