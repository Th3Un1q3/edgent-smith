import Bun, { Glob } from "bun"
import { CustomInstructionFrontMatter, InstructionMeta } from "../types/instructions"
import { load } from "js-yaml"

type IndexOptions = {
  type: "custom" | "copilot"
  instructionsGlob: string
  agent: string
  currentWorkingDirectory: string
  log?: (message: string) => Promise<void>
}

const createIndex = async <T extends CustomInstructionFrontMatter>(options: IndexOptions) => {
  const logger = options.log || ((_message: string) => Promise.resolve())
  const instructionsGlob = new Glob(options.instructionsGlob)

  const index: Record<string, InstructionMeta[]> = {
    "all": []
  }

  for await (const filePath of instructionsGlob.scan({ cwd: options.currentWorkingDirectory, dot: true, absolute: true })) {
    const file = Bun.file(filePath)
    const content = await file.text()

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) {
      continue
    }

    const frontmatterContent = frontmatterMatch[1]

    if (!frontmatterContent) {
      continue
    }

    try {
      const parsedFrontmatter: T = load(frontmatterContent) as T
      const applyTo = parsedFrontmatter.applyTo || "all"

      if (['', '**', '**/*.*', '**/*'].includes(applyTo)) {
        continue
      }

      const appliesToAgentsGlob = new Glob(parsedFrontmatter.appliesToAgents || '**')

      await logger(`Checking instruction file: ${filePath}, appliesToAgents: ${appliesToAgentsGlob}, agent: ${options.agent}`)

      if (!appliesToAgentsGlob.match(options.agent)) {
        await logger(`Skipping instruction file: ${filePath}, appliesToAgents: ${parsedFrontmatter.appliesToAgents || '**'}, agent: ${options.agent}`)
        continue
      }

      if (parsedFrontmatter.excludeAgents) {
        const excludedAgentsGlob = new Glob(parsedFrontmatter.excludeAgents)
        if (excludedAgentsGlob.match(options.agent)) {
          continue
        }
      }

      index[applyTo] = index[applyTo] || []

      index[applyTo].push({
        description: parsedFrontmatter.description || `Instruction applies to files matching the pattern "${applyTo}, instruction file: ${filePath}"`,
        path: filePath,
        applyTo: applyTo,
        excludePaths: parsedFrontmatter.excludePaths,
      })
    } catch {
      continue
    }
  }

  return {
    forFiles: async (filePaths: string[]): Promise<InstructionMeta[]> => {
      const filePathsRelative = filePaths.map(filePath => filePath.startsWith(options.currentWorkingDirectory) ? filePath.slice(options.currentWorkingDirectory.length + 1) : filePath)

      const patterns: string[] = Object.keys(index);

      await logger(`Index patterns: ${patterns.join(', ')}`)

      const matchingPatterns = patterns.filter(pattern => {
        const glob = new Glob(pattern);
        return filePathsRelative.some(filePath => glob.match(filePath));
      });

      await logger(`Matching patterns for files [${filePaths.join(', ')}]: ${matchingPatterns.join(', ')}`)

      const matchingInstructions = matchingPatterns.reduce((accumulator: InstructionMeta[], pattern) => {
        const instructions = index[pattern] || [];
        return accumulator.concat(instructions);
      }, []);

      await logger(`Matching instructions for files [${filePaths.join(', ')}]: ${matchingInstructions.map(index_ => index_.path).join(', ')}`)

      const filteredInstructions = matchingInstructions.filter(instruction => {
        if (!instruction.excludePaths) {
          return true;
        }
        const excludeGlob = new Glob(instruction.excludePaths);
        return filePathsRelative.some(filePath => !excludeGlob.match(filePath));
      });

      await logger(`Filtered instructions for files [${filePaths.join(', ')}]: ${filteredInstructions.map(index_ => index_.path).join(', ')}`)

      return filteredInstructions;
    }
  }
}

export { createIndex }


