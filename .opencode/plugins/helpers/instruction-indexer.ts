import Bun, { Glob } from 'bun'
import { CustomInstructionFrontMatter, InstructionMeta } from '../types/instructions'
import { load } from 'js-yaml'
import { isGlobMatch } from './glob-match'

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

const parseFrontmatter = <T extends CustomInstructionFrontMatter>(content: string): T | undefined => {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return undefined

  const frontmatterContent = frontmatterMatch[1]
  if (!frontmatterContent) return undefined

  try {
    return load(frontmatterContent) as T
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
): Promise<InstructionMeta | undefined> => {
  try {
    const applyTo = parsedFrontmatter.applyTo || 'all'

    if (isGlobalApplyTo(applyTo)) {
      return undefined
    }

    const appliesToAgents = parsedFrontmatter.appliesToAgents || '**'

    await logger(`Checking instruction file: ${filePath}, appliesToAgents: ${appliesToAgents}, agent: ${agent}`)

    if (!isAgentAllowed(appliesToAgents, agent)) {
      await logger(`Skipping instruction file: ${filePath}, appliesToAgents: ${appliesToAgents}, agent: ${agent}`)
      return undefined
    }

    if (isAgentExcluded(parsedFrontmatter.excludeAgents, agent)) {
      return undefined
    }

    return {
      description: parsedFrontmatter.description || `Instruction applies to files matching the pattern "${applyTo}, instruction file: ${filePath}"`,
      path: filePath,
      applyTo,
      excludePaths: parsedFrontmatter.excludePaths,
    }
  }
  catch {
    return undefined
  }
}

const createIndex = async <T extends CustomInstructionFrontMatter>(options: IndexOptions) => {
  const logger = options.log || ((_message: string) => Promise.resolve())
  const instructionsGlob = new Glob(options.instructionsGlob)

  const index: Record<string, InstructionMeta[]> = {
    all: [],
  }

  for await (const filePath of instructionsGlob.scan({ cwd: options.currentWorkingDirectory, dot: true, absolute: true })) {
    const file = Bun.file(filePath)
    const content = await file.text()

    const parsedFrontmatter = parseFrontmatter<T>(content)
    if (!parsedFrontmatter) {
      continue
    }

    const instruction = await buildInstruction(parsedFrontmatter, filePath, options.agent, logger)
    if (!instruction) {
      continue
    }

    index[instruction.applyTo] ||= []

    index[instruction.applyTo].push(instruction)
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
      if (!excludePaths) {
        return true
      }
      return filePathsRelative.some(filePath => !isGlobMatch(excludePaths, filePath))
    })

    await logger(`Filtered instructions for files [${filePaths.join(', ')}]: ${filteredInstructions.map(index_ => index_.path).join(', ')}`)

    return filteredInstructions
  }

  return {
    forFiles,
    loadBody: loadBody.bind(undefined),
  }
}

export { createIndex }
