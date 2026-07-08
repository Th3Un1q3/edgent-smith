import * as fs from "bun:fs"

/** Session state persisted at .opencode/plugins/sessions/{sessionId}.json */
export type State = Record<string, unknown>

export enum SESSION_FIELDS {
  startedAt = "startedAt",
  cancelledAt = "cancelledAt",
  lastMessageSentAt = "lastMessageSentAt",
  idleAt = "idleAt",
  toolCalls = "toolCalls",
}

interface SessionStorageAdapter {
  read(sessionId: string): State | undefined
  write(sessionId: string, state: State): void
}

class FileSystemSessionStorageAdapter implements SessionStorageAdapter {
  constructor(private basePath: string = ".opencode/plugins/sessions") {}

  read(sessionId: string): State | undefined {
    const path = `${this.basePath}/${sessionId}.json`
    try {
      const content = fs.readFileSync(path, "utf8") ?? ""
      return content.trim() ? (JSON.parse(content) as State) : {}
    } catch {
      // File does not exist yet — lazily created on first write
      return undefined
    }
  }

  write(sessionId: string, state: State): void {
    const path = `${this.basePath}/${sessionId}.json`
    const dir = path.slice(0, path.lastIndexOf("/"))
    try { fs.mkdirSync(dir, { recursive: true }) } catch { /* already exists */ }
    fs.writeFileSync(path, JSON.stringify(state, null, 2), "utf8")
  }
}

class SessionStorage {
  constructor(private storageAdapter: SessionStorageAdapter = new FileSystemSessionStorageAdapter()) {}

  readState<T extends State, R = unknown>(sessionId: string, reader: (state: T) => R): R | undefined {
    const state = this.storageAdapter.read(sessionId) as T | undefined
    if (!state) return undefined
    return reader(state)
  }

  updateState<T extends State, R = unknown>(sessionId: string, updater: (state: T) => R): R {
    const current = (this.storageAdapter.read(sessionId) as T) || ({} as T)
    const next = updater(current)
        this.storageAdapter.write(sessionId, next as State)
    return next
  }
}

export { SessionStorage, FileSystemSessionStorageAdapter }