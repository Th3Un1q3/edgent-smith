import path from 'node:path'

import { describe, it, expect, vi } from 'vitest'

import { getConnection, type ResolutionDependencies } from '@plugins/helpers/service-client'

const STATE_DIR = '/state/opencode'

const registration = (url: string, password: string): string => JSON.stringify({ id: 'id', version: '2', url, pid: 1, password })

const dependencies = (files: Record<string, string>, overrides: Partial<ResolutionDependencies> = {}): ResolutionDependencies => ({
  env: {},
  stateDir: STATE_DIR,
  readFile: (file: string) => {
    const content = files[file]
    if (content === undefined) throw new Error(`ENOENT ${file}`)
    return content
  },
  readDirectory: () => Object.keys(files).map(file => path.basename(file)),
  procPorts: () => [],
  probe: async () => true,
  ...overrides,
})

describe('getConnection', () => {
  it('prefers the env url and password over the state registration', async () => {
    const probe = vi.fn(async () => true)
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: registration('http://127.0.0.1:4000', 'state'),
    }, { env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:5000', OPENCODE_SERVER_PASSWORD: 'env' }, probe }))

    expect(connection).toEqual({ url: 'http://127.0.0.1:5000', password: 'env', source: 'env' })
    expect(probe).toHaveBeenCalledWith('http://127.0.0.1:5000', 'env')
  })

  it('takes the password from the state registration when only the env url is set', async () => {
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: registration('http://127.0.0.1:4000', 'state'),
    }, { env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:5000/' } }))

    expect(connection).toEqual({ url: 'http://127.0.0.1:5000', password: 'state', source: 'env' })
  })

  it('uses the state registration when the env is unset', async () => {
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: registration('http://127.0.0.1:4000', 'state'),
    }))

    expect(connection).toEqual({ url: 'http://127.0.0.1:4000', password: 'state', source: 'state' })
  })

  it('falls back to service-<channel>.json when only that exists', async () => {
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service-beta.json')]: registration('http://127.0.0.1:4100', 'beta'),
    }))

    expect(connection).toEqual({ url: 'http://127.0.0.1:4100', password: 'beta', source: 'state' })
  })

  it('skips a candidate that fails the authenticated probe', async () => {
    const probe = vi.fn(async (url: string) => url.endsWith(':4100'))
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: registration('http://127.0.0.1:4000', 'stale'),
      [path.join(STATE_DIR, 'service-beta.json')]: registration('http://127.0.0.1:4100', 'beta'),
    }, { probe }))

    expect(connection.url).toBe('http://127.0.0.1:4100')
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('falls back to the process socket when no registration resolves', async () => {
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: registration('http://127.0.0.1:4000', 'state'),
    }, {
      probe: async url => url.endsWith(':6000'),
      procPorts: () => [6000],
    }))

    expect(connection).toEqual({ url: 'http://127.0.0.1:6000', password: 'state', source: 'proc' })
  })

  it('re-reads after a failed lookup instead of caching the failure', async () => {
    const files: Record<string, string> = {}
    const shared = dependencies(files)
    await expect(getConnection(shared)).rejects.toThrow(/no service/)

    files[path.join(STATE_DIR, 'service.json')] = registration('http://127.0.0.1:4000', 'state')
    await expect(getConnection(shared)).resolves.toMatchObject({ url: 'http://127.0.0.1:4000' })
  })

  it('re-resolves when a cached connection stops answering', async () => {
    const files = { [path.join(STATE_DIR, 'service.json')]: registration('http://127.0.0.1:4000', 'old') }
    let alive = 'old'
    const probe = async (_url: string, password: string) => password === alive
    const shared = dependencies(files, { probe })
    await expect(getConnection(shared)).resolves.toMatchObject({ password: 'old' })

    files[path.join(STATE_DIR, 'service.json')] = registration('http://127.0.0.1:4001', 'new')
    alive = 'new'
    await expect(getConnection(shared)).resolves.toEqual({ url: 'http://127.0.0.1:4001', password: 'new', source: 'state' })
  })

  it('throws when no source resolves', async () => {
    await expect(getConnection(dependencies({}))).rejects.toThrow(/no service/)
  })
})
