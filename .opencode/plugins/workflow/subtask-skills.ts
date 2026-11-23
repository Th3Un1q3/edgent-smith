import path from 'node:path'

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

// The native skill list is the only source of injected content: nothing on this
// path reads a SKILL.md from disk.
const listNativeSkills: SkillLister = async (directory) => {
  const client = await getClient(undefined, directory)
  const response = await client.skill.list(directory === undefined ? undefined : { location: { directory } })
  return response.data
}

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

// Only a leading YAML block is removed, so a `---` later in the body (a rule or
// a fence) survives untouched.
export const stripFrontmatter = (content: string): string => {
  const match = FRONTMATTER_PATTERN.exec(content)
  return match === null ? content : content.slice(match[0].length)
}

const FOLDED_SCALAR = /^[>|][+-]?$/

const unquote = (value: string): string => {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value)
  return quoted === null ? value : quoted[2]
}

const isFoldedEnd = (line: string): boolean => line.trim() !== '' && !/^\s/.test(line)

const foldedLines = (lines: string[], start: number): string[] => {
  const region = lines.slice(start)
  const end = region.findIndex(line => isFoldedEnd(line))
  return (end === -1 ? region : region.slice(0, end))
    .map(line => line.trim())
    .filter(line => line !== '')
}

const nonEmpty = (value: string): string | undefined => (value === '' ? undefined : value)

const canonicalScalar = (inline: string, lines: string[], index: number): string | undefined =>
  nonEmpty(
    inline !== '' && !FOLDED_SCALAR.test(inline)
      ? unquote(inline)
      : foldedLines(lines, index + 1).join(' '),
  )

// Fallback only: a description on the native record always wins.
export const frontmatterDescription = (content: string): string | undefined => {
  const block = FRONTMATTER_PATTERN.exec(content)
  if (block === null) {
    return
  }
  const lines = block[1].split(/\r?\n/)
  const index = lines.findIndex(line => /^description\s*:/.test(line))
  return index === -1 ? undefined : canonicalScalar(lines[index].replace(/^description\s*:\s*/, '').trim(), lines, index)
}

const collapse = (value: string): string => value.replaceAll(/\s+/g, ' ').trim()

const cleaned = (value: string | undefined): string | undefined => nonEmpty(collapse(value ?? ''))

const skillDescription = (record: SkillRecord): string | undefined =>
  cleaned(record.description) ?? cleaned(frontmatterDescription(record.content))

const OUTSIDE_RELATIVE = new Set(['', '..'])

const isInside = (relative: string): boolean =>
  !OUTSIDE_RELATIVE.has(relative)
  && !relative.startsWith(`..${path.sep}`)
  && !path.isAbsolute(relative)

const isAbsoluteString = (value: string | undefined): value is string =>
  value !== undefined && path.isAbsolute(value)

const formatRelative = (relative: string): string | undefined =>
  isInside(relative) ? relative.split(path.sep).join('/') : undefined

// A path outside the session directory is omitted rather than emitted absolute.
const relativeSkillPath = (
  skillPath: string | undefined,
  directory: string | undefined,
): string | undefined =>
  isAbsoluteString(skillPath) && isAbsoluteString(directory)
    ? formatRelative(path.relative(directory, skillPath))
    : undefined

const formatSkillBlock = (name: string, record: SkillRecord, directory?: string): string => {
  const lines = [`<skill name="${name}">`]
  const description = skillDescription(record)
  if (description !== undefined) {
    lines.push(`description: ${description}`)
  }
  const relative = relativeSkillPath(record.path, directory)
  if (relative !== undefined) {
    lines.push(`path: ${relative}`)
  }
  lines.push(stripFrontmatter(record.content).trimEnd(), '</skill>')
  return lines.join('\n')
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

const findSkill = (byName: Map<string, SkillRecord>, name: string): SkillRecord | undefined =>
  SKILL_NAME_PATTERN.test(name) ? byName.get(name) : undefined

const logMissing = (log: LogFunction | undefined, name: string): void => {
  log?.(`skill not found: ${name}`)
}

const buildSkillBlocks = (
  skills: string[],
  records: readonly SkillRecord[],
  directory?: string,
  log?: LogFunction,
): string[] => {
  const byName = new Map(records.map(record => [record.name, record]))
  const blocks: string[] = []
  for (const name of skills) {
    const record = findSkill(byName, name)
    if (record === undefined) {
      logMissing(log, name)
      continue
    }
    blocks.push(formatSkillBlock(name, record, directory))
  }
  return blocks
}

const hasSkills = (skills: string[] | undefined): skills is string[] =>
  skills !== undefined && skills.length > 0

const wrapSkills = (blocks: string[], prompt: string): string =>
  blocks.length === 0 ? prompt : `<task_skills>\n${blocks.join('\n')}\n</task_skills>\n\n${prompt}`

const injectInto = async (
  prompt: string,
  skills: string[] | undefined,
  options: SkillInjectionOptions,
): Promise<string> => {
  if (!hasSkills(skills)) {
    return prompt
  }

  const records = await listSkillRecords(options)
  if (records === undefined) {
    return prompt
  }

  const blocks = buildSkillBlocks(skills, records, options.directory, options.log)
  return wrapSkills(blocks, prompt)
}

export const injectSkills = async (
  prompt: string,
  skills: string[] | undefined,
  options: SkillInjectionOptions = {},
): Promise<string> => injectInto(prompt, skills, options)
