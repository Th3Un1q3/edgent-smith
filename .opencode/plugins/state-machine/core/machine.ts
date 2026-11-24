/**
 * The session state machine's public surface: the loop, the machines, and the
 * messages they send. The entry file only registers this with opencode.
 */
export type { CallbackPayload, Failure, InjectedMemories, IntentKind, LoopContext } from '../machines/session/context'

export {
  callbackEvent,
  INTERRUPT_REASONS,
  promptDescription,
  RETROSPECTIVE_COMPLETE,
  signalEvent,
} from './machine-contract'
export type {
  ActionSpec,
  Actor,
  AssembledMachine,
  CallbackEventType,
  CallbackName,
  CommandEmit,
  DispatchEmit,
  EmitRequest,
  GuardSpec,
  InterruptReason,
  LoopArm,
  LoopDefinition,
  LoopEvent,
  LoopEventType,
  LoopOn,
  LoopState,
  LoopStateId,
  MachineContext,
  MemoriesEmit,
  PromptEmit,
  SessionMachine,
  ShellEmit,
  SignalRequest,
  SignalsEmit,
  SignalsPolicy,
  SkillEmit,
  StateMachineLibrary,
  SubagentEmit,
  SystemInterrupted,
  ToolSignal,
} from './machine-contract'

export {
  acceptedTransitions,
  assembleMachine,
  LOOP_STATE_IDS,
  LOOP_STATE_PATHS,
  readStartConfig,
  SESSION_LOOP,
  SESSION_MACHINE,
  TOOL_SIGNALS,
} from './machine-assembly'

export { loadStateMachineLibrary } from './machine-library'

export { createStateMachine } from './machine-service'
export type {
  InjectSkill,
  LoadMemories,
  MachineHandle,
  RunShell,
  SessionIdentity,
  SessionStart,
  SignalResult,
  StateMachine,
  UnavailableReason,
} from './machine-service'
export { MachineUnavailable } from './machine-service'
