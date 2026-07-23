import type { OpencodeClient } from "@opencode-ai/sdk"

import { describe, expect, it, vi } from 'vitest'

vi.mock("@plugins/helpers/logger")
import { log } from "@plugins/helpers/logger"

import { loadQualityGates } from '@plugins/helpers/gate-config'

function makeMockClient() {
  return {} as OpencodeClient
}

const mockClient = makeMockClient()

function mockBunFile(config: unknown) {
  vi.spyOn(Bun, 'file').mockReturnValue({
    json: vi.fn().mockResolvedValue(config),
  } as unknown as ReturnType<typeof Bun.file>)
}

describe('gate-config loader', () => {
  it('missing config file returns empty gates', async () => {
    const result = await loadQualityGates('/nonexistent/project', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, "warn", "No quality-gates config found at /nonexistent/project/.opencode/quality-gates.json")
  })

  it('valid config file returns parsed config', async () => {
    const directory = '/tmp/gate-config-valid'
    const configPath = `${directory}/.opencode/quality-gates.json`
    const config = {
      debounceMs: 250,
      gates: [
        { name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] },
      ],
    }
    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockResolvedValue(config),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates(directory, mockClient)

    expect(result).toEqual(config)
    expect(Bun.file).toHaveBeenCalledWith(configPath)
  })

  it('valid config file without debounceMs defaults to 300', async () => {
    const directory = '/tmp/gate-config-default-debounce'
    const config = {
      gates: [
        { name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] },
      ],
    }
    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockResolvedValue(config),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates(directory, mockClient)

    expect(result.debounceMs).toBe(300)
    expect(result.gates).toEqual(config.gates)
  })

  it('invalid JSON returns empty gates', async () => {
    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates('/tmp/gate-config-invalid-json', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, "warn", "No quality-gates config found at /tmp/gate-config-invalid-json/.opencode/quality-gates.json")
  })

  it('missing required fields returns empty gates', async () => {
    const invalidConfig = {
      gates: [
        { patterns: ['**/*.ts'], commands: ['just lint'] },
      ],
    }
    vi.spyOn(Bun, 'file').mockReturnValue({
      json: vi.fn().mockResolvedValue(invalidConfig),
    } as unknown as ReturnType<typeof Bun.file>)

    const result = await loadQualityGates('/tmp/gate-config-missing-fields', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, "warn", "Invalid quality-gates config at /tmp/gate-config-missing-fields/.opencode/quality-gates.json")
  })

  // --- Edge case tests to kill Stryker mutants ---

  it('gate with empty string name is invalid', async () => {
    mockBunFile({
      gates: [{ name: '', patterns: ['**/*.ts'], commands: ['just lint'] }],
    })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
  })

  it('gate with non-string name (array) is invalid', async () => {
    mockBunFile({
      gates: [{ name: ['not-a-string'], patterns: ['**/*.ts'], commands: ['just lint'] }],
    })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
  })

  it('gate with non-array patterns rejects config', async () => {
    mockBunFile({
      gates: [{ name: 'lint', patterns: 'not-an-array', commands: ['just lint'] }],
    })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, "warn", "Invalid quality-gates config at /tmp/test/.opencode/quality-gates.json")
  })

  it('gate with non-string element in patterns is invalid', async () => {
    mockBunFile({
      gates: [{ name: 'lint', patterns: ['**/*.ts', 42], commands: ['just lint'] }],
    })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
  })

  it('gate with empty patterns array is invalid', async () => {
    mockBunFile({
      gates: [{ name: 'lint', patterns: [], commands: ['just lint'] }],
    })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
  })

  it('gate with empty commands array is invalid', async () => {
    mockBunFile({
      gates: [{ name: 'lint', patterns: ['**/*.ts'], commands: [] }],
    })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
  })

  it('null gate in gates array is invalid', async () => {
    mockBunFile({ gates: [null] })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, "warn", "Invalid quality-gates config at /tmp/test/.opencode/quality-gates.json")
  })

  it('undefined gate in gates array is invalid', async () => {
    mockBunFile({ gates: [undefined] })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, "warn", "Invalid quality-gates config at /tmp/test/.opencode/quality-gates.json")
  })

  it('mixed valid and invalid gates rejects entire config', async () => {
    mockBunFile({
      gates: [
        { name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] },
        { name: '', patterns: ['**/*.ts'], commands: ['just lint'] },
      ],
    })

    const result = await loadQualityGates('/tmp/test', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
  })
})
