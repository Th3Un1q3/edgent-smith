import type { OpencodeClient } from "@opencode-ai/sdk"

import { describe, expect, it, vi } from 'vitest'

vi.mock("@plugins/helpers/logger")
import { log } from "@plugins/helpers/logger"

import { loadQualityGates } from '@plugins/helpers/gate-config'

function makeMockClient() {
  return {} as OpencodeClient
}

const mockClient = makeMockClient()

describe('gate-config loader', () => {
  it('missing config file returns empty gates', async () => {
    const result = await loadQualityGates('/nonexistent/project', mockClient)

    expect(result.gates).toEqual([])
    expect(result.debounceMs).toBe(300)
    expect(log).toHaveBeenCalledWith(mockClient, "warn", expect.any(String))
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
    expect(log).toHaveBeenCalledWith(mockClient, "warn", expect.any(String))
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
    expect(log).toHaveBeenCalledWith(mockClient, "warn", expect.any(String))
  })
})
