import type { OpencodeClient } from '@opencode-ai/sdk'

import { describe, expect, it, vi } from 'vitest'

vi.mock('@plugins/helpers/logger')
import { log } from '@plugins/helpers/logger'

import { loadQualityGates } from '@plugins/helpers/gate-config'

const mockClient = {} as OpencodeClient

const defaultConfig = {
  debounceMs: 300,
  gates: [{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }],
}

describe('gate-config loader', () => {
  it('missing config file returns empty gates', async () => {
    const error = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })

    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockRejectedValue(error),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates('/nonexistent/project', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, 'warn', 'No quality-gates config found at /nonexistent/project/.opencode/quality-gates.json')
  })

  it('valid config file returns parsed config', async () => {
    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockResolvedValue(defaultConfig),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates('/tmp/gate-config-valid', mockClient)

    expect(result).toEqual(defaultConfig)
    expect(Bun.file).toHaveBeenCalledWith('/tmp/gate-config-valid/.opencode/quality-gates.json')
  })

  it('valid config without debounceMs defaults to 300', async () => {
    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockResolvedValue({ gates: defaultConfig.gates }),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.debounceMs).toBe(300)
    expect(result.gates).toEqual(defaultConfig.gates)
  })

  it('invalid JSON returns empty gates and logs parse error', async () => {
    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, 'warn', 'Failed to load quality-gates config at /tmp/test/.opencode/quality-gates.json: SyntaxError: Unexpected token')
  })

  it('permission denied error returns empty gates and logs error', async () => {
    const error = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })

    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockRejectedValue(error),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, 'warn', 'Failed to load quality-gates config at /tmp/test/.opencode/quality-gates.json: Error: EACCES: permission denied')
  })

  it('missing required fields returns empty gates', async () => {
    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockResolvedValue({ gates: [{ patterns: ['**/*.ts'], commands: ['just lint'] }] }),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, 'warn', 'Invalid quality-gates config at /tmp/test/.opencode/quality-gates.json')
  })

  describe('invalid gate configs', () => {
    const validationCases = [
      { name: 'empty string name', config: { gates: [{ name: '', patterns: ['**/*.ts'], commands: ['just lint'] }] }, logs: true },
      { name: 'non-string name (array)', config: { gates: [{ name: ['not-a-string'], patterns: ['**/*.ts'], commands: ['just lint'] }] }, logs: true },
      { name: 'non-array patterns', config: { gates: [{ name: 'lint', patterns: 'not-an-array', commands: ['just lint'] }] }, logs: true },
      { name: 'non-string element in patterns', config: { gates: [{ name: 'lint', patterns: ['**/*.ts', 42], commands: ['just lint'] }] }, logs: true },
      { name: 'empty patterns array', config: { gates: [{ name: 'lint', patterns: [], commands: ['just lint'] }] }, logs: true },
      { name: 'empty commands array', config: { gates: [{ name: 'lint', patterns: ['**/*.ts'], commands: [] }] }, logs: true },
      { name: 'null gate in gates array', config: { gates: [null] }, logs: true },
      { name: 'undefined gate in gates array', config: { gates: [undefined] }, logs: true },
      { name: 'mixed valid and invalid gates', config: { gates: [{ name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }, { name: '', patterns: ['**/*.ts'], commands: ['just lint'] }] }, logs: true },
    ]

    it.each(validationCases)('$name returns empty gates', async ({ config, logs }) => {
      vi.spyOn(Bun, 'file').mockReturnValue({
        json: vi.fn().mockResolvedValue(config),
      } as unknown as ReturnType<typeof Bun.file>)

      const result = await loadQualityGates('/tmp/test', mockClient)

      expect(result.gates).toEqual([])
      expect(result.debounceMs).toBe(300)
      expect(log).toHaveBeenCalledTimes(logs ? 1 : 0)
    })
  })
})
