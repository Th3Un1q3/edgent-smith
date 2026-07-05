import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOpencodeClientMock } from '../factories/opencode-client'
import { buildInstructionInjectionRule, buildRequireFirstToolSteeringRule, initCopilotSteeringRules, applySteeringRules, processRuleOutcomes } from '../../../plugins/helpers/steering-rules'
import { updateState, readState, setSessionsDir, getSessionsDir } from '../../../plugins/helpers/kv-store'
import * as sessionHelpers from '../../../plugins/helpers/session-helpers'
import type { ParsedCopilotInstruction } from '../../../plugins/types/instructions'
import type { SteeringRule, RuleOutcome, BlockToolExecutionOutcome } from '../../../plugins/types/steering'
import type { State } from '../../../plugins/helpers/kv-store'

type ToolTrackingState = State & {
  loadedInstructions: Record<string, { injectedAt: string }>;
}

type ToolCallsState = State & {
  toolCalls: Record<string, string>;
}

vi.mock('../../../plugins/helpers/session-helpers', async () => {
  return {
    sendMessage: vi.fn(),
  }
})

describe('buildInstructionInjectionRule', () => {
  let tempDir: string
  let originalSessionsDir: string
  const fileResolverMatch = vi.fn()
  const client = createOpencodeClientMock()
  const sessionId = 'ses-test-steering'

  const createInstruction = (overrides: Partial<ParsedCopilotInstruction> & { frontMatter: { applyTo: string; description?: string } }): ParsedCopilotInstruction => ({
    content: 'instruction content',
    path: '/workspace/.github/instructions/sample.instructions.md',
    ...overrides,
    frontMatter: {
      description: 'Sample instruction',
      ...overrides.frontMatter,
    },
  })

  beforeEach(() => {
    originalSessionsDir = getSessionsDir()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-rules-'))
    setSessionsDir(path.join(tempDir, '.opencode/plugins/sessions'))
    fileResolverMatch.mockReset()
    updateState<ToolTrackingState>(sessionId, () => ({ loadedInstructions: {} }))
  })

  afterEach(() => {
    setSessionsDir(originalSessionsDir)
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns a rule with lifecycle tool.execute.after', () => {
    const rule = buildInstructionInjectionRule({ copilotInstructions: [], fileResolverMatch })
    expect(rule.lifecycle).toContain('tool.execute.after')
  })

  it('returns empty outcomes when the tool is not read/write/edit', async () => {
    const rule = buildInstructionInjectionRule({
      copilotInstructions: [createInstruction({ frontMatter: { applyTo: '**/*.py' } })],
      fileResolverMatch,
    })
    const result = await rule.handle({ client, sessionId, input: { tool: 'bash', args: { filePath: 'workspace/agents/edge.py' } }, output: { output: 'bash output' } })
    expect(result).toEqual([])
    expect(fileResolverMatch).not.toHaveBeenCalled()
  })

  it('returns empty outcomes when no instruction matches the file path', async () => {
    fileResolverMatch.mockReturnValue(false)
    const instruction = createInstruction({ frontMatter: { applyTo: '**/*.py' } })
    const rule = buildInstructionInjectionRule({
      copilotInstructions: [instruction],
      fileResolverMatch,
    })
    const result = await rule.handle({ client, sessionId, input: { tool: 'read', args: { filePath: 'workspace/agents/edge.js' } }, output: { output: 'read output' } })
    expect(result).toEqual([])
    expect(fileResolverMatch).toHaveBeenCalledWith('**/*.py', 'workspace/agents/edge.js')
  })

  it('returns tool_output_enrichment for read tool without steering_message', async () => {
    const instruction = createInstruction({
      path: '/workspace/.github/instructions/python.instructions.md',
      frontMatter: { applyTo: '**/*.py', description: 'Python instruction' },
    })
    fileResolverMatch.mockImplementation((pattern: string, filePath: string) => pattern === '**/*.py' && filePath === 'workspace/agents/edge.py')
    const rule = buildInstructionInjectionRule({
      copilotInstructions: [instruction],
      fileResolverMatch,
    })
    const result = await rule.handle({
      client,
      sessionId,
      input: { tool: 'read', args: { filePath: 'workspace/agents/edge.py' } },
      output: { output: 'read output' },
    })
    expect(result).toHaveLength(1)
    const enrichment = result[0]
    expect(enrichment.type).toBe('tool_output_enrichment')
    if (enrichment.type !== 'tool_output_enrichment') return
    expect(enrichment.payload.tool_output).toBe('read output')
    expect(enrichment.payload.relevant_instructions).toEqual([{
      description: 'Python instruction',
      path: '/workspace/.github/instructions/python.instructions.md',
      applies_to_files: '**/*.py',
    }])
  })

  it('returns steering_message and tool_output_enrichment for write tool', async () => {
    const instruction = createInstruction({
      path: '/workspace/.github/instructions/python.instructions.md',
      frontMatter: { applyTo: '**/*.py', description: 'Python instruction' },
    })
    fileResolverMatch.mockImplementation((pattern: string, filePath: string) => pattern === '**/*.py' && filePath === 'workspace/agents/edge.py')
    const rule = buildInstructionInjectionRule({
      copilotInstructions: [instruction],
      fileResolverMatch,
    })
    const result = await rule.handle({
      client,
      sessionId,
      input: { tool: 'write', args: { filePath: 'workspace/agents/edge.py' } },
      output: { output: 'write output' },
    })
    expect(result).toHaveLength(2)
    const types = result.map(r => r.type)
    expect(types).toContain('steering_message')
    expect(types).toContain('tool_output_enrichment')

    const message = result.find(r => r.type === 'steering_message')
    expect(message?.type === 'steering_message' && message.message.includes('<instructions>')).toBe(true)
    expect(message?.type === 'steering_message' && message.message.includes('Python instruction')).toBe(true)

    const enrichment = result.find(r => r.type === 'tool_output_enrichment')
    expect(enrichment?.type === 'tool_output_enrichment' && enrichment.payload.tool_output).toBe('write output')
  })

  it('prevents duplicate injection by marking loaded instructions in state', async () => {
    const instruction = createInstruction({
      path: '/workspace/.github/instructions/python.instructions.md',
      frontMatter: { applyTo: '**/*.py', description: 'Python instruction' },
    })
    fileResolverMatch.mockImplementation((pattern: string, filePath: string) => pattern === '**/*.py' && filePath === 'workspace/agents/edge.py')
    const rule = buildInstructionInjectionRule({
      copilotInstructions: [instruction],
      fileResolverMatch,
    })

    const first = await rule.handle({
      client,
      sessionId,
      input: { tool: 'edit', args: { filePath: 'workspace/agents/edge.py' } },
      output: { output: 'edit output 1' },
    })
    expect(first.some(r => r.type === 'steering_message')).toBe(true)

    const loaded = readState<ToolTrackingState>(sessionId, (state) => state.loadedInstructions)
    expect(loaded).toHaveProperty('/workspace/.github/instructions/python.instructions.md')
    expect((loaded as ToolTrackingState['loadedInstructions'])['/workspace/.github/instructions/python.instructions.md'].injectedAt).toEqual(expect.any(String))

    const second = await rule.handle({
      client,
      sessionId,
      input: { tool: 'edit', args: { filePath: 'workspace/agents/edge.py' } },
      output: { output: 'edit output 2' },
    })
    expect(second.some(r => r.type === 'steering_message')).toBe(false)
    const enrichment = second.find(r => r.type === 'tool_output_enrichment')
    expect(enrichment?.type === 'tool_output_enrichment' && enrichment.payload.tool_output).toBe('edit output 2')
  })
})

describe('buildRequireFirstToolSteeringRule', () => {
  let tempDir: string
  let originalSessionsDir: string
  const sessionId = 'ses-require-first-tool'

  beforeEach(() => {
    originalSessionsDir = getSessionsDir()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-rules-'))
    setSessionsDir(path.join(tempDir, '.opencode/plugins/sessions'))
    updateState<ToolCallsState>(sessionId, () => ({ toolCalls: {} }))
  })

  afterEach(() => {
    setSessionsDir(originalSessionsDir)
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns a rule with lifecycle tool.execute.before', () => {
    const rule = buildRequireFirstToolSteeringRule({
      requiredFirstTool: 'skill',
      applyToAgents: ['rug-expert'],
      message: 'call skill first',
    })
    expect(rule.lifecycle).toEqual(['tool.execute.before'])
  })

  it('allows tool when tool matches required first tool', async () => {
    const client = createOpencodeClientMock({
      session: { get: vi.fn().mockResolvedValue({ data: { agent: 'rug-expert' } }) },
    })
    const rule = buildRequireFirstToolSteeringRule({
      requiredFirstTool: 'skill',
      applyToAgents: ['rug-expert'],
      message: 'call skill first',
    })
    const result = await rule.handle({
      client,
      sessionId,
      input: { tool: 'skill', args: { name: 'find-skills' } },
      output: {},
    })
    expect(result).toEqual([])
  })

  it('allows tool when agent not in applyToAgents', async () => {
    const client = createOpencodeClientMock({
      session: { get: vi.fn().mockResolvedValue({ data: { agent: 'build' } }) },
    })
    const rule = buildRequireFirstToolSteeringRule({
      requiredFirstTool: 'skill',
      applyToAgents: ['rug-expert'],
      message: 'call skill first',
    })
    const result = await rule.handle({
      client,
      sessionId,
      input: { tool: 'read', args: { filePath: 'foo.ts' } },
      output: {},
    })
    expect(result).toEqual([])
  })

  it('allows tool when required tool already called', async () => {
    updateState<ToolCallsState>(sessionId, () => ({ toolCalls: { skill: 'call-1' } }))
    const client = createOpencodeClientMock({
      session: { get: vi.fn().mockResolvedValue({ data: { agent: 'rug-expert' } }) },
    })
    const rule = buildRequireFirstToolSteeringRule({
      requiredFirstTool: 'skill',
      applyToAgents: ['rug-expert'],
      message: 'call skill first',
    })
    const result = await rule.handle({
      client,
      sessionId,
      input: { tool: 'read', args: { filePath: 'foo.ts' } },
      output: {},
    })
    expect(result).toEqual([])
  })

  it('blocks tool and returns message when rule active', async () => {
    const client = createOpencodeClientMock({
      session: { get: vi.fn().mockResolvedValue({ data: { agent: 'rug-expert' } }) },
    })
    const rule = buildRequireFirstToolSteeringRule({
      requiredFirstTool: 'skill',
      applyToAgents: ['rug-expert'],
      message: 'The tool "read" cannot be executed because the required first tool "skill" has not been called.',
    })
    const result = await rule.handle({
      client,
      sessionId,
      input: { tool: 'read', args: { filePath: 'foo.ts' } },
      output: {},
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'block_tool_execution',
      message: 'The tool "read" cannot be executed because the required first tool "skill" has not been called.',
    })
  })

  it('supports message as function', async () => {
    const client = createOpencodeClientMock({
      session: { get: vi.fn().mockResolvedValue({ data: { agent: 'rug' } }) },
    })
    const messageFn = vi.fn().mockReturnValue('computed message')
    const rule = buildRequireFirstToolSteeringRule({
      requiredFirstTool: 'todowrite',
      applyToAgents: ['rug'],
      message: messageFn,
    })
    const context = {
      client,
      sessionId,
      input: { tool: 'read', args: { filePath: 'foo.ts' } },
      output: {},
    }
    const result = await rule.handle(context)
    expect(messageFn).toHaveBeenCalledWith(context)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'block_tool_execution',
      message: 'computed message',
    })
  })
})

describe('applySteeringRules', () => {
  const client = createOpencodeClientMock({ app: { log: vi.fn() } })
  const sessionId = 'ses-apply-steering'

  const createRule = (
    lifecycle: Array<'tool.execute.before' | 'tool.execute.after' | 'message.send'>,
    outcomes: RuleOutcome[]
  ): SteeringRule => ({
    lifecycle,
    handle: vi.fn().mockResolvedValue(outcomes),
  })

  it('filters rules by lifecycle', async () => {
    const beforeRule = createRule(['tool.execute.before'], [{ type: 'steering_message', message: 'before' }])
    const afterRule = createRule(['tool.execute.after'], [{ type: 'steering_message', message: 'after' }])
    const result = await applySteeringRules({
      lifecycle: 'tool.execute.before',
      rules: [beforeRule, afterRule],
      context: { input: {}, output: {} },
      client,
      sessionId,
    })
    expect(result).toEqual([{ type: 'steering_message', message: 'before' }])
    expect(beforeRule.handle).toHaveBeenCalledWith({ client, sessionId, input: {}, output: {} })
    expect(afterRule.handle).not.toHaveBeenCalled()
  })

  it('flattens outcomes from multiple rules', async () => {
    const ruleOne = createRule(['tool.execute.before'], [{ type: 'steering_message', message: 'one' }])
    const ruleTwo = createRule(['tool.execute.before'], [{ type: 'follow_up_message', message: 'two' }])
    const result = await applySteeringRules({
      lifecycle: 'tool.execute.before',
      rules: [ruleOne, ruleTwo],
      context: { input: {}, output: {} },
      client,
      sessionId,
    })
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ type: 'steering_message', message: 'one' })
    expect(result).toContainEqual({ type: 'follow_up_message', message: 'two' })
  })

  it('returns empty array when no rules match lifecycle', async () => {
    const beforeRule = createRule(['tool.execute.before'], [{ type: 'steering_message', message: 'before' }])
    const result = await applySteeringRules({
      lifecycle: 'tool.execute.after',
      rules: [beforeRule],
      context: { input: {}, output: {} },
      client,
      sessionId,
    })
    expect(result).toEqual([])
  })

  it('applies message.send lifecycle', async () => {
    const messageRule = createRule(['message.send'], [{ type: 'steering_message', message: 'hello' }])
    const result = await applySteeringRules({
      lifecycle: 'message.send',
      rules: [messageRule],
      context: { input: { text: 'user message' }, output: {} },
      client,
      sessionId,
    })
    expect(result).toEqual([{ type: 'steering_message', message: 'hello' }])
    expect(messageRule.handle).toHaveBeenCalledWith({ client, sessionId, input: { text: 'user message' }, output: {} })
  })
})

describe('initCopilotSteeringRules', () => {
  const createInstruction = (overrides: Partial<ParsedCopilotInstruction> & { frontMatter: { applyTo: string; description?: string } }): ParsedCopilotInstruction => ({
    content: 'instruction content',
    path: '/workspace/.github/instructions/sample.instructions.md',
    ...overrides,
    frontMatter: {
      description: 'Sample instruction',
      ...overrides.frontMatter,
    },
  })

  it('returns empty array when no instructions have requireFirstTool', () => {
    const instructions = [
      createInstruction({ frontMatter: { applyTo: '**/*.py', description: 'Python conventions' } }),
    ]
    const rules = initCopilotSteeringRules(instructions)
    expect(rules).toEqual([])
  })

  it('generates a requireFirstTool rule from front matter', async () => {
    let tempDir = ''
    try {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-rules-'))
      const originalSessionsDir = getSessionsDir()
      setSessionsDir(path.join(tempDir, '.opencode/plugins/sessions'))

      const instructions = [
        createInstruction({
          path: '/workspace/.github/instructions/rug.instructions.md',
          frontMatter: {
            applyTo: '**/*.py',
            description: 'Rug conventions',
            requireFirstTool: {
              requiredFirstTool: 'todowrite',
              applyToAgents: ['rug'],
              message: 'Write todos first.',
            },
          },
        }),
      ]
      const rules = initCopilotSteeringRules(instructions)
      expect(rules).toHaveLength(1)
      expect(rules[0].lifecycle).toEqual(['tool.execute.before'])

      const client = createOpencodeClientMock({
        session: { get: vi.fn().mockResolvedValue({ data: { agent: 'rug' } }) },
        app: { log: vi.fn() },
      })
      updateState<ToolCallsState>('ses-init-rule', () => ({ toolCalls: {} }))
      const result = await rules[0].handle({
        client,
        sessionId: 'ses-init-rule',
        input: { tool: 'read', args: { filePath: 'foo.ts' } },
        output: {},
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'block_tool_execution',
        message: 'Write todos first.',
      })

      setSessionsDir(originalSessionsDir)
    } finally {
      if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('uses default message when message is omitted', async () => {
    let tempDir = ''
    try {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-rules-'))
      const originalSessionsDir = getSessionsDir()
      setSessionsDir(path.join(tempDir, '.opencode/plugins/sessions'))

      const instructions = [
        createInstruction({
          path: '/workspace/.github/instructions/expert.instructions.md',
          frontMatter: {
            applyTo: '**/*.ts',
            description: 'Expert conventions',
            requireFirstTool: {
              requiredFirstTool: 'skill',
              applyToAgents: ['rug-expert'],
            },
          },
        }),
      ]
      const rules = initCopilotSteeringRules(instructions)
      expect(rules).toHaveLength(1)

      const client = createOpencodeClientMock({
        session: { get: vi.fn().mockResolvedValue({ data: { agent: 'rug-expert' } }) },
        app: { log: vi.fn() },
      })
      updateState<ToolCallsState>('ses-default-message', () => ({ toolCalls: {} }))
      const result = await rules[0].handle({
        client,
        sessionId: 'ses-default-message',
        input: { tool: 'read', args: { filePath: 'foo.ts' } },
        output: {},
      })
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('block_tool_execution')
      expect((result[0] as BlockToolExecutionOutcome).message).toContain('skill')

      setSessionsDir(originalSessionsDir)
    } finally {
      if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('applies multiple rules if multiple instructions declare them', () => {
    const instructions = [
      createInstruction({
        path: '/workspace/.github/instructions/one.instructions.md',
        frontMatter: {
          applyTo: '**/*.py',
          description: 'One',
          requireFirstTool: {
            requiredFirstTool: 'skill',
            applyToAgents: ['rug-expert'],
            message: 'first rule',
          },
        },
      }),
      createInstruction({
        path: '/workspace/.github/instructions/two.instructions.md',
        frontMatter: {
          applyTo: '**/*.js',
          description: 'Two',
          requireFirstTool: {
            requiredFirstTool: 'todowrite',
            applyToAgents: ['rug'],
            message: 'second rule',
          },
        },
      }),
    ]
    const rules = initCopilotSteeringRules(instructions)
    expect(rules).toHaveLength(2)
  })
})

describe('processRuleOutcomes', () => {
  const client = createOpencodeClientMock({ app: { log: vi.fn() } })
  const sessionId = 'ses-process-outcomes'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends batched steering messages with noReply', async () => {
    const outcomes: RuleOutcome[] = [
      { type: 'steering_message', message: 'steering one' },
      { type: 'steering_message', message: 'steering two' },
    ]
    await processRuleOutcomes({ outcomes, client, sessionId, logPrefix: 'TEST_PREFIX' })
    expect(sessionHelpers.sendMessage).toHaveBeenCalledTimes(1)
    expect(sessionHelpers.sendMessage).toHaveBeenCalledWith({
      client,
      sessionId,
      message: 'steering one\nsteering two',
      noReply: true,
    })
  })

  it('sends batched follow-up messages', async () => {
    const outcomes: RuleOutcome[] = [
      { type: 'follow_up_message', message: 'follow-up one' },
      { type: 'follow_up_message', message: 'follow-up two' },
    ]
    await processRuleOutcomes({ outcomes, client, sessionId, logPrefix: 'TEST_PREFIX' })
    expect(sessionHelpers.sendMessage).toHaveBeenCalledTimes(1)
    expect(sessionHelpers.sendMessage).toHaveBeenCalledWith({
      client,
      sessionId,
      message: 'follow-up one\nfollow-up two',
    })
  })

  it('throws on block_tool_execution', async () => {
    const outcomes: RuleOutcome[] = [
      { type: 'block_tool_execution', message: 'blocked' },
    ]
    await expect(processRuleOutcomes({ outcomes, client, sessionId, logPrefix: 'TEST_PREFIX' })).rejects.toThrow('blocked')
  })

  it('ignores empty outcomes', async () => {
    await processRuleOutcomes({ outcomes: [], client, sessionId, logPrefix: 'TEST_PREFIX' })
    expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
  })
})
