import { isPlainObject } from './subtask-parameters'

export const extractOutputText = (
  data: { parts?: Array<{ type?: string, text?: string }> } | undefined,
): string =>
  (data?.parts ?? [])
    .filter((part): part is { text: string } => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n')

export interface ParsedStructured {
  usable: boolean
  value?: unknown
}

const stripCodeFence = (text: string): string => {
  const match = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(text.trim())
  return match === null ? text.trim() : match[1].trim()
}

const requiredKeys = (required: unknown): string[] =>
  Array.isArray(required) && required.every(key => typeof key === 'string') ? required : []

const hasRequiredKeys = (value: unknown, required: unknown): boolean => {
  const keys = requiredKeys(required)
  return keys.length === 0 || (isPlainObject(value) && keys.every(key => Object.prototype.hasOwnProperty.call(value, key)))
}

const RESULT_OPEN_TAG = '<result_json>'
const RESULT_CLOSE_TAG = '</result_json>'

// Scan tagged blocks from the last opening tag backwards, trying each following
// closing tag, so prose after the block is ignored and a literal close tag
// inside a JSON string is recovered by the next closing tag. First parsed value
// wins; an absent or unparseable block returns undefined.
const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(stripCodeFence(text))
  }
  catch {
    return undefined
  }
}

const parseFrom = (text: string, contentStart: number): unknown => {
  for (let close = text.indexOf(RESULT_CLOSE_TAG, contentStart); close !== -1; close = text.indexOf(RESULT_CLOSE_TAG, close + RESULT_CLOSE_TAG.length)) {
    const value = parseJson(text.slice(contentStart, close))
    if (value !== undefined) return value
  }
  return undefined
}

// `lastIndexOf(search, -1)` clamps to 0 and returns the same tag, so an
// opening tag at index 0 would loop forever; stop after the first one.
const previousOpening = (text: string, open: number): number =>
  open === 0 ? -1 : text.lastIndexOf(RESULT_OPEN_TAG, open - 1)

const parseTagged = (text: string): unknown => {
  for (let open = text.lastIndexOf(RESULT_OPEN_TAG); open !== -1; open = previousOpening(text, open)) {
    const value = parseFrom(text, open + RESULT_OPEN_TAG.length)
    if (value !== undefined) return value
  }
  return undefined
}

// A structured turn is usable only when the text parses and, when the schema
// declares string `required` keys, every one of them is present. Tagged blocks
// are preferred; JSON without tags remains supported for backward compatibility.
const isUsableValue = (value: unknown, required: unknown): boolean =>
  value !== undefined && hasRequiredKeys(value, required)

export const parseStructured = (text: string, schema: Record<string, unknown>): ParsedStructured => {
  const tagged = parseTagged(text)
  const value = tagged === undefined ? parseJson(text) : tagged
  return isUsableValue(value, schema.required) ? { usable: true, value } : { usable: false }
}
