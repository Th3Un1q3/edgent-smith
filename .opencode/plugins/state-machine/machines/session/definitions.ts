/**
 * The loop's behaviour: the action bodies and guard bodies the JSON workflow
 * names by type. The table in `machine.json` supplies the parameters; this
 * module supplies the code.
 */
export {
  ACTION_TYPES,
  GUARD_TYPES,
  SUBAGENT_READY,
  SUBAGENT_TIMEOUT_MS,
} from './definition-contract'
export type {
  ActionSpec,
  ActionType,
  AdHocSignal,
  CounterBelowParameters,
  EmitParentParameters,
  EnabledSignal,
  FieldPresentParameters,
  GuardSpec,
  GuardType,
  PromptParameters,
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
