// Tests for skillsLoaderPlugin — see plugins/skills-loader.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { PluginInput } from '@opencode-ai/plugin'

import { defaultCreateClient } from '@tests/helpers/mock-utilities'

import type { ClientMock } from '@tests/helpers/mock-utilities'

vi.mock('bun', () => {
  const f = vi.fn()
  return { default: { file: f }, Glob: vi.fn() }
})
vi.mock('@plugins/helpers/logger')
import Bun from 'bun'

import { log } from '@plugins/helpers/logger'

import { __peekEnvelopeForTests, __resetStoreForTests, createEnvelope, resolveEnvelope } from '@plugins/helpers/envelope-store'

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

const chatMessageHook = (p: Awaited<ReturnType<typeof skillsLoaderPlugin>>) => p?.['chat.message'] ?? (() => Promise.resolve())

/**
 * Builds the envelope tag exactly as tool.execute.before injects it.
 * Mirrors the implementation's constant description.
 */
const envelopeTag = (key: string): string =>
  `<envelope id="${key}" description="System-managed envelope; skill content is attached automatically. Do not modify."/>`

/** Constant description used by the plugin's envelope tag. */
const ENVELOPE_DESCRIPTION = 'System-managed envelope; skill content is attached automatically. Do not modify.'

/**
 * Builds a $ shell mock whose `ls -R .` invocation in the skill directory
 * resolves with the given output (tool-limit-reminder-style chainable mock).
 */
const makeLsShellMock = (exitCode: number, stdout: string): ReturnType<typeof vi.fn> =>
  vi.fn().mockReturnValue({
    cwd: () => ({ nothrow: () => ({ quiet: vi.fn().mockResolvedValue({ exitCode, stdout: Buffer.from(stdout), stderr: Buffer.from('') }) }) }),
  })

/** Extracts the envelope key from the injected envelope tag; '' when absent. */
const envelopeKeyFromPrompt = (prompt: string): string => prompt.match(/<envelope\s+id="([^"]+)"/)?.[1] ?? ''

/** Resolves the envelope whose tag is embedded in prompt. */
const resolvePayloadFromPrompt = async (prompt: string): Promise<string | undefined> => resolveEnvelope(envelopeKeyFromPrompt(prompt))

/**
 * Replica of the source's UUID-precise envelope tag pattern
 * (plugins/skills-loader.ts ENVELOPE_TAG_PATTERN). Replicated — not exported —
 * to keep the source's export surface unchanged; the constant is documented as
 * frozen by the idempotency/unwrap guards, so drift risk is minimal, and the
 * end-to-end unwrap tests below exercise the real pattern.
 */
const ENVELOPE_TAG_PATTERN = /<envelope\b[^>]*\bid="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"[^>]*\/>/

describe('skillsLoaderPlugin', () => {
  let client: ClientMock
  let plugin: Awaited<ReturnType<typeof skillsLoaderPlugin>>
  beforeEach(async () => {
    __resetStoreForTests()
    client = createMockClient()
    // No $ shell mock configured → buildSkillIndex's `ls -R` fails → fallback index
    plugin = await skillsLoaderPlugin({ client, directory: '/workspace' } as unknown as PluginInput)
  })
  afterEach(() => {
    __resetStoreForTests()
  })
  it('stores skills in an envelope, injects only the envelope tag, removes skills field, and sorts by mtime ascending', async () => {
    registerSkillFiles({
      'skill-a': makeSkillFile({ content: '---\nname: skill-a\n---\n\n# Skill A\nBody of skill A.', mtimeMs: 100 }),
      'skill-b': makeSkillFile({ content: '---\nname: skill-b\n---\n\n# Skill B\nBody of skill B.', mtimeMs: 200 }),
    })

    const output = { args: { prompt: 'original prompt', skills: ['skill-a', 'skill-b'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.skills).toBeUndefined()

    const prompt = output.args.prompt as string

    // Prompt carries ONLY the small self-closing envelope tag — never the full skill content
    expect(prompt).toMatch(/^<envelope id="[^"]+" description="System-managed envelope; skill content is attached automatically\. Do not modify\."\/>/)
    expect(prompt).not.toContain('<skill name=')
    expect(prompt).not.toContain('Body of skill A.')
    expect(prompt).not.toContain('Body of skill B.')
    expect(prompt).not.toContain('<skill_envelope')
    expect(prompt).not.toContain('<task_skills>')
    expect(prompt).toContain('<user_request>\noriginal prompt\n</user_request>')
    expect(prompt).toMatch(/<envelope id="[^"]+"[^>]*\/>\n<user_request>\noriginal prompt/)

    // The stored payload is byte-identical to the old direct-injection format
    // (the unconfigured $ shell falls back to the flat SKILL.md-only index)
    const payload = await resolvePayloadFromPrompt(prompt)

    expect(payload).toBe(`<task_skills>
<skill name="skill-a" path=".agents/skills/skill-a/SKILL.md">
<skill_index>
.agents/skills/skill-a/SKILL.md
</skill_index>
---\nname: skill-a\n---\n\n# Skill A\nBody of skill A.
</skill>
<skill name="skill-b" path=".agents/skills/skill-b/SKILL.md">
<skill_index>
.agents/skills/skill-b/SKILL.md
</skill_index>
---\nname: skill-b\n---\n\n# Skill B\nBody of skill B.
</skill>
</task_skills>`)

    // mtime ordering is preserved INSIDE the payload
    registerSkillFiles({
      'skill-c': makeSkillFile({ content: '---\nname: skill-c\n---\n\n# Skill C', mtimeMs: 300 }),
      'skill-a': makeSkillFile({ content: '---\nname: skill-a\n---\n\n# Skill A', mtimeMs: 100 }),
      'skill-b': makeSkillFile({ content: '---\nname: skill-b\n---\n\n# Skill B', mtimeMs: 200 }),
    })

    const output2 = { args: { prompt: 'prompt', skills: ['skill-c', 'skill-a', 'skill-b'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)

    const prompt2 = output2.args.prompt as string

    // The tag description is constant — skill names appear only in the payload
    expect(prompt2).toContain(`description="${ENVELOPE_DESCRIPTION}"`)

    const payload2 = await resolvePayloadFromPrompt(prompt2)

    const names = Array.from((payload2 ?? '').matchAll(/<skill name="([^"]+)"[^>]*>/g), m => m[1])

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
  it('stores unresolved skill references inside the payload and lists all names in the envelope tag', async () => {
    registerSkillFiles({
      'skill-a': makeSkillFile({ content: '---\nname: skill-a\n---\n\n# Skill A', mtimeMs: 100 }),
      'skill-c': makeSkillFile({ content: '---\nname: skill-c\n---\n\n# Skill C', mtimeMs: 300 }),
    })

    const output = { args: { prompt: 'prompt', skills: ['skill-a', 'skill-b', 'skill-c'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.skills).toBeUndefined()
    expect(output.args.prompt).not.toContain('Skill A')
    expect(output.args.prompt).not.toContain('<skill name=')
    expect(output.args.prompt).toContain(`description="${ENVELOPE_DESCRIPTION}"`)
    expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('Load the skill "skill-b" by the name.'))
    vi.mocked(log).mockClear()

    const payload = await resolvePayloadFromPrompt(output.args.prompt as string)

    expect(payload).toContain('Skill A')
    expect(payload).toContain('Skill C')
    expect(payload).toContain('skill name="skill-b"')
    expect(payload).toContain('reference="true"')
    expect(payload).toContain('<skill name="skill-b" reference="true">Load the skill "skill-b" by the name.</skill>')

    // All-missing case: the payload is a pure reference payload, still enveloped
    const output2 = { args: { prompt: 'prompt', skills: ['no-such-skill'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)
    expect(output2.args.prompt).toContain('<envelope ')
    expect(output2.args.prompt).not.toContain('<task_skills>')
    expect(output2.args.prompt).not.toContain('skill name="no-such-skill"')
    expect(output2.args.prompt).toContain(`description="${ENVELOPE_DESCRIPTION}"`)
    expect(output2.args.prompt).toContain('<user_request>\nprompt\n</user_request>')
    expect(output2.args.skills).toBeUndefined()
    expect(log).toHaveBeenCalledWith(expect.any(Object), 'info', expect.stringContaining('Load the skill "no-such-skill" by the name.'))

    const payload2 = await resolvePayloadFromPrompt(output2.args.prompt as string)

    expect(payload2).toBe(`<task_skills>
<skill name="no-such-skill" reference="true">Load the skill "no-such-skill" by the name.</skill>
</task_skills>`)
  })
  it('stores a single skill in an envelope and uses empty string fallback when prompt is missing', async () => {
    registerSkillFiles({ 'only-skill': makeSkillFile({ content: '---\nname: only-skill\n---\n\n# Only\nSingle body.', mtimeMs: 150 }) })

    const output = { args: { prompt: 'original prompt', skills: ['only-skill'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
    expect(output.args.skills).toBeUndefined()
    expect(output.args.prompt).toContain('<envelope ')
    expect(output.args.prompt).not.toContain('<task_skills>')
    expect(output.args.prompt).not.toContain('<skill_envelope')
    expect(output.args.prompt).toContain(`description="${ENVELOPE_DESCRIPTION}"`)
    expect(output.args.prompt).not.toContain('Single body.')
    expect(output.args.prompt).toContain('<user_request>\noriginal prompt\n</user_request>')
    expect(output.args.prompt).toMatch(/<envelope id="[^"]+"[^>]*\/>\n<user_request>\noriginal prompt/)

    const payload = await resolvePayloadFromPrompt(output.args.prompt as string)

    expect(payload).toContain('only-skill')
    expect(payload).toContain('Single body.')
    registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })

    const output2: { args: Record<string, unknown> } = { args: { skills: ['skill-a'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)
    expect(output2.args.skills).toBeUndefined()
    expect(output2.args.prompt).toContain('<envelope ')
    expect(output2.args.prompt).not.toContain('<task_skills>')
    expect(output2.args.prompt).not.toContain('Skill A')
    expect(output2.args.prompt).toContain('<user_request>\n\n</user_request>')

    const payload2 = await resolvePayloadFromPrompt(output2.args.prompt as string)

    expect(payload2).toContain('Skill A')
  })
  it('does not double-envelope when the prompt already contains an envelope tag', async () => {
    registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })

    const output = { args: { prompt: 'original', skills: ['skill-a'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)

    const firstPrompt = output.args.prompt as string
    const firstKey = envelopeKeyFromPrompt(firstPrompt)

    expect((firstPrompt.match(/<envelope /g) ?? []).length).toBe(1)
    expect(firstKey).not.toBe('')
    expect(__peekEnvelopeForTests(firstKey)).toBeDefined()

    // Model echoes the enveloped prompt back with skills again
    mockBunFile.mockClear()

    const output2 = { args: { prompt: firstPrompt, skills: ['skill-a'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output2)

    // Exactly one envelope tag remains — the same key, no second envelope created
    const secondPrompt = output2.args.prompt as string

    expect((secondPrompt.match(/<envelope /g) ?? []).length).toBe(1)
    expect(envelopeKeyFromPrompt(secondPrompt)).toBe(firstKey)
    expect(mockBunFile).not.toHaveBeenCalled()
    expect(output2.args.skills).toBeUndefined()
    // The single envelope entry is still the first one (not replaced/duplicated)
    expect(__peekEnvelopeForTests(firstKey)).toBeDefined()
  })
  it('regression: prose envelope examples in the prompt do not trip the idempotency guard — a real UUID envelope is still created', async () => {
    registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })

    const prose = 'inject only a tiny `<envelope id="..." description="..."/>` tag, never `<envelope id="<uuid>" description="..."/>`'
    const output = { args: { prompt: prose, skills: ['skill-a'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)

    const prompt = output.args.prompt as string

    const realTagCount = (prompt.match(/<envelope id="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/g) ?? []).length

    // Prose must NOT count as "already enveloped": exactly one real UUID tag injected
    expect(realTagCount).toBe(1)
    // The prose example is preserved byte-for-byte inside the wrapper
    expect(prompt).toContain(prose)
    expect(prompt).toContain('<user_request>')

    // The stored payload is resolvable from the real tag (envelope was actually created)
    const payload = await resolvePayloadFromPrompt(prompt)

    expect(payload).toContain('Skill A')
  })
  it('uses the constant description for XML-special-character skill names and still unwraps', async () => {
    registerSkillFiles({
      'a&b': makeSkillFile({ content: '# A&B', mtimeMs: 100 }),
      'c"d': makeSkillFile({ content: '# C"D', mtimeMs: 150 }),
      'o\'brien': makeSkillFile({ content: '# OBrien', mtimeMs: 200 }),
      'foo>bar': makeSkillFile({ content: '# FooBar', mtimeMs: 250 }),
      'a>b&c"d\'e': makeSkillFile({ content: '# Combo', mtimeMs: 300 }),
    })

    const output = { args: { prompt: 'prompt', skills: ['a&b', 'c"d', 'o\'brien', 'foo>bar', 'a>b&c"d\'e'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)

    const prompt = output.args.prompt as string

    // The description is constant — special characters in skill names never
    // reach the attribute, so no XML escaping is needed.
    expect(prompt).toContain(`description="${ENVELOPE_DESCRIPTION}"`)
    expect(prompt).not.toContain('&amp;')

    // No literal '>' may appear inside the description: ENVELOPE_TAG_PATTERN's
    // [^>]* terminates at the first literal '>', so a raw '>' would make the
    // real tag unmatchable and the envelope would never unwrap.
    const description = (prompt.match(/description="([^"]*)"/)?.[1] ?? '')

    expect(description).not.toContain('>')

    // The injected tag still matches the UUID-precise pattern: a later
    // chat.message dispatch resolves the envelope instead of leaving the tag.
    const parts: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]

    await chatMessageHook(plugin)({ sessionID: 's' }, { message: {} as never, parts: parts as never })

    const unwrapped = (parts[0] as { type: string, text?: string }).text ?? ''

    expect(unwrapped).toContain('<task_skills>')
    expect(unwrapped).toContain('# FooBar')
    expect(unwrapped).toContain('# Combo')
    expect(unwrapped).not.toContain('<envelope ')
  })
  it('regression: the injected envelope tag matches the UUID-precise pattern with the real key even for awkward skill names', async () => {
    registerSkillFiles({ 'foo>bar': makeSkillFile({ content: '# FooBar', mtimeMs: 100 }) })

    const output = { args: { prompt: 'prompt', skills: ['foo>bar'] } }

    await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)

    const prompt = output.args.prompt as string
    const key = envelopeKeyFromPrompt(prompt)

    expect(key).not.toBe('')

    // The real, plugin-produced tag must match the UUID-precise pattern and the
    // captured id must equal the stored envelope key. A literal '>' in the
    // description would break the pattern's [^>]* and produce no match.
    const match = ENVELOPE_TAG_PATTERN.exec(prompt)

    expect(match).not.toBeNull()
    expect(match?.[1]).toBe(key)
  })
  describe('skill path and index', () => {
    // `ls -R .` pretty-print: section headers (workflows:, references:) followed
    // by their bare file names — no full .agents/skills/... paths.
    const treeStdout = '.:\nreferences  SKILL.md  workflows\n\n./references:\noptions.md\n\n./workflows:\ncreate.md\n'
    let lsShellMock: ReturnType<typeof vi.fn>
    beforeEach(async () => {
      lsShellMock = makeLsShellMock(0, treeStdout)
      plugin = await skillsLoaderPlugin({ client, directory: '/workspace', $: lsShellMock } as unknown as PluginInput)
    })
    it('includes path, skill_index, and the ls -R tree for resolved skills inside the payload', async () => {
      registerSkillFiles({ 'skill-a': makeSkillFile({ content: 'UNIQUE_CONTENT_XYZ', mtimeMs: 100 }) })

      const output = { args: { prompt: 'prompt', skills: ['skill-a'] } }

      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)
      expect(output.args.prompt).not.toContain('path=".agents/skills/skill-a/SKILL.md"')
      expect(output.args.prompt).not.toContain('<skill_index>')

      const payload = await resolvePayloadFromPrompt(output.args.prompt as string)

      expect(payload).not.toBeUndefined()

      const narrowedPayload = payload as string

      // The shell is invoked with `ls -R .` for the skill directory
      expect(lsShellMock).toHaveBeenCalledWith(['ls -R .'])
      expect(narrowedPayload).toContain('path=".agents/skills/skill-a/SKILL.md"')
      expect(narrowedPayload).toContain('<skill_index>')
      // ls -R tree content: bare file names and section headers
      expect(narrowedPayload).toContain('SKILL.md')
      expect(narrowedPayload).toContain('create.md')
      expect(narrowedPayload).toContain('options.md')
      expect(narrowedPayload).toContain('workflows:')
      expect(narrowedPayload).toContain('references:')
      // Tree order is preserved: each section header precedes its file
      expect(narrowedPayload.indexOf('references:')).toBeLessThan(narrowedPayload.indexOf('options.md'))
      expect(narrowedPayload.indexOf('workflows:')).toBeLessThan(narrowedPayload.indexOf('create.md'))
      expect(narrowedPayload.indexOf('<skill_index>')).toBeLessThan(narrowedPayload.indexOf('UNIQUE_CONTENT_XYZ'))
    })
    it('does not add path or skill_index to unresolved skills', async () => {
      registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })

      const output = { args: { prompt: 'prompt', skills: ['skill-a', 'skill-b'] } }

      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)

      const payload = await resolvePayloadFromPrompt(output.args.prompt as string)

      const resolved = (payload ?? '').match(/<skill name="skill-a"[^>]*>/)?.[0]

      expect(resolved).toBeDefined()
      expect(resolved).toContain('path=')

      const unresolved = (payload ?? '').match(/<skill name="skill-b"[^>]*>/)?.[0]

      expect(unresolved).toBeDefined()
      expect(unresolved).not.toContain('path=')
    })
    it('falls back to a flat SKILL.md-only index when ls -R exits non-zero', async () => {
      plugin = await skillsLoaderPlugin({ client, directory: '/workspace', $: makeLsShellMock(1, '') } as unknown as PluginInput)
      registerSkillFiles({ 'skill-a': makeSkillFile({ content: '# Skill A', mtimeMs: 100 }) })

      const output = { args: { prompt: 'prompt', skills: ['skill-a'] } }

      await hook(plugin)({ tool: 'task', sessionID: 's', callID: 'c' }, output)

      const payload = await resolvePayloadFromPrompt(output.args.prompt as string)

      expect(payload).toContain('Skill A')
      expect(payload).toContain('path=".agents/skills/skill-a/SKILL.md"')
      expect(payload).toContain('<skill_index>')
      // Fallback index is the flat path, not the ls -R tree
      expect(payload).toContain('.agents/skills/skill-a/SKILL.md')
      expect(payload).not.toContain('workflows:')
    })
  })
  describe('chat.message — envelope unwrap', () => {
    const dispatch = async (parts: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> => {
      await chatMessageHook(plugin)({ sessionID: 's' }, { message: {} as never, parts: parts as never })
      return parts
    }

    it('replaces the envelope tag with the full payload, byte-identical, and drops the tag', async () => {
      const payload = `<task_skills>
<skill name="skill-a" path=".agents/skills/skill-a/SKILL.md">
<skill_index>
.agents/skills/skill-a/SKILL.md
</skill_index>
---\nname: skill-a\n---\n\n# Skill A\nBody of skill A.
</skill>
</task_skills>`
      const key = await createEnvelope(payload, { skills: [{ name: 'skill-a', mtimeMs: 100 }], unresolved: [] })
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text: `${envelopeTag(key)}\n\n<user_request>\noriginal prompt\n</user_request>\n` }]

      const dispatched = await dispatch(parts)

      expect(dispatched[0]).toEqual({ type: 'text', text: `${payload}\n\n<user_request>\noriginal prompt\n</user_request>\n` })
      expect((dispatched[0].text as string)).not.toContain('<skill_envelope')
      expect((dispatched[0].text as string)).not.toContain('<envelope ')
      expect((dispatched[0].text as string)).toContain('Body of skill A.')
    })

    it('unwraps exactly once: a second dispatch with the same tag removes the tag and warns', async () => {
      const payload = '<task_skills>\n<skill name="skill-a" reference="true">Load the skill "skill-a" by the name.</skill>\n</task_skills>'
      const key = await createEnvelope(payload, { skills: [], unresolved: ['skill-a'] })
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text: envelopeTag(key) }]

      await dispatch(parts)
      expect(parts[0]).toEqual({ type: 'text', text: payload })

      vi.mocked(log).mockClear()

      const parts2: Array<Record<string, unknown>> = [{ type: 'text', text: envelopeTag(key) }]

      await dispatch(parts2)
      // The consumed placeholder is stripped (not left in place) with a warn
      expect(parts2[0]).toEqual({ type: 'text', text: '' })
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'warn', expect.stringContaining(key))
    })

    it('removes the tag and warns when the key is unknown (real UUID format)', async () => {
      const tag = envelopeTag('00000000-0000-4000-8000-000000000000')
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text: tag }]

      await dispatch(parts)

      expect(parts[0]).toEqual({ type: 'text', text: '' })
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'warn', expect.stringContaining('00000000-0000-4000-8000-000000000000'))
    })

    it('removes only the hallucinated tag, preserving surrounding text, and warns', async () => {
      const key = '11111111-1111-4111-8111-111111111111'
      const tag = envelopeTag(key)
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text: `prefix text\n${tag}\nsuffix text` }]

      await dispatch(parts)

      expect(parts[0]).toEqual({ type: 'text', text: 'prefix text\n\nsuffix text' })
      expect(log).toHaveBeenCalledWith(expect.any(Object), 'warn', expect.stringContaining(key))
    })

    it('is a no-op when no text part contains an envelope tag, leaving the parts array untouched', async () => {
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text: 'plain message' }]
      const before = parts

      await dispatch(parts)

      expect(parts).toBe(before)
      expect(parts[0]).toEqual({ type: 'text', text: 'plain message' })
    })

    it.each([
      { desc: 'a non-self-closing envelope tag with an id', text: '<envelope id="somekey">' },
      { desc: 'an envelope tag with no id attribute', text: '<envelope description="whatever"/>' },
      { desc: 'a bare envelope hint without a trailing space', text: '<envelope' },
      { desc: 'a self-closing envelope tag with a non-UUID id', text: '<envelope id="somekey"/>' },
      { desc: 'a non-self-closing envelope tag with a non-UUID id', text: '<envelope id="K">' },
    ])('is a no-op for $desc: parts and text untouched, no warn logged', async ({ text }) => {
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text }]
      const before = parts

      await dispatch(parts)

      expect(parts).toBe(before)
      expect(parts[0]).toEqual({ type: 'text', text })
      expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'warn', expect.any(String))
    })

    it('regression: prose envelope examples (id="...", id="<uuid>") in a text part are left untouched with NO warn', async () => {
      const prose = 'inject only a tiny `<envelope id="..." description="..."/>` tag, never `<envelope id="<uuid>" description="..."/>`'
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text: prose }]
      const before = parts

      vi.mocked(log).mockClear()
      await dispatch(parts)

      expect(parts).toBe(before)
      expect(parts[0]).toEqual({ type: 'text', text: prose })
      expect(log).not.toHaveBeenCalledWith(expect.any(Object), 'warn', expect.any(String))
    })

    it('skips non-text parts without error and leaves them untouched', async () => {
      const key = await createEnvelope('<task_skills>\n<skill name="skill-a" reference="true">Load the skill "skill-a" by the name.</skill>\n</task_skills>', { skills: [], unresolved: ['skill-a'] })
      const toolPart = { type: 'tool', tool: 'bash', callID: 'c1', state: { status: 'running' } }
      const parts: Array<Record<string, unknown>> = [toolPart, { type: 'text', text: envelopeTag(key) }]

      await dispatch(parts)

      expect(parts[0]).toBe(toolPart)
      expect(parts[1]).toEqual({ type: 'text', text: '<task_skills>\n<skill name="skill-a" reference="true">Load the skill "skill-a" by the name.</skill>\n</task_skills>' })
    })

    it('resolves multiple envelopes in one message, each replaced with its own payload, surrounding text intact', async () => {
      const payloadA = '<task_skills>\n<skill name="skill-a">AAA</skill>\n</task_skills>'
      const payloadB = '<task_skills>\n<skill name="skill-b">BBB</skill>\n</task_skills>'
      const keyA = await createEnvelope(payloadA, { skills: [], unresolved: [] })
      const keyB = await createEnvelope(payloadB, { skills: [], unresolved: [] })
      const text = `pre\ntext\n${envelopeTag(keyA)}\nmid\ntext\n${envelopeTag(keyB)}\npost\ntext`
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text }]

      await dispatch(parts)

      expect(parts[0]).toEqual({ type: 'text', text: `pre\ntext\n${payloadA}\nmid\ntext\n${payloadB}\npost\ntext` })
    })

    it('resolves an envelope regardless of attribute order', async () => {
      const payload = '<task_skills>\n<skill name="skill-a">AAA</skill>\n</task_skills>'
      const key = await createEnvelope(payload, { skills: [], unresolved: [] })
      const text = `pre\n<envelope description="${ENVELOPE_DESCRIPTION}" id="${key}"/>\npost`
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text }]

      await dispatch(parts)

      expect(parts[0]).toEqual({ type: 'text', text: `pre\n${payload}\npost` })
    })

    it('does not disturb content before or after the envelope block, including a code fence', async () => {
      const payload = '<task_skills>\n<skill name="skill-a" reference="true">Load the skill "skill-a" by the name.</skill>\n</task_skills>'
      const key = await createEnvelope(payload, { skills: [], unresolved: ['skill-a'] })
      const text = `prefix\n${envelopeTag(key)}\n\n\`\`\`\nconst x = 1\n\`\`\`\nsuffix`
      const parts: Array<Record<string, unknown>> = [{ type: 'text', text }]

      await dispatch(parts)

      expect(parts[0]).toEqual({ type: 'text', text: `prefix\n${payload}\n\n\`\`\`\nconst x = 1\n\`\`\`\nsuffix` })
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

      expect(output.jsonSchema).toBeDefined()

      const jsonSchema = output.jsonSchema as NonNullable<ToolHookOutput['jsonSchema']>
      const properties = jsonSchema.properties as Record<string, { type?: string, items?: { type: string }, description?: string }>

      expect(properties.skills).toBeDefined()

      const skills = properties.skills as { type?: string, items?: { type: string }, description?: string }

      expect(skills.type).toBe('array')
      expect(skills.items).toEqual({ type: 'string' })
      expect(skills.description).toContain('.agents/skills')
      expect(properties.prompt).toBeDefined()

      const prompt = properties.prompt as { type?: string, items?: { type: string }, description?: string }

      expect(prompt.type).toBe('string')
      expect(jsonSchema.required).not.toContain('skills')
    })
    it('does not modify non-task tool or tool with missing jsonSchema', async () => {
      const output1: ToolHookOutput = { description: 'x', parameters: {}, jsonSchema: { type: 'object', properties: { filePath: { type: 'string' } } } }

      await applyDefinitionHook({ toolID: 'write' }, output1)

      const jsonSchema1 = output1.jsonSchema as NonNullable<ToolHookOutput['jsonSchema']>
      const properties1 = jsonSchema1.properties as Record<string, { type?: string, items?: { type: string }, description?: string }>

      expect(properties1.skills).toBeUndefined()
      expect(properties1.filePath).toBeDefined()

      const output2: ToolHookOutput = { description: 'x', parameters: {} }

      await applyDefinitionHook({ toolID: 'task' }, output2)
      expect(output2.jsonSchema).toBeUndefined()
    })
    it('initializes missing properties and is idempotent', async () => {
      const output1: ToolHookOutput = { description: 'x', parameters: {}, jsonSchema: { type: 'object' } }

      await applyDefinitionHook({ toolID: 'task' }, output1)

      expect(output1.jsonSchema).toBeDefined()

      const jsonSchema1 = output1.jsonSchema as NonNullable<ToolHookOutput['jsonSchema']>
      const properties1 = jsonSchema1.properties as Record<string, { type?: string, items?: { type: string }, description?: string }>

      expect(properties1).toBeDefined()

      expect(properties1.skills).toBeDefined()

      const skills1 = properties1.skills as { type?: string, items?: { type: string }, description?: string }

      expect(skills1.type).toBe('array')

      const output2: ToolHookOutput = { description: 'x', parameters: {}, jsonSchema: { type: 'object', properties: { skills: { type: 'array', items: { type: 'string' }, description: 'custom skills' }, prompt: { type: 'string' } } } }

      await applyDefinitionHook({ toolID: 'task' }, output2)

      const jsonSchema2 = output2.jsonSchema as NonNullable<ToolHookOutput['jsonSchema']>
      const properties2 = jsonSchema2.properties as Record<string, { type?: string, items?: { type: string }, description?: string }>

      expect(properties2.skills).toBeDefined()

      const skills2 = properties2.skills as { type?: string, items?: { type: string }, description?: string }

      expect(skills2.description).toBe('custom skills')
      expect(skills2.type).toBe('array')

      expect(properties2.prompt).toBeDefined()
    })
  })
})
