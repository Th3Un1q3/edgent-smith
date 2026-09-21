import { InstructionMeta, ResolvedInstruction } from '../types/instructions'

// Re-export for convenience (tests import these from this module)

/**
Options passed to the helper constructor.
*/
export interface InstructionContextHelperOptions {
  indexerFactory: () => Promise<{
    forFiles(filePaths: string[]): Promise<InstructionMeta[]>
    loadBody(path: string): Promise<string>
  }>
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

export class InstructionContextHelper {
  private indexerFactory: () => Promise<{
    forFiles(filePaths: string[]): Promise<InstructionMeta[]>
    loadBody(path: string): Promise<string>
  }>

  constructor(options: InstructionContextHelperOptions) {
    this.indexerFactory = options.indexerFactory
  }

  /**
  Resolve ALL matching instructions with full bodies loaded for every one of them.
  */
  async resolveInstructions(filePaths: string[]): Promise<ResolvedInstruction[]> {
    if (filePaths.length === 0) return []

    const indexer = await this.indexerFactory()
    const metas = await indexer.forFiles(filePaths)
    if (metas.length === 0) return []

    // Sort: descending specificity, then ascending description for deterministic tiebreak
    const sorted = [...metas].sort((a: InstructionMeta, b: InstructionMeta) => {
      const sa = calcSpecificity(a.applyTo)
      const sb = calcSpecificity(b.applyTo)
      return sb === sa
        ? a.description.localeCompare(b.description) // ascending alphabetical
        : sb - sa // descending specificity
    })

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
