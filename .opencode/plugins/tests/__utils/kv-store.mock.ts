import type { State } from "@plugins/helpers/kv-store"

/** Static members of the `MockSessionStorage` class returned as `SessionStorage`. */
export interface MockSessionStorageStatic {
    reset(state?: Record<string, State>): void;
}

/** Instance members of each `MockSessionStorage` instance. */
interface MockSessionStorageInstance {
    readState: ReturnType<typeof vi.fn>;
    updateState: ReturnType<typeof vi.fn>;
}

/** Factory for kv-store vi.mock — creates fresh mocks inline, returns both the module object and direct mock references. */
export function makeKvStoreMockFactory(): {
    SessionStorage: MockSessionStorageStatic & { prototype: MockSessionStorageInstance }
    _mockReadState: ReturnType<typeof vi.fn>
    _mockUpdateState: ReturnType<typeof vi.fn>
    SESSION_FIELDS?: Record<string, string>
} {

    type InMemoryState = Record<string, State>

    let globalInMemoryState: InMemoryState = {}

    const _mockReadState = vi.fn();
    const _mockUpdateState = vi.fn();

    const _resetState = (initialState: InMemoryState = {}) => {
        globalInMemoryState = initialState

        _mockReadState.mockImplementation((sessionId: string, function_?: (s: Partial<State>) => State) => {
            if (function_) return function_(globalInMemoryState[sessionId] || {})
            return
        })
        _mockUpdateState.mockImplementation((sessionId: string, function_?: (s: Partial<State>) => State) => {
            globalInMemoryState[sessionId] = function_ ? function_(globalInMemoryState[sessionId] || {}) : globalInMemoryState[sessionId] || {}
            return globalInMemoryState[sessionId]
        })
    }

    class MockSessionStorage {
        static reset = _resetState

        readState = _mockReadState
        updateState = _mockUpdateState
    }

    const SESSION_FIELDS = {
        startedAt: "startedAt",
        cancelledAt: "cancelledAt",
        lastMessageSentAt: "lastMessageSentAt",
        idleAt: "idleAt",
        toolCalls: "toolCalls",
        needsReview: "needsReview",
    }

    return { SessionStorage: MockSessionStorage, _mockReadState, _mockUpdateState, SESSION_FIELDS }
}