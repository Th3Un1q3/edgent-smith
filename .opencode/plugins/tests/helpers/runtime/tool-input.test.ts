import { describe, expect, it } from 'vitest'

import { readFilePath, relativeTo } from '@plugins/helpers/runtime/tool-input'

describe('readFilePath', () => {
  it('prefers path over filePath', () => {
    expect(readFilePath({ path: '/workspace/a.ts', filePath: '/workspace/b.ts' })).toBe('/workspace/a.ts')
  })

  it('uses filePath when path is absent', () => {
    expect(readFilePath({ filePath: '/workspace/b.ts' })).toBe('/workspace/b.ts')
  })

  it('falls back to filePath when path is empty', () => {
    expect(readFilePath({ path: '', filePath: '/workspace/b.ts' })).toBe('/workspace/b.ts')
  })

  it('yields undefined when neither candidate is a non-empty string', () => {
    expect(readFilePath({})).toBeUndefined()
    expect(readFilePath(undefined)).toBeUndefined()
    expect(readFilePath({ path: 42 })).toBeUndefined()
    expect(readFilePath({ path: '', filePath: '' })).toBeUndefined()
  })
})

describe('relativeTo', () => {
  it('strips the workspace prefix', () => {
    expect(relativeTo('/workspace', '/workspace/.opencode/plugins/a.ts')).toBe('.opencode/plugins/a.ts')
  })

  it('strips the prefix when the directory already ends with a slash', () => {
    expect(relativeTo('/workspace/', '/workspace/a.ts')).toBe('a.ts')
  })

  it('leaves a path outside the workspace unchanged', () => {
    expect(relativeTo('/workspace', '/elsewhere/a.ts')).toBe('/elsewhere/a.ts')
  })
})
