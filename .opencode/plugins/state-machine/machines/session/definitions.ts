/**
 * The loop's behaviour: the action bodies and guard bodies the JSON workflow
 * names by type, plus the values its prompt templates fill. The table in
 * `machine.json` supplies the parameters; this module supplies the code, and
 * `templates/` supplies the wording.
 */
export type { TemplateId } from './template-files'

export {
  ACTION_TYPES,
  GUARD_TYPES,
  SUBAGENT_READY,
  SUBAGENT_TIMEOUT_MS,
} from './definition-contract'
export type {
  ActionSpec,
  ActionType,
  ActivateSkillParameters,
  AdHocSignal,
  CounterBelowParameters,
  EmitParentParameters,
  EnabledSignal,
  FieldPresentParameters,
  GuardSpec,
  GuardType,
  MarkSkillParameters,
  PromptParameters,
  PromptTemplate,
  RecallMemoriesParameters,
  RecordCallbackParameters,
  RecordParameters,
  RecordSource,
  RunCommandParameters,
  RunShellParameters,
  SessionAgentParameters,
  SpawnSubagentFields,
  SpawnSubagentParameters,
  ToolsPolicyParameters,
  UpdateSignalsPolicyParameters,
  XStateRuntime,
} from './definition-contract'

export { promptDescription, renderPrompt, renderTemplate } from './prompt-templates'

export {
  createSignalRegistry,
  declaredPolicyParameters,
  SIGNAL_SCHEMAS,
  signalSpec,
  updateSignalsPolicySpecs,
} from './signal-specs'
export type { ManifestSignal, SignalSources } from './signal-specs'

export { createActions } from './action-builders'
export { createGuards } from './guard-builders'

export type { SubagentEmit } from '../../core/machine'
