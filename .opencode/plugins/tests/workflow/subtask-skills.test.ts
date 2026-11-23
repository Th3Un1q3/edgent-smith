import { describe, expect, it } from 'vitest'

import { injectSkills } from '@plugins/workflow/subtask'
import type { SkillLister, SkillRecord } from '@plugins/workflow/subtask'
import { demoSkill, skillList, workspace } from '@tests/workflow/subtask-fixtures'

// ── skills ───────────────────────────────────────────────────────

const render = (records: SkillRecord[], skills: string[] = ['demo']): Promise<string> =>
  injectSkills('PROMPT', skills, { directory: workspace, list: skillList(records) })

const skillCases: Array<[string, SkillRecord, string[], string[]]> = [
  [
    'strips the leading frontmatter, keeps the description and the relative path',
    demoSkill(),
    ['description: Demo skill', 'path: .agents/skills/demo/SKILL.md', 'DEMO BODY\n\n---\n\nlater rule\n</skill>'],
    ['name: demo', 'Frontmatter description', workspace],
  ],
  ['falls back to the frontmatter description', demoSkill({ description: undefined }), ['description: Frontmatter description'], []],
  ['omits a missing path', demoSkill({ path: undefined }), ['<skill name="demo">'], ['path:']],
  ['omits a path outside the directory', demoSkill({ path: '/elsewhere/x/SKILL.md' }), [], ['path:', '/elsewhere']],
]

describe('injectSkills', () => {
  it.each(skillCases)('%s', async (_label, record, present, absent) => {
    const result = await render([record])
    for (const expected of present) {
      expect(result).toContain(expected)
    }
    for (const unexpected of absent) {
      expect(result).not.toContain(unexpected)
    }
  })

  it('preserves the envelope, the element, and the requested order', async () => {
    const records = [
      demoSkill({ name: 'second', content: 'SECOND', path: undefined, description: 'Second skill' }),
      demoSkill({ name: 'first', content: 'FIRST', path: undefined, description: 'First skill' }),
    ]
    const result = await injectSkills('PROMPT', ['first', 'second'], {
      directory: workspace,
      list: skillList(records),
    })

    expect(result).toBe(
      '<task_skills>\n'
      + '<skill name="first">\ndescription: First skill\nFIRST\n</skill>\n'
      + '<skill name="second">\ndescription: Second skill\nSECOND\n</skill>\n'
      + '</task_skills>\n\nPROMPT',
    )
  })

  it('logs a miss for an unknown or invalid name and skips it', async () => {
    const logs: string[] = []
    const result = await injectSkills('PROMPT', ['missing', '../secret'], {
      directory: workspace,
      list: skillList([]),
      log: (message) => { logs.push(String(message)) },
    })
    expect(result).toBe('PROMPT')
    expect(logs).toEqual(['skill not found: missing', 'skill not found: ../secret'])
  })

  it('leaves the prompt unchanged and logs when the native list fails', async () => {
    const logs: string[] = []
    const list: SkillLister = async () => {
      throw new Error('surface down')
    }
    const result = await injectSkills('PROMPT', ['demo'], {
      directory: workspace,
      list,
      log: (message) => { logs.push(String(message)) },
    })
    expect(result).toBe('PROMPT')
    expect(logs).toEqual(['skill list failed: surface down'])
  })

  it('leaves the prompt unchanged when no skills are requested', async () => {
    await expect(injectSkills('PROMPT', undefined, { directory: workspace })).resolves.toBe('PROMPT')
    await expect(injectSkills('PROMPT', [], { directory: workspace })).resolves.toBe('PROMPT')
  })
})
