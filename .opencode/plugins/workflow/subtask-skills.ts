import { getClient } from '../helpers/runtime/service-client'
import { toErrorMessage } from './subtask-log'
import type { LogFunction } from './contracts'

const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i

// Structural shape of the native `Skill.Info` record, so both the plugin skill
// domain and the server client satisfy it without importing the schema package.
export interface SkillRecord {
  readonly name: string
  readonly description?: string
  readonly path?: string
  readonly content: string
}

export type SkillLister = (directory?: string) => Promise<readonly SkillRecord[]>

// The native skill list is the only source of skill ids: nothing on this path
// reads a SKILL.md from disk.
const listNativeSkills: SkillLister = async (directory) => {
  const client = await getClient(undefined, directory)
  const response = await client.skill.list(directory === undefined ? undefined : { location: { directory } })
  return response.data
}

export interface SkillInjectionOptions {
  directory?: string
  list?: SkillLister | undefined
  log?: LogFunction
}

const reportListFailure = (options: SkillInjectionOptions, error: unknown): void => {
  options.log?.(`skill list failed: ${toErrorMessage(error)}`)
}

const listSkillRecords = async (
  options: SkillInjectionOptions,
): Promise<readonly SkillRecord[] | undefined> => {
  try {
    return await (options.list ?? listNativeSkills)(options.directory)
  }
  catch (error) {
    reportListFailure(options, error)
  }
}

const isSkillName = (name: string): boolean => SKILL_NAME_PATTERN.test(name)

const findSkill = (byName: Map<string, SkillRecord>, name: string): SkillRecord | undefined =>
  isSkillName(name) ? byName.get(name) : undefined

const logMissing = (log: LogFunction | undefined, name: string): void => {
  log?.(`skill not found: ${name}`)
}

const hasSkills = (skills: string[] | undefined): skills is string[] =>
  skills !== undefined && skills.length > 0

const knownIds = (
  skills: string[],
  records: readonly SkillRecord[],
  log?: LogFunction,
): string[] => {
  const byName = new Map(records.map(record => [record.name, record]))
  const ids: string[] = []
  for (const name of skills) {
    if (findSkill(byName, name) === undefined) {
      logMissing(log, name)
      continue
    }
    ids.push(name)
  }
  return ids
}

// A failed list is not a reason to drop valid names: the native prompt body
// resolves them itself, so only names that cannot be skill ids are discarded.
const passthroughIds = (skills: string[]): string[] => skills.filter(name => isSkillName(name))

const resolveFromList = (
  skills: string[],
  records: readonly SkillRecord[] | undefined,
  log?: LogFunction,
): string[] =>
  records === undefined ? passthroughIds(skills) : knownIds(skills, records, log)

export const resolveSkillIds = async (
  skills: string[] | undefined,
  options: SkillInjectionOptions = {},
): Promise<string[]> => {
  return hasSkills(skills) ? resolveFromList(skills, await listSkillRecords(options), options.log) : []
}
