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
export const isSafeNamespace = (namespace: string): boolean => {
  return namespace === '' || namespace.startsWith('/') || namespace.includes('\\') ? false : namespace.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

export const memoryPath = (directory: string, namespace: string): string =>
  path.join(directory, MEMORY_DIRECTORY, namespace + '.md')

/**
 * `## ` headings become index entries; `- ` bullets become full entries. Every
 * other line is ignored.
 */
export const parseMemory = (content: string): InjectedValue => {
  const full: string[] = []
  const index: string[] = []

  for (const raw of content.split('\n')) {
    const line = raw.trim()

    if (line.startsWith('## ')) index.push(line.slice(3).trim())
    else if (line.startsWith('- ')) full.push(line.slice(2).trim())
  }

  return { full, index }
}

export type ReadFilePort = (path: string) => Promise<string>

/**
 * A missing file is an empty value, because the loop can run without
 * preferences; any other read failure is reported, not thrown.
 */
export const readMemories = async (
  directory: string,
  namespace: string,
  read: ReadFilePort = path => readFile(path, 'utf8'),
): Promise<MemoryRead> => {
  if (!isSafeNamespace(namespace)) return { ok: false, output: 'namespace refused' }

  try {
    return { ok: true, value: parseMemory(await read(memoryPath(directory, namespace))) }
  }
  catch (error) {
    return (error as { code?: unknown }).code === 'ENOENT'
      ? { ok: true, value: EMPTY_MEMORY }
      : { ok: false, output: error instanceof Error ? error.name : 'read-failed' }
  }
}
