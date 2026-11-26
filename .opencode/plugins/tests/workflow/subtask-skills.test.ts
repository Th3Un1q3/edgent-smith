import { describe, expect, it } from 'vitest'

import type { SkillLister } from '@plugins/workflow/subtask'
import { resolveSkillIds } from '@plugins/workflow/subtask-skills'
import { demoSkill, skillList, workspace } from '@tests/workflow/subtask-fixtures'

// ── skills ───────────────────────────────────────────────────────

const collectLogs = (): { logs: string[], log: (message: unknown) => void } => {
  const logs: string[] = []
  const log = (message: unknown): void => {
    logs.push(String(message))
  }
  return { logs, log }
}

describe('resolveSkillIds', () => {
  it('keeps the requested ids in the requested order and reads the list once', async () => {
    let calls = 0
    const records = [demoSkill({ name: 'second' }), demoSkill({ name: 'first' }), demoSkill({ name: 'unused' })]
    const list: SkillLister = async () => {
      calls += 1
      return records
    }

    const result = await resolveSkillIds(['first', 'second'], { directory: workspace, list })

    expect(result).toEqual(['first', 'second'])
    expect(calls).toBe(1)
  })

  it('drops an unknown name and logs the miss', async () => {
    const { logs, log } = collectLogs()

    const result = await resolveSkillIds(['demo', 'missing'], {
      directory: workspace,
      list: skillList([demoSkill()]),
      log,
    })

    expect(result).toEqual(['demo'])
    expect(logs).toEqual(['skill not found: missing'])
  })

  it('drops a name that fails the name pattern and logs the miss', async () => {
    const { logs, log } = collectLogs()

    const result = await resolveSkillIds(['../secret', 'demo'], {
      directory: workspace,
      list: skillList([demoSkill()]),
      log,
    })

    expect(result).toEqual(['demo'])
    expect(logs).toEqual(['skill not found: ../secret'])
  })

  it('passes pattern-valid names through when the list fails', async () => {
    const { logs, log } = collectLogs()
    const list: SkillLister = async () => {
      throw new Error('surface down')
    }

    const result = await resolveSkillIds(['demo', '../secret', 'other'], { directory: workspace, list, log })

    expect(result).toEqual(['demo', 'other'])
    expect(logs).toEqual(['skill list failed: surface down'])
  })

  it('returns no ids and skips the list when no skills are requested', async () => {
    let calls = 0
    const list: SkillLister = async () => {
      calls += 1
      return [demoSkill()]
    }

    await expect(resolveSkillIds(undefined, { directory: workspace, list })).resolves.toEqual([])
    await expect(resolveSkillIds([], { directory: workspace, list })).resolves.toEqual([])
    expect(calls).toBe(0)
  })
})
