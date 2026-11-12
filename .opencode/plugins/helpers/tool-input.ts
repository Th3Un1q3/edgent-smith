/**
 * Tool-input paths differ between v2 tools: edit/write carry `path`, and some
 * callers still send `filePath`. Gate patterns are workspace-relative while
 * tool inputs are absolute, so both normalisations live together.
 */
export const readFilePath = (input: unknown): string | undefined => {
  const arguments_ = input as { path?: unknown, filePath?: unknown } | undefined
  const candidate = typeof arguments_?.path === 'string' && arguments_.path.length > 0
    ? arguments_.path
    : arguments_?.filePath
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined
}

export const relativeTo = (directory: string, filePath: string): string => {
  const prefix = directory.endsWith('/') ? directory : directory + '/'
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath
}
