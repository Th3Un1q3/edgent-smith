import { InstructionMeta, ResolvedInstruction } from "../types/instructions"

// Re-export for convenience (tests import these from this module)


export interface InstructionContextHelperOptions {
  indexerFactory: () => Promise<{
    forFiles(filePaths: string[]): Promise<InstructionMeta[]>
    loadBody(path: string): Promise<string>
  }>
  maxChars?: number
  blockOverheadChars?: number
}

/** Count non-wildcard literal segments in a glob pattern. */
function calcSpecificity(applyTo: string): number {
  const segments = applyTo.split("/")
  return segments.reduce((score, seg) => {
    if (seg === "" || /\*/.test(seg)) return score
    return score + 1
  }, 0)
}

export class InstructionContextHelper {
  private indexerFactory: () => Promise<{
    forFiles(filePaths: string[]): Promise<InstructionMeta[]>
    loadBody(path: string): Promise<string>
  }>
  private maxChars: number
  private blockOverheadChars: number

  constructor(options: InstructionContextHelperOptions) {
    this.indexerFactory = options.indexerFactory
    this.maxChars = options.maxChars ?? 8192
    this.blockOverheadChars = options.blockOverheadChars ?? 200
  }

  async resolveInstructions(
    filePaths: string[],
    options?: { maxChars?: number; blockOverheadChars?: number },
  ): Promise<ResolvedInstruction[]> {
    if (filePaths.length === 0) return []

    const effectiveMaxChars = options?.maxChars ?? this.maxChars

    // Zero budget → nothing fits
    if (effectiveMaxChars <= 0) return []

    const effectiveOverhead = options?.blockOverheadChars ?? this.blockOverheadChars

    const indexer = await this.indexerFactory()
    const metas = await indexer.forFiles(filePaths)
    if (metas.length === 0) return []

    // Sort: descending specificity, then ascending description for deterministic tiebreak
    // eslint-disable-next-line unicorn/no-array-sort -- .toSorted() unavailable before ES2023 target
    const sorted = [...metas].sort((a: InstructionMeta, b: InstructionMeta) => {
      const sa = calcSpecificity(a.applyTo)
      const sb = calcSpecificity(b.applyTo)
      if (sb !== sa) return sb - sa // descending specificity
      return a.description.localeCompare(b.description) // ascending alphabetical
    })

    const result: ResolvedInstruction[] = []
    let accumulated = 0

    for (const meta of sorted) {
      // Load body to get accurate size before capping decision
      const content = await indexer.loadBody(meta.path)
      const totalChars = content.length + effectiveOverhead

      if (accumulated + totalChars > effectiveMaxChars) {
        result.push({
          description: meta.description,
          applyTo: meta.applyTo,
          idempotencyKey: `instruction_load:${meta.path}`,
          content: `[Instruction content omitted due to size constraints.]`,
          path: meta.path,
        })
        continue
      }

      accumulated += totalChars

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

export { type InstructionMeta, type ResolvedInstruction } from "../types/instructions"