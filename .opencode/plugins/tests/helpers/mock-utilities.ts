import { vi } from "vitest"

// ── Type definitions for client mock ────────────────────────────────────────

export interface ClientMock {
  session: { get(path: unknown): Promise<{ data?: Record<string, unknown> }>; todo?(path: { id: string }): Promise<{ data?: Array<{ content: unknown; status: unknown }> }> };
  client: { session: { get(path: unknown): Promise<{ data?: Record<string, unknown> }> } };
  project: (...arguments_: unknown[]) => unknown
  directory: string
  worktree: string
  experimental_workspace: { register: ReturnType<typeof vi.fn> }
  serverUrl: URL
  app: { agents(): Promise<{ data: Array<{ name: string; steps?: number }> }> }
  $: ReturnType<typeof vi.fn>
}

/** Default agents for plugin tests when no override is provided. */
const DEFAULT_AGENTS: Array<{ name: string; steps?: number }> = [
  { name: "rug-swe", steps: 25 },    // floor(25*0.8) = 20
  { name: "rug-mcp", steps: 10 },    // floor(10*0.8) = 8
  { name: "rug-expert", steps: 19 }, // floor(19*0.8) = 15
]

/** Default client factory for tests that need a minimal session.get mock. */
export function defaultCreateClient(
  options?: string | { agent?: string; data?: Record<string, unknown> },
  agentOverride?: string,
  agentListOverride?: Array<{ name: string; steps?: number }>,
) {
  const resolved = typeof options === "string" ? { agent: options } : options ?? {}
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
      app: { agents: vi.fn().mockResolvedValue({ data: agentListOverride ?? DEFAULT_AGENTS }) },
    },
    project: vi.fn(),
    directory: "/workspace",
    worktree: "/workspace/.git",
    experimental_workspace: { register: vi.fn() },
    serverUrl: new URL("http://localhost"),
    app: { agents: vi.fn().mockResolvedValue({ data: agentListOverride ?? DEFAULT_AGENTS }) },
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
    forFiles: async () => entries.map((entry) => ({ ...entry })),
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
export async function createIndex(options?: Partial<typeof DEFAULT_CREATE_INDEX_OPTS>) {
  try {
    const m = await import("@plugins/helpers/instruction-indexer")
    return m.createIndex({ ...DEFAULT_CREATE_INDEX_OPTS, ...options } as Parameters<typeof m.createIndex>[0])
  } catch (error) {
    throw new Error(`Failed to load instruction indexer: ${error}`)
  }
}

// ── Shared mock function instances (hoisted before any module imports) ───

// ── Mock function stubs with mockClear support (for direct use) ─────────

/** Shared mock functions for kv-store — used by both vi.mock factories and test assertions. */
export const _mockReadState = Object.assign(
  () => {},
  { mockClear: () => {} },
) as ReturnType<typeof vi.fn>

export const _mockUpdateState = Object.assign(
  () => {},
  { mockClear: () => {} },
) as ReturnType<typeof vi.fn>

/** Factory for logger vi.mock — creates a fresh log mock inline to avoid cross-test sharing. */
export function makeLoggerMockFactory(): { log: ReturnType<typeof vi.fn> } {
  return { log: vi.fn() } as const
}

/** Factory for session-helpers vi.mock — creates a fresh sendMessage mock inline to avoid cross-test sharing. */
export function makeSessionHelpersMockFactory(): { sendMessage: ReturnType<typeof vi.fn> } {
  return { sendMessage: vi.fn() } as const
}
