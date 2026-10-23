import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const proc = vi.hoisted(() => ({ active: false }))

const sdk = vi.hoisted(() => ({ make: vi.fn(() => ({ kind: 'client' })) }))

const TCP_HEADER = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode'

const TCP_TABLE = [
  TCP_HEADER,
  '   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 42 1',
  '   1: 0100007F:1F91 00000000:0000 0A short',
  '   2: 0100007F:1F92 00000000:0000 01 00000000:00000000 00:00000000 00000000  1000        0 42 1',
  '   3: 0100007F:1F93 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 99 1',
  '   4: 0100007F:0000 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 42 1',
].join('\n')

// Pass-through by default so the real filesystem keeps working; the /proc
// branches are only simulated while a test flips `proc.active`.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readdirSync: (directory: unknown, options?: unknown) => directory === '/proc/self/fd' && proc.active
      ? ['0', '3', '4']
      : (actual.readdirSync as (d: unknown, o?: unknown) => string[])(directory, options),
    readlinkSync: (file: unknown) => {
      if (!proc.active) return (actual.readlinkSync as (f: unknown) => string)(file)
      if (file === '/proc/self/fd/3') return 'socket:[42]'
      if (file === '/proc/self/fd/0') return 'pipe:[7]'
      throw new Error('ENOENT')
    },
    readFileSync: (file: unknown, options?: unknown) => {
      if (!proc.active) return (actual.readFileSync as (f: unknown, o?: unknown) => string)(file, options)
      if (file === '/proc/net/tcp') return TCP_TABLE
      throw new Error('ENOENT')
    },
  }
})

vi.mock('@opencode/client', () => ({ OpenCode: { make: sdk.make } }))

import { getClient, getConnection, type ResolutionDependencies } from '@plugins/helpers/service-client'

const STATE_DIR = '/state/opencode'
const CONFIG_SEED = path.join(homedir(), '.config/opencode/service.json')

const registration = (url: string, password: string): string => JSON.stringify({ id: 'id', version: '2', url, pid: 1, password })

const reader = (files: Record<string, string>) => (file: string): string => {
  const content = files[file]
  if (content === undefined) throw new Error(`ENOENT ${file}`)
  return content
}

const dependencies = (files: Record<string, string>, overrides: Partial<ResolutionDependencies> = {}): ResolutionDependencies => ({
  env: {},
  stateDir: STATE_DIR,
  readFile: reader(files),
  readDirectory: () => Object.keys(files).map(file => path.basename(file)),
  procPorts: () => [],
  probe: async () => true,
  ...overrides,
})

const directories: string[] = []

afterEach(() => {
  proc.active = false
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  sdk.make.mockClear()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
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

describe('state registration files', () => {
  it('reads the state directory with the real filesystem readers', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'service-client-'))
    directories.push(directory)
    writeFileSync(path.join(directory, 'service.json'), registration('http://127.0.0.1:4200', 'disk'))

    const connection = await getConnection({ env: {}, stateDir: directory, probe: async () => true })

    expect(connection).toEqual({ url: 'http://127.0.0.1:4200', password: 'disk', source: 'state' })
  })

  it('orders channel registrations alphabetically when service.json is absent', async () => {
    const probe = vi.fn(async (url: string) => url.endsWith(':4301'))
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service-beta.json')]: registration('http://127.0.0.1:4301', 'beta'),
      [path.join(STATE_DIR, 'service-alpha.json')]: registration('http://127.0.0.1:4300', 'alpha'),
    }, { probe }))

    expect(connection.url).toBe('http://127.0.0.1:4301')
    expect(probe.mock.calls.map(([url]) => url)).toEqual(['http://127.0.0.1:4300', 'http://127.0.0.1:4301'])
  })

  it('ignores a registration whose url or password is not a string', async () => {
    const connection = getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: JSON.stringify({ url: 42, password: 'state' }),
    }))

    await expect(connection).rejects.toThrow(/no service: 0 candidate/)
  })

  it('ignores a registration file that is not JSON', async () => {
    const connection = getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: 'not json',
    }))

    await expect(connection).rejects.toThrow(/no service: 0 candidate/)
  })

  it('treats an unreadable state directory as empty', async () => {
    const connection = getConnection(dependencies({}, {
      readDirectory: () => {
        throw new Error('EACCES')
      },
      readFile: () => {
        throw new Error('ENOENT')
      },
    }))

    await expect(connection).rejects.toThrow(/no service: 0 candidate/)
  })

  it('derives the state directory from XDG_STATE_HOME', async () => {
    const seen: string[] = []
    const connection = await getConnection({
      env: { XDG_STATE_HOME: '/xdg' },
      readDirectory: (directory) => {
        seen.push(directory)
        return ['service.json']
      },
      readFile: reader({ '/xdg/opencode/service.json': registration('http://127.0.0.1:4400', 'xdg') }),
      procPorts: () => [],
      probe: async () => true,
    })

    expect(seen).toEqual(['/xdg/opencode'])
    expect(connection).toMatchObject({ url: 'http://127.0.0.1:4400', source: 'state' })
  })

  it('derives the state directory from the home default when XDG_STATE_HOME is unset', async () => {
    const seen: string[] = []
    const connection = getConnection({
      env: {},
      readDirectory: (directory) => {
        seen.push(directory)
        return []
      },
      readFile: () => {
        throw new Error('ENOENT')
      },
      procPorts: () => [],
      probe: async () => false,
    })

    await expect(connection).rejects.toThrow(/no service/)
    expect(seen).toEqual([path.join(homedir(), '.local/state', 'opencode')])
  })
})

describe('password seed', () => {
  it('uses the config seed password for an env url without a password', async () => {
    const connection = await getConnection(dependencies({
      [CONFIG_SEED]: '{"password":"seed"}',
    }, { env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4500' } }))

    expect(connection).toEqual({ url: 'http://127.0.0.1:4500', password: 'seed', source: 'env' })
  })

  it('ignores a seed file whose password is not a string', async () => {
    const connection = getConnection(dependencies({
      [CONFIG_SEED]: '{"password":42}',
    }, { env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4500' } }))

    await expect(connection).rejects.toThrow(/no service/)
  })

  it('ignores a seed file that is not JSON', async () => {
    const connection = getConnection(dependencies({
      [CONFIG_SEED]: '{ not json',
    }, { env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4500' } }))

    await expect(connection).rejects.toThrow(/no service/)
  })

  it('ignores an env url when no password exists anywhere', async () => {
    const connection = getConnection(dependencies({}, {
      env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4500' },
    }))

    await expect(connection).rejects.toThrow(/no service: 0 candidate/)
  })
})

describe('process socket fallback', () => {
  it('reads candidate ports from /proc when no procPorts reader is injected', async () => {
    proc.active = true

    const connection = await getConnection(dependencies({
      [CONFIG_SEED]: '{"password":"seed"}',
    }, {
      procPorts: undefined,
      probe: async url => url === 'http://127.0.0.1:8080',
    }))

    expect(connection).toEqual({ url: 'http://127.0.0.1:8080', password: 'seed', source: 'proc' })
  })
})

describe('live probe', () => {
  it('accepts an env candidate that answers the authenticated fetch', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const connection = await getConnection(dependencies({}, {
      env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4600', OPENCODE_SERVER_PASSWORD: 'pw' },
      probe: undefined,
    }))

    expect(connection.source).toBe('env')
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4600/api/info', expect.objectContaining({
      headers: { authorization: `Basic ${Buffer.from('opencode:pw').toString('base64')}` },
    }))
  })

  it('rejects an env candidate when the probe fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }))

    const connection = getConnection(dependencies({}, {
      env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4600', OPENCODE_SERVER_PASSWORD: 'pw' },
      probe: undefined,
    }))

    await expect(connection).rejects.toThrow(/no service: 1 candidate/)
  })

  it('rejects an env candidate that answers with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))

    const connection = getConnection(dependencies({}, {
      env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4600', OPENCODE_SERVER_PASSWORD: 'pw' },
      probe: undefined,
    }))

    await expect(connection).rejects.toThrow(/no service/)
  })

  it('uses the default dependencies when none are injected', async () => {
    vi.stubEnv('OPENCODE_SERVER_URL', 'http://127.0.0.1:4700')
    vi.stubEnv('OPENCODE_SERVER_PASSWORD', 'default')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))

    const connection = await getConnection()
    const client = await getClient()

    expect(connection).toEqual({ url: 'http://127.0.0.1:4700', password: 'default', source: 'env' })
    expect(client).toBeDefined()
  })
})

describe('getClient', () => {
  it('reuses the client while the cached connection probes live', async () => {
    const environment = { OPENCODE_SERVER_URL: 'http://127.0.0.1:4800', OPENCODE_SERVER_PASSWORD: 'one' }
    const shared = dependencies({}, {
      env: environment,
      probe: async (_url, password) => password === environment.OPENCODE_SERVER_PASSWORD,
    })

    const first = await getClient(shared)
    const second = await getClient(shared)

    expect(second).toBe(first)
    expect(sdk.make).toHaveBeenCalledTimes(1)
    expect(sdk.make).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'http://127.0.0.1:4800' }))
  })

  it('creates a new client when the resolved connection changes', async () => {
    const environment = { OPENCODE_SERVER_URL: 'http://127.0.0.1:4800', OPENCODE_SERVER_PASSWORD: 'one' }
    const shared = dependencies({}, {
      env: environment,
      probe: async (_url, password) => password === environment.OPENCODE_SERVER_PASSWORD,
    })

    const first = await getClient(shared)
    environment.OPENCODE_SERVER_PASSWORD = 'two'
    const second = await getClient(shared)

    expect(second).not.toBe(first)
    expect(sdk.make).toHaveBeenCalledTimes(2)
  })

  it('sends x-opencode-directory when a directory is supplied', async () => {
    const shared = dependencies({}, {
      env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4900', OPENCODE_SERVER_PASSWORD: 'pw' },
    })

    await getClient(shared, '/workspace/project')

    expect(sdk.make).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:4900',
      headers: {
        'authorization': `Basic ${Buffer.from('opencode:pw').toString('base64')}`,
        'x-opencode-directory': '/workspace/project',
      },
    })
  })

  it('sends no directory header without a directory', async () => {
    const shared = dependencies({}, {
      env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4901', OPENCODE_SERVER_PASSWORD: 'pw' },
    })

    await getClient(shared)

    expect(sdk.make).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:4901',
      headers: { authorization: `Basic ${Buffer.from('opencode:pw').toString('base64')}` },
    })
  })

  it('the client cache separates two directories', async () => {
    const shared = dependencies({}, {
      env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:4902', OPENCODE_SERVER_PASSWORD: 'pw' },
    })

    const first = await getClient(shared, '/workspace/one')
    const second = await getClient(shared, '/workspace/two')

    expect(second).not.toBe(first)
    expect(sdk.make).toHaveBeenCalledTimes(2)
  })
})

describe('resolution hardening', () => {
  it('strips every trailing slash from the env url', async () => {
    const connection = await getConnection(dependencies({}, {
      env: { OPENCODE_SERVER_URL: 'http://127.0.0.1:5000///', OPENCODE_SERVER_PASSWORD: 'env' },
    }))

    expect(connection.url).toBe('http://127.0.0.1:5000')
  })

  it('prefers service.json over alphabetically earlier channel files', async () => {
    const probe = vi.fn(async () => true)
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: registration('http://127.0.0.1:4000', 'primary'),
      [path.join(STATE_DIR, 'service-alpha.json')]: registration('http://127.0.0.1:4100', 'alpha'),
    }, { probe }))

    expect(connection).toMatchObject({ url: 'http://127.0.0.1:4000', password: 'primary' })
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('ignores directory entries that are not registration files', async () => {
    const connection = await getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: registration('http://127.0.0.1:4000', 'state'),
      [path.join(STATE_DIR, 'notes.txt')]: 'ignored',
    }))

    expect(connection).toMatchObject({ url: 'http://127.0.0.1:4000', source: 'state' })
  })

  it('ignores a registration whose password is not a string', async () => {
    const connection = getConnection(dependencies({
      [path.join(STATE_DIR, 'service.json')]: JSON.stringify({ url: 'http://127.0.0.1:4000', password: 42 }),
    }))

    await expect(connection).rejects.toThrow(/no service: 0 candidate/)
  })

  const socketConnection = (isLive: (url: string) => boolean) => getConnection(dependencies(
    { [CONFIG_SEED]: '{"password":"seed"}' },
    { procPorts: undefined, probe: async (url: string) => isLive(url) },
  ))

  it('skips a socket row that is not listening', async () => {
    proc.active = true

    await expect(socketConnection(url => url === 'http://127.0.0.1:8082')).rejects.toThrow(/no service/)
  })

  it('skips a socket row owned by another process', async () => {
    proc.active = true

    await expect(socketConnection(url => url === 'http://127.0.0.1:8083')).rejects.toThrow(/no service/)
  })

  it('skips a socket row with a zero port', async () => {
    proc.active = true

    await expect(socketConnection(url => url.endsWith(':0'))).rejects.toThrow(/no service/)
  })
})
