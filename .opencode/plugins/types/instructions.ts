
interface CopilotInstructionFrontMatter {
  applyTo?: string          // file glob or "**"/"**/*.*"/"**/*" for global
  description?: string
}

interface CustomInstructionFrontMatter extends CopilotInstructionFrontMatter {
  appliesToAgents?: string      // include filter (glob patterns)
  excludeAgents?: string   // exclude filter (glob patterns)
  excludePaths?: string    // exclude filter (glob patterns)
}

// Index of instructions to keep it lightweight in memory
interface InstructionMeta {
  description: string
  path: string // path to complete instruction file (markdown with front matter)
  applyTo: string          // file glob or "**"/"**/*.*"/"**/*" for global
  excludePaths?: string    // exclude filter (glob patterns)
}

// On demand complete instruction with content
interface ResolvedInstruction {
  description?: string
  applyTo?: string
  path?: string            // NEW — added for idempotency token derivation and source reference
  idempotencyKey: string   // to prevent reapplying the same instruction multiple times
  content: string          // full markdown body after front matter stripped
}


export {
  CopilotInstructionFrontMatter,
  CustomInstructionFrontMatter,
  InstructionMeta,
  ResolvedInstruction
}