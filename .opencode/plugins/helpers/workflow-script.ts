import type { WorkflowHelpers } from './workflow-types'

const NEWLINE = '\n'

interface ForbiddenToken {
  name: string
  pattern: RegExp
}

const FORBIDDEN_TOKENS: readonly ForbiddenToken[] = [
  { name: 'require(', pattern: /\brequire\s*\(/ },
  { name: 'import(', pattern: /\bimport\s*\(/ },
  { name: 'import.meta', pattern: /\bimport\s*\.\s*meta\b/ },
  { name: 'import', pattern: /\bimport\s/ },
  { name: 'new Function', pattern: /\bnew\s+Function\b/ },
  { name: 'Function(', pattern: /\bFunction\s*\(/ },
  { name: 'eval(', pattern: /\beval\s*\(/ },
  { name: 'fetch(', pattern: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'WebSocket', pattern: /\bWebSocket\b/ },
  { name: 'globalThis', pattern: /\bglobalThis\b/ },
  { name: 'child_process', pattern: /\bchild_process\b/ },
  { name: 'node:', pattern: /node:/ },
  { name: 'constructor', pattern: /\bconstructor\b/ },
  { name: 'process', pattern: /\bprocess\b/ },
  { name: 'global', pattern: /\bglobal\b/ },
  { name: 'Bun', pattern: /\bBun\b/ },
  { name: 'Deno', pattern: /\bDeno\b/ },
]

const stripLineComment = (script: string, start: number): number => {
  let index = start
  while (index < script.length && script[index] !== NEWLINE) {
    index++
  }
  return index
}

const stripBlockComment = (script: string, start: number): number => {
  let index = start + 2
  while (index < script.length && !(script[index] === '*' && script[index + 1] === '/')) {
    index++
  }
  return index < script.length ? index + 2 : index
}

const stripQuotedString = (script: string, start: number): number => {
  const quote = script[start]
  let index = start + 1
  while (index < script.length) {
    if (script[index] === '\\') {
      index += 2
      continue
    }
    if (script[index] === quote) {
      return index + 1
    }
    if (script[index] === NEWLINE) {
      return index
    }
    index++
  }
  return index
}

const toSpaces = (text: string): string => text.replaceAll(/[^\n]/g, ' ')

// Scans a template literal: literal text is blanked, while `${...}` interpolation
// is recursively treated as code so forbidden tokens inside it are preserved.
const stripTemplateInto = (script: string, start: number, result: string[]): number => {
  result.push(' ')
  let index = start + 1
  while (index < script.length) {
    const character = script[index]
    if (character === '\\') {
      result.push(toSpaces(script.slice(index, index + 2)))
      index += 2
      continue
    }
    if (character === '`') {
      result.push(' ')
      return index + 1
    }
    if (character === '$' && script[index + 1] === '{') {
      result.push('${')
      index = stripInterpolationInto(script, index + 2, result)
      continue
    }
    result.push(character === NEWLINE ? NEWLINE : ' ')
    index++
  }
  return index
}

// Sentinel for "the character at this index starts no blanked construct".
const CONSUMED_NONE = -1

// Consumes a comment, quoted string, or template literal, blanking its contents.
// Returns the index after the construct, or CONSUMED_NONE when none starts here.
const consumeSpecial = (script: string, index: number, result: string[]): number => {
  const character = script[index]
  if (character === '/' && script[index + 1] === '/') {
    const end = stripLineComment(script, index)
    result.push(toSpaces(script.slice(index, end)))
    return end
  }
  if (character === '/' && script[index + 1] === '*') {
    const end = stripBlockComment(script, index)
    result.push(toSpaces(script.slice(index, end)))
    return end
  }
  if (character === '"' || character === '\'') {
    const end = stripQuotedString(script, index)
    result.push(toSpaces(script.slice(index, end)))
    return end
  }
  return character === '`' ? stripTemplateInto(script, index, result) : CONSUMED_NONE
}

// Scans the code inside `${...}`, stopping at the matching closing brace. Strings,
// comments, and nested template literals are handled recursively.
const stripInterpolationInto = (script: string, start: number, result: string[]): number => {
  let depth = 1
  let index = start
  while (index < script.length) {
    const consumed = consumeSpecial(script, index, result)
    if (consumed !== CONSUMED_NONE) {
      index = consumed
      continue
    }
    const character = script[index]
    if (character === '{') {
      depth++
    }
    else if (character === '}') {
      depth--
      if (depth === 0) {
        result.push(character)
        return index + 1
      }
    }
    result.push(character)
    index++
  }
  return index
}

export const stripLiteralsAndComments = (script: string): string => {
  const result: string[] = []
  let index = 0
  while (index < script.length) {
    const consumed = consumeSpecial(script, index, result)
    if (consumed !== CONSUMED_NONE) {
      index = consumed
      continue
    }
    result.push(script[index])
    index++
  }
  return result.join('')
}

export const scanForbiddenToken = (script: string): string | undefined => {
  const code = stripLiteralsAndComments(script)
  for (const token of FORBIDDEN_TOKENS) {
    if (token.pattern.test(code)) {
      return token.name
    }
  }
  return undefined
}

export const checkScript = (script: string): { ok: true } | { ok: false, reason: string } => {
  const forbidden = scanForbiddenToken(script)
  if (forbidden !== undefined) {
    return { ok: false, reason: `forbidden token: ${forbidden}` }
  }
  try {
    buildWorkflowFunction(script)
    return { ok: true }
  }
  catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

type WorkflowFunction = (helpers: WorkflowHelpers) => Promise<unknown>

export const buildWorkflowFunction = (script: string): WorkflowFunction => {
  const AsyncFunction: FunctionConstructor = Object.getPrototypeOf(async function () {}).constructor
  const compiled = new AsyncFunction('subtask', 'log', '"use strict";\n' + script)
  return (helpers: WorkflowHelpers): Promise<unknown> =>
    compiled(helpers.subtask, helpers.log)
}
