import * as fs from "bun:fs"

/** Session state persisted at .opencode/plugins/sessions/{sessionId}.json */
export type State = Record<string, unknown>

export enum SESSION_FIELDS {
  startedAt = "startedAt",
  cancelledAt = "cancelledAt",
  lastMessageSentAt = "lastMessageSentAt",
  idleAt = "idleAt",
}

const SESSIONS_DIR = ".opencode/plugins/sessions"

function resolvePath(sessionId: string): string {
  return `${SESSIONS_DIR}/${sessionId}.json`
}

export function keySelector(keyPath: Array<string>): (state: State) => unknown {
  return (state: State) => {
    let current: unknown = state
    for (const key of keyPath) {
      if (typeof current !== "object" || current === null) return undefined
      current = (current as Record<string, unknown>)[key]
    }
    return current
  }
}

/** Read a single value at the given key path from session state. Returns undefined if not found. */
export function readState(
  sessionId: string,
  reader: (state: State) => unknown,
): unknown {
  const state = loadSessionState(sessionId)
  if (!state) return undefined
  return reader(state)
}

/** Update a session's persisted state. The updater receives the current state and returns the new one. */
export function updateState(
  sessionId: string,
  updater: (state: State) => State,
): State {
  const path = resolvePath(sessionId)
  let current: State = {}
  try {
    const content = fs.readFileSync(path, "utf-8") ?? ""
    if (content.trim()) current = JSON.parse(content) as State
  } catch { /* file missing — start from empty */ }

  const next = updater(current)
  const dir = path.slice(0, path.lastIndexOf("/"))
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* already exists */ }
  fs.writeFileSync(path, JSON.stringify(next, null, 2), "utf-8")
  return next
}


function loadSessionState(sessionId: string): State | undefined {
  const path = resolvePath(sessionId)
  try {
    const content = fs.readFileSync(path, "utf-8") ?? ""
    return content.trim() ? (JSON.parse(content) as State) : {}
  } catch {
    // File does not exist yet — lazily created on first write
    return undefined
  }
}
