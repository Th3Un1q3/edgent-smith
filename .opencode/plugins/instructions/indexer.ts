import Bun, { Glob } from 'bun'
import { CustomInstructionFrontMatter, InstructionMeta } from '../types/instructions'
import { load } from 'js-yaml'
import { isGlobMatch } from '../helpers/runtime/glob-match'

const loadBody = async (filePath: string): Promise<string> => {
  const file = Bun.file(filePath)
  if (!await file.exists()) throw new Error(`Instruction file not found: ${filePath}`)
  const content = await file.text()
  // Strip YAML frontmatter — extract body after closing ---
  const bodyMatch = content.match(/^---[\s\S]*?---\s*\n?\s*/)
  return bodyMatch ? content.slice(bodyMatch[0].length).trim() : ''
}

type IndexOptions = {
  type: 'custom' | 'copilot'
  instructionsGlob: string
  agent: string
  currentWorkingDirectory: string
  log?: (message: string) => Promise<void>
}

const GLOBAL_APPLY_TO_PATTERNS = new Set(['', '**', '**/*.*', '**/*'])

const isGlobalApplyTo = (applyTo: string): boolean =>
  GLOBAL_APPLY_TO_PATTERNS.has(applyTo)

const isAgentAllowed = (appliesToAgents: string, agent: string): boolean =>
  isGlobMatch(appliesToAgents, agent)

const isAgentExcluded = (excludeAgents: string | undefined, agent: string): boolean =>
  Boolean(excludeAgents && isGlobMatch(excludeAgents, agent))

const attemptLoad = <T>(frontmatterContent: string): T | undefined => {
  try {
    return load(frontmatterContent) as T
  }
  catch {
    return undefined
  }
}

const parseFrontmatter = <T extends CustomInstructionFrontMatter>(content: string): T | undefined => {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return undefined

  const frontmatterContent = frontmatterMatch[1]
  return frontmatterContent ? attemptLoad<T>(frontmatterContent) : undefined
}

const resolveRoutingDefaults = (frontmatter: CustomInstructionFrontMatter): { applyTo: string, appliesToAgents: string } => ({
  applyTo: frontmatter.applyTo || 'all',
  appliesToAgents: frontmatter.appliesToAgents || '**',
})

const resolveDescription = (description: string | undefined, applyTo: string, filePath: string): string =>
  description || `Instruction applies to files matching the pattern "${applyTo}, instruction file: ${filePath}"`

const attemptInstruction = async <A>(run: () => Promise<A>): Promise<A | undefined> => {
  try {
    return await run()
  }
  catch {
    return undefined
  }
}

const buildInstruction = async <T extends CustomInstructionFrontMatter>(
  parsedFrontmatter: T,
  filePath: string,
  agent: string,
  logger: (message: string) => Promise<void>,
): Promise<InstructionMeta | undefined> => attemptInstruction(async () => {
  const { applyTo, appliesToAgents } = resolveRoutingDefaults(parsedFrontmatter)

  if (isGlobalApplyTo(applyTo)) {
    return
  }

  await logger(`Checking instruction file: ${filePath}, appliesToAgents: ${appliesToAgents}, agent: ${agent}`)

  if (!isAgentAllowed(appliesToAgents, agent)) {
    await logger(`Skipping instruction file: ${filePath}, appliesToAgents: ${appliesToAgents}, agent: ${agent}`)
    return
  }

  return instructionMeta(parsedFrontmatter, applyTo, filePath, agent)
})

const instructionMeta = (
  parsedFrontmatter: CustomInstructionFrontMatter,
  applyTo: string,
  filePath: string,
  agent: string,
): InstructionMeta | undefined =>
  isAgentExcluded(parsedFrontmatter.excludeAgents, agent)
    ? undefined
    : {
        description: resolveDescription(parsedFrontmatter.description, applyTo, filePath),
        path: filePath,
        applyTo,
        excludePaths: parsedFrontmatter.excludePaths,
      }

const instructionFromContent = async <T extends CustomInstructionFrontMatter>(
  content: string,
  filePath: string,
  agent: string,
  logger: (message: string) => Promise<void>,
): Promise<InstructionMeta | undefined> => {
  const parsedFrontmatter = parseFrontmatter<T>(content)
  return parsedFrontmatter === undefined
    ? undefined
    : buildInstruction(parsedFrontmatter, filePath, agent, logger)
}

const pushInstruction = (index: Record<string, InstructionMeta[]>, instruction: InstructionMeta): void => {
  (index[instruction.applyTo] ??= []).push(instruction)
}

const indexInstructionFile = async <T extends CustomInstructionFrontMatter>(
  filePath: string,
  index: Record<string, InstructionMeta[]>,
  allPaths: Set<string>,
  options: IndexOptions,
  logger: (message: string) => Promise<void>,
): Promise<void> => {
  allPaths.add(filePath)

  const file = Bun.file(filePath)
  const content = await file.text()

  const instruction = await instructionFromContent<T>(content, filePath, options.agent, logger)
  if (!instruction) return

  pushInstruction(index, instruction)
}

const noLog = (): Promise<void> => Promise.resolve()

const createIndex = async <T extends CustomInstructionFrontMatter>(options: IndexOptions) => {
  const { log: logger = noLog } = options
  const instructionsGlob = new Glob(options.instructionsGlob)

  const index: Record<string, InstructionMeta[]> = {
    all: [],
  }

  const allPaths = new Set<string>()

  for await (const filePath of instructionsGlob.scan({ cwd: options.currentWorkingDirectory, dot: true, absolute: true })) {
    await indexInstructionFile<T>(filePath, index, allPaths, options, logger)
  }

  const forFiles = async (filePaths: string[]): Promise<InstructionMeta[]> => {
    const filePathsRelative = filePaths.map(filePath => filePath.startsWith(options.currentWorkingDirectory) ? filePath.slice(options.currentWorkingDirectory.length + 1) : filePath)

    const patterns: string[] = Object.keys(index)

    await logger(`Index patterns: ${patterns.join(', ')}`)

    const matchingPatterns = patterns.filter((pattern) => {
      return filePathsRelative.some(filePath => isGlobMatch(pattern, filePath))
    })

    await logger(`Matching patterns for files [${filePaths.join(', ')}]: ${matchingPatterns.join(', ')}`)

    const matchingInstructions = matchingPatterns.reduce((accumulator: InstructionMeta[], pattern) => {
      const instructions = index[pattern] || []
      return [...accumulator, ...instructions]
    }, [])

    await logger(`Matching instructions for files [${filePaths.join(', ')}]: ${matchingInstructions.map(index_ => index_.path).join(', ')}`)

    const filteredInstructions = matchingInstructions.filter((instruction) => {
      const excludePaths = instruction.excludePaths
      return excludePaths ? filePathsRelative.some(filePath => !isGlobMatch(excludePaths, filePath)) : true
    })

    await logger(`Filtered instructions for files [${filePaths.join(', ')}]: ${filteredInstructions.map(index_ => index_.path).join(', ')}`)

    return filteredInstructions
  }

  return {
    forFiles,
    loadBody: loadBody.bind(undefined),
    allPaths: [...allPaths],
  }
}

export { createIndex }
