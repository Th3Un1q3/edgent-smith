/**
 * The runtime's memory surface. Memories are read straight from the workspace's
 * memory folder — one local file per namespace — and are represented elsewhere
 * by idempotency keys rather than their full text: `mem:<path>:complete` for a
 * loaded value, `mem:<path>:ref` for a pointer, and `skill:<name>:complete` for
 * an injected skill. Keys stay small, so a snapshot never truncates them.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const MEMORY_DIRECTORY = '.serena/memories'

export interface InjectedValue {
  readonly full: readonly string[]
  readonly index: readonly string[]
}

export type MemoryRead
  = | { readonly ok: true, readonly value: InjectedValue }
    | { readonly ok: false, readonly output: string }

export const EMPTY_MEMORY: InjectedValue = { full: [], index: [] }

export const skillKey = (name: string): string => 'skill:' + name + ':complete'

export const memoryKey = (path: string, kind: 'complete' | 'ref'): string => 'mem:' + path + ':' + kind

export const isMemoryKey = (value: string): boolean =>
  value.startsWith('mem:') || value.startsWith('skill:')

/**
 * Refuses traversal while allowing nested namespaces such as `preferences/user`.
 */
const hasUnsafePrefix = (namespace: string): boolean =>
  namespace === '' || namespace.startsWith('/') || namespace.includes('\\')

export const isSafeNamespace = (namespace: string): boolean =>
  !hasUnsafePrefix(namespace) && namespace.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')

export const memoryPath = (directory: string, namespace: string): string =>
  path.join(directory, MEMORY_DIRECTORY, namespace + '.md')

/**
 * `## ` headings become index entries; `- ` bullets become full entries. Every
 * other line is ignored.
 */
const addMemoryLine = (line: string, full: string[], index: string[]): void => {
  if (line.startsWith('## ')) index.push(line.slice(3).trim())
  else if (line.startsWith('- ')) full.push(line.slice(2).trim())
}

export const parseMemory = (content: string): InjectedValue => {
  const full: string[] = []
  const index: string[] = []

  for (const raw of content.split('\n')) addMemoryLine(raw.trim(), full, index)

  return { full, index }
}

export type ReadFilePort = (path: string) => Promise<string>

/**
 * A missing file is an empty value, because the loop can run without
 * preferences; any other read failure is reported, not thrown.
 */
const classifyReadError = (error: unknown): MemoryRead =>
  (error as { code?: unknown }).code === 'ENOENT'
    ? { ok: true, value: EMPTY_MEMORY }
    : { ok: false, output: error instanceof Error ? error.name : 'read-failed' }

type ReadAttempt = { content: string } | { error: unknown }

const tryRead = async (read: () => Promise<string>): Promise<ReadAttempt> => {
  try {
    return { content: await read() }
  }
  catch (error) {
    return { error }
  }
}

const readMemoryFile = async (
  directory: string,
  namespace: string,
  read: ReadFilePort,
): Promise<MemoryRead> => {
  if (!isSafeNamespace(namespace)) return { ok: false, output: 'namespace refused' }

  const attempted = await tryRead(() => read(memoryPath(directory, namespace)))
  return 'content' in attempted
    ? { ok: true, value: parseMemory(attempted.content) }
    : classifyReadError(attempted.error)
}

export const readMemories = async (
  directory: string,
  namespace: string,
  read: ReadFilePort = path => readFile(path, 'utf8'),
): Promise<MemoryRead> => readMemoryFile(directory, namespace, read)
