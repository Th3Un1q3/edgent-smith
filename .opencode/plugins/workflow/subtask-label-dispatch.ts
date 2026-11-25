// ADR-024: labelled dispatch. A label is a session-scoped alias persisted in the
// `workflow.labels` instruction entry, which the host renders into the model
// context on every later turn, so the binding survives without extra storage.
import { Effect } from 'effect'

import { MAX_LABEL_BINDINGS, bindLabel, checkResume, decodeLabelDocument, encodeLabelDocument, findBinding } from './subtask-labels'
import type { ChildState, LabelBinding, LabelDocument } from './subtask-labels'
import { findEntry, writeEntry } from '../helpers/instructions/entry-client'
import type { EntryResult } from '../helpers/instructions/entry-client'
import { assertLabelCallAllowed } from './subtask-parameters'
import { toErrorMessage } from './subtask-log'
import type { SessionsReader } from './subtask-ls'
import type { SubtaskParameters, SubtaskResult } from './contracts'

const LABELS_KEY = 'workflow.labels'
const LABELS_SOURCE = 'workflow.plugins'
const LABELS_PRIORITY = 1

const failureCause = (result: EntryResult): string => result.error ?? result.reason ?? 'unknown error'

const isEntryText = (value: unknown): value is { text: string } =>
  typeof value === 'object' && value !== null && typeof (value as { text?: unknown }).text === 'string'

const entryText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : (isEntryText(value) ? value.text : undefined)

export const readLabels = async (sessionID: string, directory: string): Promise<LabelDocument> => {
  const entry = await findEntry(sessionID, LABELS_KEY, directory)
  return decodeLabelDocument(entryText(entry?.value))
}

const writeLabels = (sessionID: string, directory: string, document: LabelDocument): Promise<EntryResult> =>
  writeEntry(sessionID, LABELS_KEY, {
    text: encodeLabelDocument(document),
    source: LABELS_SOURCE,
    priority: LABELS_PRIORITY,
  }, undefined, directory)

// Process-local serialization per session+label and per session+bind; the entry
// stays the state of record. The label key stops two dispatches on one label from
// creating two children; the bind key stops two binds from replacing each other's
// rows, since a bind rewrites the whole label document.
const processLocks = new Map<string, Promise<void>>()

// ES2022 is the compile target, so `Promise.withResolvers` is reached through
// its runtime shape rather than the lib declaration.
const makeGate = (): { promise: Promise<void>, resolve: () => void } => {
  const raw = (Promise as unknown as {
    withResolvers(): { promise: Promise<void>, resolve: (value?: void) => void }
  }).withResolvers()
  return { promise: raw.promise, resolve: () => raw.resolve() }
}

const acquireLock = async (key: string): Promise<() => void> => {
  const previous = processLocks.get(key) ?? Promise.resolve()
  const gate = makeGate()
  const queue = async (): Promise<void> => {
    await previous
    await gate.promise
  }
  processLocks.set(key, queue())
  await previous
  return gate.resolve
}

const withLock = <A>(key: string, body: () => Effect.Effect<A>): Effect.Effect<A> =>
  Effect.gen(function* () {
    const release = yield* Effect.promise(() => acquireLock(key))
    try {
      return yield* body()
    }
    finally {
      release()
    }
  })

const labelLockKey = (sessionID: string, label: string): string => `${sessionID}\u{0}label\u{0}${label}`
const bindLockKey = (sessionID: string): string => `${sessionID}\u{0}bind`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const childRecord = (value: unknown): Record<string, unknown> => {
  const record = isRecord(value) ? value : {}
  return isRecord(record.data) ? record.data : record
}

const CHILD_STATES: Readonly<Record<string, ChildState>> = { succeeded: 'ok', failed: 'error', interrupted: 'aborted' }

const childStateOf = (value: unknown): ChildState => {
  const outcome = childRecord(value).outcome
  return typeof outcome === 'string' ? CHILD_STATES[outcome] ?? 'unknown' : 'running'
}

const readChildState = (reader: SessionsReader, taskId: string): Effect.Effect<ChildState> => {
  const read = reader.get
  const raw = typeof read === 'function' ? read.call(reader, { sessionID: taskId }) : undefined
  const settled = Effect.isEffect(raw) ? (raw as Effect.Effect<unknown>) : Effect.promise(() => Promise.resolve(raw))
  return settled.pipe(Effect.map(value => childStateOf(value)))
}

const withoutLabel = (parameters: SubtaskParameters): SubtaskParameters => ({ ...parameters, label: undefined })

const withTaskId = (parameters: SubtaskParameters, taskId: string): SubtaskParameters =>
  ({ ...withoutLabel(parameters), task_id: taskId })

const labelError = (label: string, taskId: string, error: string): SubtaskResult =>
  ({ outputText: '', task_id: taskId, label, status: 'error', error, durationMs: 0 })

const bindSuccess = (label: string, child: SubtaskResult): Effect.Effect<SubtaskResult> =>
  Effect.logInfo('workflow.labels.bound', { label, taskId: child.task_id }).pipe(Effect.as({ ...child, label }))

const bindFailure = (label: string, taskId: string, write: EntryResult): Effect.Effect<SubtaskResult> => {
  const cause = failureCause(write)
  return Effect.logError('workflow.labels.bind_failed', { label, taskId, cause }).pipe(
    Effect.as(labelError(label, taskId, `label "${label}" bound to child ${taskId} but the binding write failed: ${cause}; continue by task_id`)),
  )
}

export interface LabelDispatchDependencies {
  parameters: SubtaskParameters
  label: string
  sessionID: string
  directory: string
  reader: SessionsReader
  run: (parameters: SubtaskParameters, signal: AbortSignal) => Promise<SubtaskResult>
}

// A refused call reports no child, so the task_id the caller passed has to live
// in the message: the label+task_id refusal names the bound child to act on.
const refusalMessage = (message: string, taskId: string | undefined): string =>
  taskId !== undefined && message.startsWith('label_task_conflict')
    ? `${message}; bound child is ${taskId}, so drop label to resume it or drop task_id to bind a new one`
    : message

// The dispatch strips `label` before the shared normalizer runs, so this is the
// only place the label syntax and the task_id/fork_from exclusions can fire.
const labelRefusal = (dependencies: LabelDispatchDependencies): SubtaskResult | undefined => {
  try {
    assertLabelCallAllowed(dependencies.label, dependencies.parameters)
    return undefined
  }
  catch (error) {
    const message = refusalMessage(toErrorMessage(error), dependencies.parameters.task_id)
    return labelError(dependencies.label, '', message)
  }
}

const bindLocked = (dependencies: LabelDispatchDependencies, child: SubtaskResult): Effect.Effect<SubtaskResult> =>
  Effect.gen(function* () {
    const document = yield* Effect.promise(() => readLabels(dependencies.sessionID, dependencies.directory))
    const taskId = child.task_id
    if (document.bindings.length >= MAX_LABEL_BINDINGS) {
      yield* Effect.logError('workflow.labels.bind_failed', { label: dependencies.label, taskId, cause: 'full' })
      return labelError(dependencies.label, taskId, `label "${dependencies.label}" cannot be bound to child ${taskId}: label document is full; continue by task_id`)
    }
    const bound = bindLabel(document, dependencies.label, taskId, new Date().toISOString())
    const write = yield* Effect.promise(() => writeLabels(dependencies.sessionID, dependencies.directory, bound))
    return write.status === 'failed'
      ? yield* bindFailure(dependencies.label, taskId, write)
      : yield* bindSuccess(dependencies.label, child)
  })

const bindChild = (dependencies: LabelDispatchDependencies, child: SubtaskResult): Effect.Effect<SubtaskResult> =>
  withLock(bindLockKey(dependencies.sessionID), () => bindLocked(dependencies, child))

const resumeBound = (dependencies: LabelDispatchDependencies, binding: LabelBinding | undefined): Effect.Effect<SubtaskResult | undefined> =>
  Effect.gen(function* () {
    if (binding === undefined) return
    const verdict = checkResume(binding, yield* readChildState(dependencies.reader, binding.taskId))
    if (!verdict.ok) return labelError(binding.label, binding.taskId, verdict.message)
    yield* Effect.logInfo('workflow.labels.resumed', { label: binding.label, taskId: binding.taskId })
    const resumed = yield* Effect.promise(signal => dependencies.run(withTaskId(dependencies.parameters, binding.taskId), signal))
    return { ...resumed, label: binding.label }
  })

const dispatchLocked = (dependencies: LabelDispatchDependencies): Effect.Effect<SubtaskResult> =>
  Effect.gen(function* () {
    const document = yield* Effect.promise(() => readLabels(dependencies.sessionID, dependencies.directory))
    const resumed = yield* resumeBound(dependencies, findBinding(document, dependencies.label))
    return resumed === undefined ? (yield* bindChild(dependencies, yield* Effect.promise(signal => dependencies.run(withoutLabel(dependencies.parameters), signal)))) : resumed
  })

export const runLabelled = (dependencies: LabelDispatchDependencies): Effect.Effect<SubtaskResult> =>
  Effect.gen(function* () {
    const refused = labelRefusal(dependencies)
    return refused === undefined ? (yield* withLock(labelLockKey(dependencies.sessionID, dependencies.label), () => dispatchLocked(dependencies))) : refused
  })
