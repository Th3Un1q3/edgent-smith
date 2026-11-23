import { toErrorMessage } from './subtask-log'
import type { LogFunction, WorkflowSdkClient, WorkflowSessionMessage } from './contracts'

export interface ParentModel {
  providerID: string
  modelID: string
}

interface ModelFields {
  providerID?: unknown
  modelID?: unknown
}

const isParentModel = (candidate: ModelFields): candidate is ParentModel =>
  typeof candidate.providerID === 'string' && typeof candidate.modelID === 'string'

const modelFields = (source: ModelFields = {}): ParentModel | undefined =>
  isParentModel(source) ? { providerID: source.providerID, modelID: source.modelID } : undefined

const extractModel = (info: WorkflowSessionMessage['info']): ParentModel | undefined => {
  return info === undefined ? undefined : modelFields(info) ?? modelFields(info.model)
}

const findLatestModel = (entries: WorkflowSessionMessage[] = []): ParentModel | undefined =>
  entries.flatMap(entry => extractModel(entry?.info) ?? []).at(-1)

const modelOrWarn = (model: ParentModel | undefined, warn: (message: string) => void): ParentModel | undefined => {
  if (model === undefined) {
    warn('parent model not found in session history; continuing without model inheritance')
  }
  return model
}

// Children must inherit the parent turn's model; native task-tool children do.
// Scans history from the end so the model of the most recent turn wins. Any
// failure degrades to the current behavior (no model) without failing the subtask.
export const resolveParentModel = async (
  client: WorkflowSdkClient,
  parentSessionID: string,
  log?: LogFunction,
): Promise<ParentModel | undefined> => {
  const warn = (message: string): void => log?.(message)
  // TODO: DEFERRED (owned by the adapter messages/parent-model inheritance follow-up ADR) rewrite the parent-model read in `resolveParentModel` below, from its `session.messages` check to the end of the function, to use the adapter's V2-native message shape instead of the V1 `info.providerID`/`info.modelID` shim; deferred because it changes `WorkflowSdkClient`, the adapter, and the engine, which needs that separate ADR.
  // Call the method on its receiver directly: the generated SDK methods rely on
  // `this._client`, so extracting `messages` into a bare const detaches `this`
  // and throws on every call, silently disabling model inheritance.
  if (client.session.messages === undefined) {
    warn('parent model unavailable: session.messages unsupported; continuing without model inheritance')
    return
  }
  try {
    const response = await client.session.messages({ path: { id: parentSessionID } })
    return modelOrWarn(findLatestModel(response.data), warn)
  }
  catch (error) {
    warn(`failed to resolve parent model: ${toErrorMessage(error)}; continuing without model inheritance`)
  }
}
