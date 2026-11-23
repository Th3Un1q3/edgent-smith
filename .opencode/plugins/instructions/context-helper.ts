import { InstructionMeta, ResolvedInstruction } from '../types/instructions'

interface InstructionIndexer {
  forFiles(filePaths: string[]): Promise<InstructionMeta[]>
  loadBody(path: string): Promise<string>
  allPaths?: readonly string[]
}

/**
Options passed to the helper constructor.
*/
export interface InstructionContextHelperOptions {
  indexerFactory: () => Promise<InstructionIndexer>
}

/**
Count non-wildcard literal segments in a glob pattern.
*/
function calcSpecificity(applyTo: string): number {
  const segments = applyTo.split('/')
  return segments.reduce((score, seg) => {
    return seg === '' || /\*/.test(seg) ? score : score + 1
  }, 0)
}

/**
Default a missing path list so `allPaths` is always an array.
*/
function toAllPaths(paths?: readonly string[]): readonly string[] {
  return paths ?? []
}

/**
Order by descending glob specificity, then ascending description for a deterministic tiebreak.
*/
function compareInstructions(a: InstructionMeta, b: InstructionMeta): number {
  return calcSpecificity(b.applyTo) - calcSpecificity(a.applyTo) || a.description.localeCompare(b.description)
}

/**
Skip the sort entirely when nothing matched; callers observe no sort on an empty result.
*/
function sortBySpecificity(metas: InstructionMeta[]): InstructionMeta[] {
  return metas.length === 0 ? [] : [...metas].sort(compareInstructions)
}

export class InstructionContextHelper {
  private indexerFactory: () => Promise<InstructionIndexer>

  allPaths: readonly string[] = []

  constructor(options: InstructionContextHelperOptions) {
    this.indexerFactory = options.indexerFactory
  }

  /**
  Resolve ALL matching instructions with full bodies loaded for every one of them.
  */
  async resolveInstructions(filePaths: string[]): Promise<ResolvedInstruction[]> {
    if (filePaths.length === 0) return []

    const indexer = await this.indexerFactory()
    this.allPaths = toAllPaths(indexer.allPaths)
    const metas = await indexer.forFiles(filePaths)
    const sorted = sortBySpecificity(metas)

    const result: ResolvedInstruction[] = []

    for (const meta of sorted) {
      const content = await indexer.loadBody(meta.path)

      result.push({
        description: meta.description,
        applyTo: meta.applyTo,
        idempotencyKey: `instruction_load:${meta.path}`,
        content,
        path: meta.path,
      })
    }

    return result
  }
}

export { type InstructionMeta, type ResolvedInstruction } from '../types/instructions'
