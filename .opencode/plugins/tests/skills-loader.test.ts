// Tests for skillsLoaderPlugin — see plugins/skills-loader.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { PluginInput } from '@opencode-ai/plugin'

import { defaultCreateClient } from '@tests/helpers/mock-utilities'

import type { ClientMock } from '@tests/helpers/mock-utilities'

vi.mock('bun', () => {
  const f = vi.fn()
  return { default: { file: f }, Glob: vi.fn() }
})
vi.mock('@plugins/helpers/logger')
vi.mock('node:fs/promises', () => ({ readdir: vi.fn() }))
import Bun from 'bun'

import { log } from '@plugins/helpers/logger'

import { readdir } from 'node:fs/promises'

import { skillsLoaderPlugin } from '@plugins/skills-loader'

const mockBunFile = Bun.file as ReturnType<typeof vi.fn>

const createMockClient = (overrides?: Partial<ClientMock>): ClientMock => ({ ...defaultCreateClient(), app: { log: vi.fn().mockResolvedValue(undefined), agents: vi.fn().mockResolvedValue({ data: [{ name: 'build' }] }) }, ...overrides })

const makeSkillFile = ({ content, mtimeMs }: { content: string, mtimeMs: number }) => ({ exists: vi.fn().mockResolvedValue(true), text: vi.fn().mockResolvedValue(content), stat: vi.fn().mockResolvedValue({ mtimeMs }) })

const registerSkillFiles = (files: Record<string, ReturnType<typeof makeSkillFile>>): void => {
  mockBunFile.mockImplementation((path: string) => {
    for (const [name, mtimeMs] of Object.entries(files)) {
      if (path.endsWith(`.agents/skills/${name}/SKILL.md`)) return mtimeMs
    }
    return { exists: vi.fn().mockResolvedValue(false), text: vi.fn().mockRejectedValue(new Error('missing')), stat: vi.fn().mockRejectedValue(new Error('missing')) }
  })
}

const hook = (p: Awaited<ReturnType<typeof skillsLoaderPlugin>>) => p?.['tool.execute.before'] ?? (() => Promise.resolve())

describe('skillsLoaderPlugin', () => {
  let client: ClientMock
  let plugin: Awaited<ReturnType<typeof skillsLoaderPlugin>>
  beforeEach(async () => {
    client = createMockClient()
    vi.mocked(readdir).mockRejectedValue(new Error('readdir not configured'))
    plugin = await skillsLoaderPlugin({ client, directory: '/workspace' } as unknown as PluginInput)
  })
  it('injects skills, removes skills field, and sorts by mtime ascending', async () => {
    registerSkillFiles({
      'skill-a': makeSkillFile({ content: '---\nname: skill-a\n---\n\n# Skill A\nBody of skill A.', mtimeMs: 100 }),
      'skill-b': makeSkillFile({ content: '---\nname: skill-b\n---\n\n# Skill B\nBody of skill B.', mtimeMs: 200 }),
    })

    const output = { args: { prompt: 'original prompt', skills: ['skill-a', 'skill-b'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.skills).toBeUndefined()
    expect(output.args.prompt).toMatch(/^<task_skills>/)
    expect(output.args.prompt).toContain('</task_skills>')
    expect(output.args.prompt).toContain('skill-a')
    expect(output.args.prompt).toContain('skill-b')
    expect(output.args.prompt).toContain('Body of skill A.')
    expect(output.args.prompt).toContain('Body of skill B.')
    expect(output.args.prompt).toMatch(/<\/skill>\n<skill name=/)
    expect(output.args.prompt).toContain('<user_request>\noriginal prompt\n</user_request>')
    expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)
    registerSkillFiles({
      'skill-c': makeSkillFile({ content: '---\nname: skill-c\n---\n\n# Skill C', mtimeMs: 300 }),
      'skill-a': makeSkillFile({ content: '---\nname: skill-a\n---\n\n# Skill A', mtimeMs: 100 }),
      'skill-b': makeSkillFile({ content: '---\nname: skill-b\n---\n\n# Skill B', mtimeMs: 200 }),
    })

    const output2 = { args: { prompt: 'prompt', skills: ['skill-c', 'skill-a', 'skill-b'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)

    const names = Array.from((output2.args.prompt ?? '').matchAll(/<skill name="([^"]+)"[^>]*>/g), m => m[1])

    expect(names).toEqual(['skill-a', 'skill-b', 'skill-c'])
  })
  describe('when no skills to inject', () => {
    it.each([
      { desc: 'skills field is absent', args: { prompt: 'o' } },
      { desc: 'skills array is empty', args: { prompt: 'o', skills: [] as string[] } },
    ])('wraps prompt when $desc', async ({ args }) => {
      const output = { args }

      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
      expect(output.args.prompt).toBe('<user_request>\no\n</user_request>')
    })
    it('does not call Bun.file and removes skills field when empty', async () => {
      const output = { args: { prompt: 'o', skills: [] as string[] } }

      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
      expect(mockBunFile).not.toHaveBeenCalled()
      expect(output.args.skills).toBeUndefined()
    })
    it('logs debug when skills array is empty, not when absent', async () => {
      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, { args: { prompt: 'o', skills: [] } })
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'debug', expect.stringContaining('skills array is empty'))
      vi.mocked(log).mockClear()
      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, { args: { prompt: 'o' } })
      expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'debug', expect.any(String))
    })
  })
  it('strips existing user_request tags before wrapping to prevent nesting', async () => {
    const output = { args: { prompt: '<user_request>model echoed this</user_request>' } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.prompt).toBe('<user_request>\nmodel echoed this\n</user_request>')
  })

  it('removes user_request wrapper from prompt with nested tags', async () => {
    const output = { args: { prompt: '<user_request><user_request>double wrapped</user_request></user_request>' } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.prompt).toBe('<user_request>\ndouble wrapped\n</user_request>')
  })

  it('returns early when args undefined and preserves non-array skills', async () => {
    const output = {} as { args: Record<string, unknown> }

    await expect(hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)).resolves.toBeUndefined()
    expect(output.args).toBeUndefined()
    expect(mockBunFile).not.toHaveBeenCalled()

    const notAnArray = 'not-an-array' as unknown

    const output2 = { args: { prompt: 'o', skills: notAnArray } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)
    expect(output2.args.prompt).toBe('<user_request>\no\n</user_request>')
    expect(output2.args.skills).toBe(notAnArray)
    expect(mockBunFile).not.toHaveBeenCalled()
  })
  it('deletes skills when directory is undefined, skips non-task tools', async () => {
    const plugin = await skillsLoaderPlugin({ client } as unknown as PluginInput)

    registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })

    const output = { args: { prompt: 'o', skills: ['skill-a'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.skills).toBeUndefined()
    expect(output.args.prompt).toBe('<user_request>\no\n</user_request>')
    expect(mockBunFile).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'debug', expect.any(String))

    const output2 = { args: { prompt: 'do something', skills: ['skill-a'] } }

    await hook(plugin)({ tool: 'write', sessionID: 's', callID: 'c' }, output2)
    expect(output2.args.prompt).toBe('do something')
    expect(output2.args.skills).toEqual(['skill-a'])
  })
  it('skips missing skill files, injects remaining and references for all-missing', async () => {
    registerSkillFiles({
      'skill-a': makeSkillFile({ content: '---\nname: skill-a\n---\n\n# Skill A', mtimeMs: 100 }),
      'skill-c': makeSkillFile({ content: '---\nname: skill-c\n---\n\n# Skill C', mtimeMs: 300 }),
    })

    const output = { args: { prompt: 'prompt', skills: ['skill-a', 'skill-b', 'skill-c'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.skills).toBeUndefined()
    expect(output.args.prompt).toContain('Skill A')
    expect(output.args.prompt).toContain('Skill C')
    expect(output.args.prompt).toContain('skill name="skill-b"')
    expect(output.args.prompt).toContain('reference="true"')
    expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('Load the skill "skill-b" by the name.'))
    vi.mocked(log).mockClear()

    const output2 = { args: { prompt: 'prompt', skills: ['no-such-skill'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)
    expect(output2.args.prompt).toContain('<task_skills>')
    expect(output2.args.prompt).toContain('skill name="no-such-skill"')
    expect(output2.args.prompt).toContain('reference="true"')
    expect(output2.args.prompt).toContain('Load the skill "no-such-skill" by the name.')
    expect(output2.args.prompt).toContain('<user_request>\nprompt\n</user_request>')
    expect(output2.args.skills).toBeUndefined()
    expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('Load the skill "no-such-skill" by the name.'))
    expect(output2.args.prompt).toMatch(/<task_skills>\n<skill/)
  })
  it('injects a single skill correctly and uses empty string fallback when prompt is missing', async () => {
    registerSkillFiles({ 'only-skill': makeSkillFile({ content: '---\nname: only-skill\n---\n\n# Only\nSingle body.', mtimeMs: 150 }) })

    const output = { args: { prompt: 'original prompt', skills: ['only-skill'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.skills).toBeUndefined()
    expect(output.args.prompt).toContain('<task_skills>')
    expect(output.args.prompt).toContain('only-skill')
    expect(output.args.prompt).toContain('Single body.')
    expect(output.args.prompt).toContain('<user_request>\noriginal prompt\n</user_request>')
    expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)
    registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })

    const output2: { args: Record<string, unknown> } = { args: { skills: ['skill-a'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)
    expect(output2.args.skills).toBeUndefined()
    expect(output2.args.prompt).toContain('<task_skills>')
    expect(output2.args.prompt).toContain('Skill A')
    expect(output2.args.prompt).toContain('<user_request>\n\n</user_request>')
  })
  describe('skill path and index', () => {
    beforeEach(() => {
      vi.mocked(readdir as unknown as (path: string) => Promise<string[]>).mockImplementation(async (path) => {
        const filePath = String(path)
        if (filePath.endsWith('.agents/skills/skill-a')) return ['SKILL.md', 'workflows/create.md', 'references/options.md']
        if (filePath.endsWith('.agents/skills/skill-b')) return ['SKILL.md', 'extra.md']
        throw new Error('ENOENT')
      })
    })
    it('includes path, skill_index, and ordering for resolved skills', async () => {
      registerSkillFiles({ 'skill-a': makeSkillFile({ content: 'UNIQUE_CONTENT_XYZ', mtimeMs: 100 }) })

      const output = { args: { prompt: 'prompt', skills: ['skill-a'] } }

      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
      expect(output.args.prompt).toContain('path=".agents/skills/skill-a/SKILL.md"')
      expect(output.args.prompt).toContain('<skill_index>')
      expect(output.args.prompt).toContain('.agents/skills/skill-a/SKILL.md')
      expect(output.args.prompt).toContain('.agents/skills/skill-a/workflows/create.md')
      expect(output.args.prompt).toContain('.agents/skills/skill-a/references/options.md')

      const prompt = output.args.prompt as string

      expect(prompt.indexOf('<skill_index>')).toBeLessThan(prompt.indexOf('UNIQUE_CONTENT_XYZ'))
    })
    it('does not add path or skill_index to unresolved skills', async () => {
      registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })

      const output = { args: { prompt: 'prompt', skills: ['skill-a', 'skill-b'] } }

      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)

      const resolved = (output.args.prompt as string).match(/<skill name="skill-a"[^>]*>/)?.[0]

      expect(resolved).toBeDefined()
      expect(resolved).toContain('path=')

      const unresolved = (output.args.prompt as string).match(/<skill name="skill-b"[^>]*>/)?.[0]

      expect(unresolved).toBeDefined()
      expect(unresolved).not.toContain('path=')
    })
    it('processes directory entries and falls back gracefully when readdir fails', async () => {
      vi.mocked(readdir as unknown as (path: string) => Promise<string[]>).mockImplementation(async (path) => {
        const filePath = String(path)
        // Intentionally non-string entry to verify readdir filtering skips non-string directory entries
        if (filePath.endsWith('.agents/skills/skill-a')) return ['SKILL.md', { name: 'extra.md' } as unknown as string, 'references/options.md']
        throw new Error('ENOENT')
      })
      registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })
      let output = { args: { prompt: 'prompt', skills: ['skill-a'] } }
      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
      expect(output.args.prompt).toContain('.agents/skills/skill-a/SKILL.md')
      expect(output.args.prompt).toContain('.agents/skills/skill-a/references/options.md')
      vi.mocked(readdir as unknown as (path: string) => Promise<string[]>).mockImplementation(async (path) => {
        const filePath = String(path)
        if (filePath.endsWith('.agents/skills/skill-a')) return ['workflows/create.md', 'references/options.md', 'SKILL.md']
        throw new Error('ENOENT')
      })
      output = { args: { prompt: 'prompt', skills: ['skill-a'] } }
      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)

      const index = (output.args.prompt as string).match(/<skill_index>[\s\S]*?<\/skill_index>/)![0]

      const reference = index.indexOf('.agents/skills/skill-a/references/options.md')

      const skillIndex = index.indexOf('.agents/skills/skill-a/SKILL.md')

      const workflowFile = index.indexOf('.agents/skills/skill-a/workflows/create.md')

      expect(reference).toBeGreaterThan(-1)
      expect(skillIndex).toBeGreaterThan(reference)
      expect(workflowFile).toBeGreaterThan(skillIndex)
      expect(index).toContain('.agents/skills/skill-a/references/options.md\n.agents/skills/skill-a/SKILL.md')
      expect(index).toContain('.agents/skills/skill-a/SKILL.md\n.agents/skills/skill-a/workflows/create.md')
      vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'))

      const output2 = { args: { prompt: 'prompt', skills: ['skill-a'] } }

      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)
      expect(output2.args.prompt).toContain('Skill A')
      expect(output2.args.prompt).toContain('path=".agents/skills/skill-a/SKILL.md"')
      expect(output2.args.prompt).toContain('<skill_index>')
      expect(output2.args.prompt).toContain('.agents/skills/skill-a/SKILL.md')
    })
  })
  describe('tool.definition', () => {
    type ToolHookOutput = { description: string, parameters: Record<string, unknown>, jsonSchema?: { type: string, properties?: Record<string, { type?: string, items?: { type: string }, description?: string }>, required?: string[] } }

    const applyDefinitionHook = async (input: { toolID: string }, output: ToolHookOutput) => {
      await (plugin?.['tool.definition'] ?? (() => Promise.resolve()))(input, output)
    }

    it('adds skills parameter to task tool jsonSchema', async () => {
      const output: ToolHookOutput = { description: 'Run a subagent', parameters: {}, jsonSchema: { type: 'object', properties: { prompt: { type: 'string', description: 'The task for the agent' } }, required: ['prompt'] } }

      await applyDefinitionHook({ toolID: 'task' }, output)

      const properties = output.jsonSchema!.properties!

      expect(properties.skills).toBeDefined()
      expect(properties.skills!.type).toBe('array')
      expect(properties.skills!.items).toEqual({ type: 'string' })
      expect(properties.skills!.description).toContain('.agents/skills')
      expect(properties.prompt).toBeDefined()
      expect(properties.prompt!.type).toBe('string')
      expect(output.jsonSchema!.required).not.toContain('skills')
    })
    it('does not modify non-task tool or tool with missing jsonSchema', async () => {
      const output1: ToolHookOutput = { description: 'x', parameters: {}, jsonSchema: { type: 'object', properties: { filePath: { type: 'string' } } } }

      await applyDefinitionHook({ toolID: 'write' }, output1)
      expect(output1.jsonSchema!.properties!.skills).toBeUndefined()
      expect(output1.jsonSchema!.properties!.filePath).toBeDefined()

      const output2: ToolHookOutput = { description: 'x', parameters: {} }

      await applyDefinitionHook({ toolID: 'task' }, output2)
      expect(output2.jsonSchema).toBeUndefined()
    })
    it('initializes missing properties and is idempotent', async () => {
      const output1: ToolHookOutput = { description: 'x', parameters: {}, jsonSchema: { type: 'object' } }

      await applyDefinitionHook({ toolID: 'task' }, output1)
      expect(output1.jsonSchema!.properties!).toBeDefined()
      expect(output1.jsonSchema!.properties!.skills!.type).toBe('array')

      const output2: ToolHookOutput = { description: 'x', parameters: {}, jsonSchema: { type: 'object', properties: { skills: { type: 'array', items: { type: 'string' }, description: 'custom skills' }, prompt: { type: 'string' } } } }

      await applyDefinitionHook({ toolID: 'task' }, output2)
      expect(output2.jsonSchema!.properties!.skills!.description).toBe('custom skills')
      expect(output2.jsonSchema!.properties!.skills!.type).toBe('array')
      expect(output2.jsonSchema!.properties!.prompt).toBeDefined()
    })
  })
})
