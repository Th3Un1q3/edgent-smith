import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type PluginInput } from '@opencode-ai/plugin'

import { defaultCreateClient, type ClientMock } from '@tests/helpers/mock-utilities'

import { makeKvStoreMockFactory, resetMockState } from '@tests/__utils/kv-store.mock'

vi.mock('@plugins/helpers/instruction-indexer', () => ({ createIndex: vi.fn() }))
vi.mock('@plugins/helpers/session-helpers')
vi.mock('@plugins/helpers/logger')
vi.mock('@plugins/helpers/kv-store', () => makeKvStoreMockFactory())
import { instructionsLoaderPlugin, type StateWithIdempotencyTokens } from '@plugins/instructions-loader'

import * as instructionIndexer from '@plugins/helpers/instruction-indexer'

import * as sessionHelpers from '@plugins/helpers/session-helpers'

import { log } from '@plugins/helpers/logger'

import { SessionStorage } from '@plugins/helpers/kv-store'

import type { InstructionMeta } from '@plugins/types/instructions'

type CreateIndexResult = Awaited<ReturnType<typeof instructionIndexer.createIndex>>

const mkInst = (path: string, description: string): InstructionMeta[] => [{ path, description, applyTo: '**/*.{ts}' }]

const mockIndex = (instructions: InstructionMeta[]): CreateIndexResult => ({ forFiles: async () => instructions, loadBody: async (path: string) => `Content of ${path}` })

const makeTokens = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`instruction_load:/${index}.ts:full`, 'ts']))

const ONE = mkInst('/f.ts', 'Test'),
  REF5 = makeTokens(5)

const invoke = async (client: ClientMock, sessionId: string, filePath = '/f.ts', tool = 'write') => {
  const plugin = await instructionsLoaderPlugin({ client, directory: '/workspace' } as unknown as PluginInput)

  await (plugin?.['tool.execute.before'] ?? (() => Promise.resolve()))({ tool, sessionID: sessionId, callID: 'c' }, { args: { filePath } })
}

const getMessage = (): string => (vi.mocked(sessionHelpers.sendMessage).mock.calls[0]?.[0] as { message: string })?.message ?? ''

const countInstructions = (block: string) => block.split('<instruction>').slice(1).filter(b => b.trim().length > 0).length

const getDescriptions = (block: string) => block.split('<instruction>').slice(1).map(b => ({ hasContent: b.includes('<content>'), desc: b.match(/<description>(.*?)<\/description>/s)?.[1]?.trim() ?? '' }))

const run = async (sessionId: string, tokens: Record<string, string>, instructions: InstructionMeta[], filePath = '/f.ts') => {
  resetMockState({ [sessionId]: { idempotencyTokens: tokens } })
  vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex(instructions))

  const client = defaultCreateClient()

  await invoke(client, sessionId, filePath)
  return getMessage()
}

describe('instructionsLoaderPlugin', () => {
  let client: ClientMock
  beforeEach(() => {
    resetMockState()
    client = defaultCreateClient()
    vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex(ONE))
  })
  describe('tool targeting', () => {
    it.each([
      { tool: 'write' },
      { tool: 'edit' },
      { tool: 'read' },
    ])('sends instructions for \'$tool\' tool', async ({ tool }) => {
      await invoke(client, 's', '/f.ts', tool)
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })
    it('skips non-targeted tools', async () => {
      await invoke(client, 's', '/f.ts', 'ls')
      expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
    })
  })
  describe('early return', () => {
    it.each([
      { name: 'missing sessionID', input: { tool: 'write', callID: 'c' }, args: { args: { filePath: '/f.ts' } } },
      { name: 'missing filePath', input: { tool: 'write', sessionID: 's', callID: 'c' }, args: {} },
    ])('skips when $name', async ({ input, args }) => {
      const plugin = await instructionsLoaderPlugin({ client, directory: '/workspace' } as unknown as PluginInput)

      // Testing early-return with intentionally incomplete hook params — widen function type so TS allows mismatched args
      const hook = (plugin?.['tool.execute.before'] ?? (() => Promise.resolve())) as (...arguments_: unknown[]) => Promise<void>

      await hook(input, args)
      expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
    })
    it('skips when no instructions match', async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex([]))
      await invoke(client, 's', '/unknown.ts')
      expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('No new instructions to send for session'), expect.any(String))
    })
    it.each([
      { name: 'empty path/desc', path: '', desc: '', tokenKey: 'instruction_load:' },
      { name: 'undefined path/desc', path: undefined, desc: undefined, tokenKey: 'instruction_load:undefined' },
    ])('safePath: sends when $name', async ({ path, desc, tokenKey }) => {
      resetMockState({ 's-sp': { idempotencyTokens: { [tokenKey]: 'ts' } } })
      // Deliberately passing incomplete InstructionMeta to test safePath handling
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex([{ path, description: desc, applyTo: '**/*.{ts}' } as InstructionMeta]))
      await invoke(client, 's-sp', '/f.ts')
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })
    it('safePath: sends when both path and desc are falsy', async () => {
      // Deliberately passing incomplete InstructionMeta to test safePath handling
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex([{ path: undefined, description: undefined, applyTo: '**/*.{ts}' } as unknown as InstructionMeta]))
      await invoke(client, 's-np', '/f.ts')
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })
  })
  describe('agent caching', () => {
    it('defaults to \'build\' agent', async () => {
      await invoke(client, 's')
      expect(instructionIndexer.createIndex).toHaveBeenCalledWith(expect.objectContaining({ agent: 'build' }))
    })
    it('defaults to \'build\' when session.get returns undefined', async () => {
      vi.mocked(client.session.get).mockResolvedValue(undefined as unknown as { data?: Record<string, unknown> })
      await invoke(client, 's')
      expect(instructionIndexer.createIndex).toHaveBeenCalledWith(expect.objectContaining({ agent: 'build' }))
    })
    it('reuses cached index across sessions with same agent', async () => {
      const plugin = await instructionsLoaderPlugin({ client, directory: '/workspace' } as unknown as PluginInput)

      const hook = plugin?.['tool.execute.before'] ?? (() => Promise.resolve())

      await hook({ tool: 'write', sessionID: 's1', callID: 'c' }, { args: { filePath: '/f.ts' } })
      await hook({ tool: 'write', sessionID: 's2', callID: 'c' }, { args: { filePath: '/f.ts' } })
      expect(instructionIndexer.createIndex).toHaveBeenCalledTimes(1)
    })
    it('creates separate index when agent differs', async () => {
      const differentAgentClient = defaultCreateClient()

      vi.spyOn(differentAgentClient.session, 'get').mockImplementation(async (path: unknown) =>
        (path as { path?: { id?: string } })?.path?.id === 's-copilot' ? { data: { agent: 'copilot' } } : { data: {} })

      const plugin = await instructionsLoaderPlugin({ client: differentAgentClient, directory: '/workspace' } as unknown as PluginInput)

      const hook = plugin?.['tool.execute.before'] ?? (() => Promise.resolve())

      await hook({ tool: 'write', sessionID: 's-build', callID: 'c' }, { args: { filePath: '/f.ts' } })
      await hook({ tool: 'write', sessionID: 's-copilot', callID: 'c' }, { args: { filePath: '/f.ts' } })
      expect(instructionIndexer.createIndex).toHaveBeenCalledTimes(2)
    })
    it('never creates more indexes than unique agents', async () => {
      const uniqueAgents = new Set<string>()

      vi.mocked(instructionIndexer.createIndex).mockImplementation(async (options) => {
        uniqueAgents.add(options.agent)
        return mockIndex([])
      })
      for (const agent of ['build', 'copilot', 'designer', 'copilot', 'build']) {
        const agentClient = defaultCreateClient()

        vi.spyOn(agentClient.session, 'get').mockResolvedValue({ data: { agent } })
        await invoke(agentClient, `s-${agent}`)
      }
      expect(uniqueAgents.size).toBe(3)
    })
    it('passes instructionsGlob and type', async () => {
      await invoke(client, 's')

      const options = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]

      expect(options.instructionsGlob).toBe('.opencode/instructions/*.instructions.md')
      expect(options.type).toBe('custom')
    })
    it('log function invokes logger', async () => {
      await invoke(client, 's')
      ;(vi.mocked(instructionIndexer.createIndex).mock.calls[0][0].log as (message: string) => void)('build')
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', 'build', expect.any(String))
    })
  })
  describe('idempotency', () => {
    it.each([
      { name: 'unsuffixed', key: 'instruction_load:/a.ts' },
      { name: ':full', key: 'instruction_load:/a.ts:full' },
      { name: ':ref', key: 'instruction_load:/a.ts:ref' },
    ])('skips when $name token exists', async ({ key }) => {
      resetMockState({ 's-i': { idempotencyTokens: { [key]: 'ts' } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex(mkInst('/a.ts', 'A')))
      await invoke(client, 's-i', '/a.ts')
      expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
    })
    it('sends with non-standard suffix', async () => {
      resetMockState({ 's-o': { idempotencyTokens: { 'instruction_load:/a.ts:other': 'ts' } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex(mkInst('/a.ts', 'A')))
      await invoke(client, 's-o', '/a.ts')
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })
    it('sends only new instructions when some were sent', async () => {
      const result = await run('s-m', { 'instruction_load:/old.ts': 'ts' }, [
        { path: '/old.ts', description: 'Old', applyTo: '**/*.{ts}' },
        { path: '/new.ts', description: 'New', applyTo: '**/*.{ts}' },
      ])

      expect(result).toContain('<description>New</description>')
      expect(result).not.toContain('<description>Old</description>')
    })
    it('updates sessionStorage with new tokens', async () => {
      resetMockState({ 's-u': { idempotencyTokens: { 'instruction_load:/old.ts': 'ts' } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex(mkInst('/new.ts', 'New')))
      await invoke(client, 's-u', '/new.ts')

      const tokens = new SessionStorage().readState<StateWithIdempotencyTokens, Record<string, string>>('s-u', state => state.idempotencyTokens ?? {})

      expect(tokens).toHaveProperty('instruction_load:/old.ts')
      expect(tokens).toHaveProperty('instruction_load:/new.ts:full')
      expect(Object.keys(tokens ?? {}).length).toBe(2)
    })
    it.each([
      { name: 'undefined tokens', state: {} },
      { name: 'empty tokens', state: { idempotencyTokens: {} } },
    ])('handles $name', async ({ state }) => {
      resetMockState({ 's-e': state })
      await invoke(client, 's-e')
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })
  })
  describe('5-slot budget', () => {
    it('injects all in empty session', async () => {
      await invoke(client, 's')
      expect(countInstructions(getMessage())).toBe(1)
    })
    it('full content when <5 :full tokens', async () => {
      const result = await run('s-p', { 'instruction_load:/p1.ts:full': 'ts', 'instruction_load:/p2.ts:ref': 'ts' }, ONE)

      expect(getDescriptions(result).every(d => d.hasContent)).toBe(true)
    })
    it('reference-only when 5 :full tokens', async () => {
      const result = await run('s-f', REF5, [{ path: '/a.ts', description: 'A', applyTo: '**/*.{ts}' }, { path: '/b.ts', description: 'B', applyTo: '**/*.{ts}' }], '/a.ts')

      const descriptions = getDescriptions(result)

      expect(descriptions.every(x => !x.hasContent)).toBe(true)
      expect(descriptions.length).toBe(2)
    })
    it('distributes full vs ref at 4-full boundary', async () => {
      const result = await run('s-b', makeTokens(4), [{ path: '/a.ts', description: 'A', applyTo: '**/*.{ts}' }, { path: '/b.ts', description: 'B', applyTo: '**/*.{ts}' }], '/a.ts')

      const descriptions = getDescriptions(result)

      expect(descriptions[0].hasContent).toBe(true)
      expect(descriptions[1].hasContent).toBe(false)
    })
    it.each([
      { name: 'legacy unsuffixed', tokens: { 'instruction_load:/p1.ts': 'ts', 'instruction_load:/p2.ts': 'ts' }, count: 5 },
      { name: ':ref suffixed', tokens: { 'instruction_load:/x.ts:ref': 'ts', 'instruction_load:/y.ts': 'ts' }, count: 1 },
    ])('does not count $name toward budget', async ({ tokens, count }) => {
      // Cast needed: it.each infers a union type from the table rows; the runtime values are always valid Record<string, string>
      const result = await run('s-l', tokens as unknown as Record<string, string>, Array.from({ length: count }, (_, index) => ({ path: `/${index}.ts`, description: `I${index}`, applyTo: '**/*.{ts}' })), '/a.ts')

      expect(countInstructions(result)).toBe(count)
      expect(result).toContain('<content>')
    })
    it('cap at slot 5 with mixed tokens', async () => {
      const result = await run('s-mx', { 'instruction_load:/p1.ts:full': 'ts', 'instruction_load:/p2.ts:ref': 'ts' },
        ['/a', '/b', '/c'].map(path => ({ path, description: `I${path}`, applyTo: '**/*.{ts}' })), '/a.ts')

      expect(countInstructions(result)).toBe(3)
    })
    it.each([
      { name: 'survives restart', tokens: makeTokens(3) },
      { name: 'starts fresh', tokens: {} },
    ])('session $name', async ({ tokens }) => {
      const result = await run('s-sr', tokens, [{ path: '/a.ts', description: 'A', applyTo: '**/*.{ts}' }], '/a.ts')

      expect(result).toContain('<instruction>')
    })
    it('counts only :full tokens', async () => {
      const result = await run('s-sf', { 'instruction_load:/f1.ts:full': 'ts', 'instruction_load:/f2.ts:full': 'ts', 'instruction_load:/u1.ts': 'ts', 'instruction_load:/r1.ts:ref': 'ts' },
        Array.from({ length: 4 }, (_, index) => ({ path: `/${index}.ts`, description: `I${index}`, applyTo: '**/*.{ts}' })), '/a.ts')

      expect(getDescriptions(result).filter(d => d.hasContent).length).toBe(3)
    })
    it('slotsRemaining never below zero', async () => {
      const result = await run('s-dc', REF5, ['/a', '/b', '/c'].map(path => ({ path, description: path, applyTo: '**/*.{ts}' })), '/a.ts')

      expect(getDescriptions(result).every(d => !d.hasContent)).toBe(true)
      expect(result).not.toContain('<content>')
    })
  })
  describe('XML format', () => {
    it('steering wraps with priority/reason/type and full block has all XML tags', async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex(mkInst('/f.ts', 'TD')))
      await invoke(client, 's', '/f.ts')

      const message = getMessage()

      expect(message).toContain('<steering priority="high" reason="relevant files touched" type="instructions">')
      expect(message).toContain('</steering>')
      expect(message).toMatch(/<steering\s+[^>]*priority="high"/)
      expect(message).toContain('<instruction>')
      expect(message).toContain('<description>TD</description>')
      expect(message).toContain('<path>/f.ts</path>')
      expect(message).toContain('<content>')
      expect(message).toContain('Content of /f.ts')
      expect(message).not.toContain('<meta')
    })
    it('empty body renders empty content', async () => {
      // Testing loadBody returning undefined (simulates missing file content)
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({ forFiles: async () => [{ path: '/e.ts', description: 'E', applyTo: '**/*.{ts}' }], loadBody: async () => undefined as unknown as string } as CreateIndexResult)
      await invoke(client, 's', '/e.ts')

      const message = getMessage()

      expect(message).toContain('<content>')
      expect(message).not.toContain('Content of /e.ts')
      expect(message).toMatch(/<content>\n\s*\n\s*<\/content>/)
    })
    it('ref block has <meta/> instead of <content>', async () => {
      const result = await run('s-xml', REF5, [{ path: '/r.ts', description: 'RD', applyTo: '**/*.{ts}' }], '/r.ts')

      expect(result).toContain('<description>RD</description>')
      expect(result).toContain('<meta')
      expect(result).toContain('/>')
      expect(result).not.toContain('<content>')
    })
    it('meta includes lines/chars with content', async () => {
      const result = await run('s-mi', REF5, [{ path: '/m.ts', description: 'M', applyTo: '**/*.{ts}' }], '/m.ts')

      expect(result).toContain('lines="1"')
      expect(result).toContain('chars="16"')
    })
    it('meta omits lines/chars without content', async () => {
      // Testing loadBody returning undefined (simulates missing file content)
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({ forFiles: async () => [{ path: '/e.ts', description: 'E', applyTo: '**/*.{ts}' }], loadBody: async () => undefined as unknown as string } as CreateIndexResult)
      resetMockState({ 's-me': { idempotencyTokens: REF5 } })
      await invoke(client, 's-me', '/e.ts')
      expect(getMessage()).toContain('<meta/>')
      expect(getMessage()).not.toContain('lines=')
    })
    it('double newlines between blocks, single within', async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex([{ path: '/a.ts', description: 'A', applyTo: '**/*.{ts}' }, { path: '/b.ts', description: 'B', applyTo: '**/*.{ts}' }]))
      await invoke(client, 's', '/a.ts')
      expect(getMessage()).toContain('</instruction>\n\n<instruction>')
      expect(getMessage()).toMatch(/  <description>.*<\/description>\n  <path>.*<\/path>\n  <content>/)
    })
    it('newline separators in ref blocks', async () => {
      const result = await run('s-rnl', REF5, [{ path: '/r.ts', description: 'R', applyTo: '**/*.{ts}' }], '/r.ts')

      expect(result).toContain('<description>R</description>\n  <path>')
      expect(result).toContain('</path>\n  <meta')
      expect(result).toContain('/>\n</instruction>')
    })
    it('calls sendMessage with noReply: true', async () => {
      await invoke(client, 's')
      expect(sessionHelpers.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ noReply: true }))
    })
    it('records :full/:ref tokens correctly', async () => {
      await invoke(client, 's')

      const tokens = new SessionStorage().readState<StateWithIdempotencyTokens, Record<string, string>>('s', state => state.idempotencyTokens ?? {})

      expect(Object.keys(tokens ?? {})).toEqual(expect.arrayContaining([expect.stringMatching(/:full$/)]))
      resetMockState({ 's-tr': { idempotencyTokens: REF5 } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex([{ path: '/new.ts', description: 'New', applyTo: '**/*.{ts}' }]))
      await invoke(client, 's-tr', '/new.ts')

      const updatedTokens = new SessionStorage().readState<StateWithIdempotencyTokens, Record<string, string>>('s-tr', state => state.idempotencyTokens ?? {})

      const newKeys = Object.keys(updatedTokens ?? {}).filter(key => key.startsWith('instruction_load:/new.ts'))

      expect(newKeys).toHaveLength(1)
      expect(newKeys[0]).toContain(':ref')
    })
    it('PLUGIN_ID used consistently in logs', async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex([]))
      await invoke(client, 's', '/nomatch.ts')
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('No new instructions'), 'instructions-loader')
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(mockIndex(mkInst('/f.ts', 'T')))
      await invoke(client, 's2')

      const logFunction = vi.mocked(instructionIndexer.createIndex).mock.calls.at(-1)?.[0]?.log as (message: string) => void

      logFunction('test')
      expect(vi.mocked(log).mock.calls.at(-1)?.[3]).toBe('instructions-loader')
    })
  })
})
