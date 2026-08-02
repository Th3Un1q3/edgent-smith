import type { State } from '@plugins/helpers/kv-store'

type InMemoryState = Record<string, State>

/** Shared mutable state container for mock. Properties are reassigned, not the container itself. */
export const mockState: {
  inMemory: InMemoryState
  readState: ReturnType<typeof vi.fn> | undefined
  updateState: ReturnType<typeof vi.fn> | undefined
} = {
  inMemory: {},
  readState: undefined,
  updateState: undefined,
}

/**
 * Reset the mock in-memory state to a known value.
 * Call this in beforeEach or test setup instead of SessionStorage.reset().
 */
export function resetMockState(initialState: InMemoryState = {}): void {
  mockState.inMemory = initialState

  mockState.readState?.mockImplementation((sessionId: string, function_?: (s: Partial<State>) => State) => {
    if (function_) return function_(mockState.inMemory[sessionId] || {})
    return
  })
  mockState.updateState?.mockImplementation((sessionId: string, function_?: (s: Partial<State>) => State) => {
    mockState.inMemory[sessionId] = function_ ? function_(mockState.inMemory[sessionId] || {}) : mockState.inMemory[sessionId] || {}
    return mockState.inMemory[sessionId]
  })
}

/** Instance members of each `MockSessionStorage` instance. */
interface MockSessionStorageInstance {
  readState: ReturnType<typeof vi.fn>
  updateState: ReturnType<typeof vi.fn>
}

/** Factory for kv-store vi.mock — creates fresh mocks inline, returns both the module object and direct mock references. */
export function makeKvStoreMockFactory(): {
  SessionStorage: { new(): MockSessionStorageInstance, prototype: MockSessionStorageInstance }
  _mockReadState: ReturnType<typeof vi.fn>
  _mockUpdateState: ReturnType<typeof vi.fn>
  SESSION_FIELDS?: Record<string, string>
} {
  mockState.readState = vi.fn()
  mockState.updateState = vi.fn()

  const functionReadState = mockState.readState
  const functionUpdateState = mockState.updateState

  resetMockState()

  class MockSessionStorage {
    readState = functionReadState
    updateState = functionUpdateState
  }

  const SESSION_FIELDS = {
    startedAt: 'startedAt',
    cancelledAt: 'cancelledAt',
    lastMessageSentAt: 'lastMessageSentAt',
    idleAt: 'idleAt',
    toolCalls: 'toolCalls',
    agent: 'agent',
    needsReview: 'needsReview',
  }

  return { SessionStorage: MockSessionStorage, _mockReadState: functionReadState, _mockUpdateState: functionUpdateState, SESSION_FIELDS }
}
