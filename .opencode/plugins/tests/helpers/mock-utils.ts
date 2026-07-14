import { vi } from "vitest"

// ── Type definitions for client mock ────────────────────────────────────────

export interface ClientMock {
  session: { get(path: unknown): Promise<{ data?: Record<string, unknown> }>; todo?(path: { id: string }): Promise<{ data?: Array<{ content: unknown; status: unknown }> }> };
  client: { session: { get(path: unknown): Promise<{ data?: Record<string, unknown> }> } };
  project: (...args: unknown[]) => unknown
  directory: string
  worktree: string
  experimental_workspace: { register: ReturnType<typeof vi.fn> }
  serverUrl: URL
  $: ReturnType<typeof vi.fn>
}

/** Default client factory for tests that need a minimal session.get mock. */
export function defaultCreateClient(
  opts?: string | { agent?: string; data?: Record<string, unknown> },
  agentOverride?: string,
) {
  const resolved = typeof opts === "string" ? { agent: opts } : opts ?? {}
  return {
    // Top-level .session.get for tests that pass defaultCreateClient() directly and destructure { client } from PluginInput.
    session: {
      get: vi.fn().mockResolvedValue({ data: { ...resolved.data, ...(agentOverride && { agent: agentOverride }), ...(resolved.agent && !agentOverride && { agent: resolved.agent }) } }),
    },
    // .client.session.get for tests that wrap the result as { client: defaultCreateClient(...), directory }.
    client: {
      session: {
        get: vi.fn().mockResolvedValue({ data: { ...resolved.data, ...(agentOverride && { agent: agentOverride }), ...(resolved.agent && !agentOverride && { agent: resolved.agent }) } }),
      },
    },
    project: vi.fn(),
    directory: "/workspace",
    worktree: "/workspace/.git",
    experimental_workspace: { register: vi.fn() },
    serverUrl: new URL("http://localhost"),
    "$": vi.fn(),
  } as unknown as ClientMock
}

/** Creates a Promise-based indexer factory from a mock indexer object. */
export function createIndexerFactory<T>(mockIndexer: T): () => Promise<T> {
  return () => Promise.resolve(mockIndexer)
}

/** Mock instruction entry for use with makeMockIndexer. */
export interface MockInstructionEntry {
  description: string
  path: string
  applyTo: string
  excludePaths?: string
}

/** Factory that builds a mock indexer matching the real indexer's (forFiles, loadBody) interface. */
export function makeMockIndexer(
  entries: MockInstructionEntry[],
  bodyMap: Record<string, string> = {},
) {
  return {
    forFiles: async () => Promise.resolve(entries.map((e) => ({ ...e }))),
    loadBody: async (path: string) => bodyMap[path] ?? "",
  } as const
}

/** Default options used by createIndex fixture helper. */
const DEFAULT_CREATE_INDEX_OPTS = {
  type: "copilot" as const,
  instructionsGlob: ".opencode/plugins/tests/fixtures/copilot-instructions/*.instructions.md",
  currentWorkingDirectory: "/workspace",
}

/** Creates a real indexer fixture for tests that need actual file-based behavior. */
export function createIndex(opts?: Partial<typeof DEFAULT_CREATE_INDEX_OPTS>) {
  return import("../../helpers/instruction-indexer").then((m) =>
    m.createIndex({ ...DEFAULT_CREATE_INDEX_OPTS, ...opts } as Parameters<typeof m.createIndex>[0]),
  )
}

// ── Shared mock function instances (hoisted before any module imports) ───

// ── Mock function stubs with mockClear support (for direct use) ─────────

/** Shared mock functions for kv-store — used by both vi.mock factories and test assertions. */
export const _mockReadState = Object.assign(
  () => undefined,
  { mockClear: () => { } },
) as ReturnType<typeof vi.fn>

export const _mockUpdateState = Object.assign(
  () => { },
  { mockClear: () => { } },
) as ReturnType<typeof vi.fn>

/** Factory for logger vi.mock — creates a fresh log mock inline to avoid cross-test sharing. */
export function makeLoggerMockFactory(): { log: ReturnType<typeof vi.fn> } {
  return { log: vi.fn() } as const
}

/** Factory for session-helpers vi.mock — creates a fresh sendMessage mock inline to avoid cross-test sharing. */
export function makeSessionHelpersMockFactory(): { sendMessage: ReturnType<typeof vi.fn> } {
  return { sendMessage: vi.fn() } as const
}
