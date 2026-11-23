import type { LoopContext, PromptEmit } from '../../core/machine'

import type { PromptParameters, PromptTemplate } from './definition-contract'
import { renderTemplateFile } from './template-files'
import type { TemplateId, TemplateValues } from './template-files'

const PROMPT_FALLBACK = 'Sent synthetic message: '

/**
The line a person sees beside a synthetic prompt. A prompt action supplies it;
an emit without one is named by the opening words of its text.
*/
export const promptDescription = (emit: Pick<PromptEmit, 'text' | 'description'>): string =>
  emit.description ?? PROMPT_FALLBACK + emit.text.slice(0, 20) + '...'

const sentence = (text: string): string => /[.!?]$/.test(text) ? text : text + '.'

/**
The values each template fills, with the defaults and joins the wording leaves
out. A template file names only the placeholders it uses; a key a value provider
omits is the unknown-placeholder error, so `detail` stays present as `undefined`.
*/
const IDLE_STATUS: Readonly<Record<string, string>> = {
  define_goal: 'Send SET_GOAL with the goal this session should accomplish.',
  work: 'Call signal_send with CLAIM_WORK when the current work unit is done.',
  check: 'The quality check is running; wait for its result instead of stopping.',
  validate: 'Answer the validation prompt, or send GOAL_ACHIEVED or GOAL_INCOMPLETE.',
  memorize: 'Send LESSON with what this attempt taught.',
  retrospective: 'Run the retrospective command and send RETROSPECTIVE_COMPLETE.',
}

const failureReason = (failure: LoopContext['failure']): string => failure?.reason ?? 'unknown'

const joined = (values: readonly string[] | undefined): string => values?.join(' | ') || 'none'

const TEMPLATE_VALUES: Record<TemplateId, (context: LoopContext, state: string) => TemplateValues> = {
  goal_request: () => ({}),
  idle_nudge: (_context, state) => ({ state, status: IDLE_STATUS[state] ?? 'Continue the work this state waits for.' }),
  quality_check_failed: context => ({
    reason: failureReason(context.failure),
    detail: context.failure?.detail,
  }),
  validation_self_report: () => ({}),
  memorize: context => ({ improvement: context.intent === 'improvement' }),
  panic_escalation: context => ({
    reason: failureReason(context.failure),
    detail: context.failure?.detail,
  }),
  park_summary: context => ({
    goal: sentence(context.goal),
    improvements: sentence(context.improvements.join(' | ') || 'none'),
  }),
  work_towards_goal: context => ({
    goal: context.goal,
    memories: joined(context.memories),
    preferences: joined(context.injected['preferences/user']?.full),
  }),
}

export const renderTemplate = (parameters: PromptTemplate, context: LoopContext, state = ''): string =>
  renderTemplateFile(parameters.template, TEMPLATE_VALUES[parameters.template](context, state))

const requireTemplate = (parameters: PromptParameters): PromptTemplate => {
  if ('template' in parameters) return parameters

  throw new Error('prompt action carries neither a template nor a text')
}

export const renderPrompt = (parameters: PromptParameters, context: LoopContext, state = ''): string =>
  parameters.text === undefined
    ? renderTemplate(requireTemplate(parameters), context, state)
    : parameters.text
