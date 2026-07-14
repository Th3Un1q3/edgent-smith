import { State } from "../../helpers/kv-store"

/** Factory for kv-store vi.mock — creates fresh mocks inline, returns both the module object and direct mock references. */
export function makeKvStoreMockFactory(): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SessionStorage: any  // MockSessionStorage constructor — forward-ref workaround
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

        _mockReadState.mockImplementation((sessionId: string, fn?: (s: State) => any) => {
            if (fn) return fn(globalInMemoryState[sessionId] || {})
            return undefined
        })
        _mockUpdateState.mockImplementation((sessionId: string, fn?: (s: State) => any) => {
            globalInMemoryState[sessionId] = fn ? fn(globalInMemoryState[sessionId] || {}) : globalInMemoryState[sessionId] || {}
            return globalInMemoryState[sessionId]
        })
    }

    class MockSessionStorage {
        readState = _mockReadState
        updateState = _mockUpdateState
        static reset = _resetState
    }

    const SESSION_FIELDS = {
        startedAt: "startedAt",
        cancelledAt: "cancelledAt",
        lastMessageSentAt: "lastMessageSentAt",
        idleAt: "idleAt",
        toolCalls: "toolCalls",
    }

    return { SessionStorage: MockSessionStorage, _mockReadState, _mockUpdateState, SESSION_FIELDS }
}