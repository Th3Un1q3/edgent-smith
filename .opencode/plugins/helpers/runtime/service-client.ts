import { readFileSync, readdirSync, readlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { OpenCode, type OpenCodeClient } from '@opencode/client'

/**
 * Resolves the loopback endpoint of the OpenCode server this plugin runs in.
 *
 * Plugins get no client, so they reach the server over its own socket. The live
 * registration file written by every server start is authoritative; /proc is a
 * last resort because the port is not always passed through the environment.
 */

export type ConnectionSource = 'env' | 'state' | 'proc'

export interface Connection {
  readonly url: string
  readonly password: string
  readonly source: ConnectionSource
}

export interface ResolutionDependencies {
  readonly env?: Record<string, string | undefined>
  readonly stateDir?: string
  readonly readFile?: (file: string) => string
  readonly readDirectory?: (directory: string) => string[]
  readonly procPorts?: () => number[]
  readonly probe?: (url: string, password: string) => Promise<boolean>
}

const PROBE_TIMEOUT_MS = 1500
const SERVICE_FILE = 'service.json'
const STATE_FILE_PATTERN = /^service(?:-[^/]+)?\.json$/u
const CONFIG_SEED = path.join(homedir(), '.config/opencode/service.json')

const trimURL = (url: string): string => url.replace(/\/+$/u, '')
const authorization = (password: string): string =>
  `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`

const isConnectionLive = async (url: string, password: string): Promise<boolean> => {
  try {
    const response = await fetch(`${url}/api/info`, {
      headers: { authorization: authorization(password) },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return response.ok
  }
  catch {
    return false
  }
}

interface Registration {
  readonly url: string
  readonly password: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseJsonRecord = (text: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(text)
    return isRecord(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

const parsePassword = (text: string): string | undefined => {
  const { password } = parseJsonRecord(text)
  return typeof password === 'string' ? password : undefined
}

const parseRegistration = (text: string): Registration | undefined => {
  const { url, password } = parseJsonRecord(text)
  return typeof url === 'string' && typeof password === 'string' ? { url: trimURL(url), password } : undefined
}

const environmentOf = (dependencies: ResolutionDependencies): Record<string, string | undefined> =>
  dependencies.env ?? process.env

const stateDirectory = (dependencies: ResolutionDependencies): string =>
  dependencies.stateDir ?? path.join(environmentOf(dependencies).XDG_STATE_HOME ?? path.join(homedir(), '.local/state'), 'opencode')

const stateFiles = (dependencies: ResolutionDependencies, readDirectory: (directory: string) => string[]): string[] => {
  const directory = stateDirectory(dependencies)
  let names: string[]
  try {
    names = readDirectory(directory).filter(name => STATE_FILE_PATTERN.test(name))
  }
  catch {
    return []
  }
  return names
    .sort((left, right) => Number(right === SERVICE_FILE) - Number(left === SERVICE_FILE) || left.localeCompare(right))
    .map(name => path.join(directory, name))
}

const readRegistration = (file: string, readFile: (file: string) => string): Registration | undefined => {
  try {
    return parseRegistration(readFile(file))
  }
  catch {
    // file removed between listing and read
  }
}

const registrations = (dependencies: ResolutionDependencies): Registration[] => {
  const readFile = dependencies.readFile ?? ((file: string) => readFileSync(file, 'utf8'))
  const readDirectory = dependencies.readDirectory ?? ((directory: string) => readdirSync(directory))
  return stateFiles(dependencies, readDirectory)
    .map(file => readRegistration(file, readFile))
    .filter((registration): registration is Registration => registration !== undefined)
}

const seedPassword = (dependencies: ResolutionDependencies): string | undefined => {
  const readFile = dependencies.readFile ?? ((file: string) => readFileSync(file, 'utf8'))
  try {
    return parsePassword(readFile(CONFIG_SEED))
  }
  catch {
    return undefined
  }
}

const portOfLocal = (local: string): number | undefined => Number.parseInt(local.split(':', 2)[1], 16) || undefined

// /proc/net/tcp columns: sl, local_address, rem_address, st, ..., inode.
const portOfRow = (line: string, inodes: Set<string>): number | undefined => {
  const columns = line.trim().split(/\s+/u)
  return columns[3] === '0A' && inodes.has(columns[9]) ? portOfLocal(columns[1]) : undefined
}

const socketInode = (fd: string): string | undefined => {
  try {
    return readlinkSync(`/proc/self/fd/${fd}`).match(/^socket:\[(\d+)\]$/u)?.[1]
  }
  catch {
    // fd closed between readdir and readlink
    return undefined
  }
}

const processSocketInodes = (): Set<string> => {
  const inodes = new Set<string>()
  for (const fd of readdirSync('/proc/self/fd')) {
    const inode = socketInode(fd)
    if (inode !== undefined) inodes.add(inode)
  }
  return inodes
}

const tableRows = (file: string): string[] => {
  try {
    return readFileSync(file, 'utf8').split('\n').slice(1)
  }
  catch {
    return []
  }
}

const processPorts = (): number[] => {
  const inodes = processSocketInodes()
  return ['/proc/net/tcp', '/proc/net/tcp6']
    .flatMap(file => tableRows(file))
    .map(line => portOfRow(line, inodes))
    .filter((port): port is number => port !== undefined)
}

const environmentPassword = (
  environment: Record<string, string | undefined>,
  fallback: string | undefined,
): string | undefined => environment.OPENCODE_SERVER_PASSWORD ?? fallback

const environmentURL = (environment: Record<string, string | undefined>): string =>
  environment.OPENCODE_SERVER_URL?.trim() ?? ''

const environmentCandidates = (
  environment: Record<string, string | undefined>,
  password: string | undefined,
): Connection[] => {
  const url = environmentURL(environment)
  const resolved = environmentPassword(environment, password)
  return url === '' || resolved === undefined ? [] : [{ url: trimURL(url), password: resolved, source: 'env' }]
}

const socketCandidates = (dependencies: ResolutionDependencies, password: string | undefined): Connection[] => {
  return password === undefined
    ? []
    : (dependencies.procPorts ?? processPorts)().map(port => ({
        url: `http://127.0.0.1:${port}`,
        password,
        source: 'proc' as const,
      }))
}

const candidates = (dependencies: ResolutionDependencies): Connection[] => {
  const found = registrations(dependencies)
  const password = found[0]?.password ?? seedPassword(dependencies)
  return [
    ...environmentCandidates(environmentOf(dependencies), password),
    ...found.map(registration => ({ ...registration, source: 'state' as const })),
    ...socketCandidates(dependencies, password),
  ]
}

const probeOf = (dependencies: ResolutionDependencies): NonNullable<ResolutionDependencies['probe']> =>
  dependencies.probe ?? isConnectionLive

const noServiceError = (list: Connection[]): Error =>
  new Error(
    `no service: ${list.length} candidate(s) rejected (env, state registration, /proc socket); last url ${list.at(-1)?.url ?? 'none'}`,
  )

const resolve = async (dependencies: ResolutionDependencies): Promise<Connection> => {
  const probe = probeOf(dependencies)
  const list = candidates(dependencies)
  for (const candidate of list) {
    if (await probe(candidate.url, candidate.password)) return candidate
  }
  throw noServiceError(list)
}

interface Cache {
  connection?: Connection
  client?: OpenCodeClient
  clientKey?: string
}

const caches = new WeakMap<object, Cache>()

const cacheFor = (dependencies: ResolutionDependencies): Cache => {
  const existing = caches.get(dependencies)
  if (existing !== undefined) return existing
  const created: Cache = {}
  caches.set(dependencies, created)
  return created
}

const DEFAULT_DEPS: ResolutionDependencies = {}

const resolveCached = async (dependencies: ResolutionDependencies, cache: Cache): Promise<Connection> => {
  const cached = cache.connection
  if (cached !== undefined && await probeOf(dependencies)(cached.url, cached.password)) return cached
  cache.connection = undefined
  const resolved = await resolve(dependencies)
  cache.connection = resolved
  return resolved
}

/**
 * Returns a probed connection, preferring env, then the state registration file,
 * then the process socket. A cached connection is re-probed and replaced when it
 * stops answering, so a failed lookup is never cached.
 */
export const getConnection = async (dependencies: ResolutionDependencies = DEFAULT_DEPS): Promise<Connection> =>
  resolveCached(dependencies, cacheFor(dependencies))

const headersFor = (password: string, directory?: string) => ({
  authorization: authorization(password),
  ...(directory && { 'x-opencode-directory': directory }),
})

const isCurrentClient = (cache: Cache, key: string): cache is Cache & { readonly client: OpenCodeClient } =>
  cache.client !== undefined && cache.clientKey === key

export const getClient = async (
  dependencies: ResolutionDependencies = DEFAULT_DEPS,
  directory?: string,
): Promise<OpenCodeClient> => {
  const cache = cacheFor(dependencies)
  const connection = await getConnection(dependencies)
  const key = [connection.url, connection.password, directory].join('\n')
  if (isCurrentClient(cache, key)) return cache.client
  const client = OpenCode.make({
    baseUrl: connection.url,
    headers: headersFor(connection.password, directory),
  })
  cache.client = client
  cache.clientKey = key
  return client
}
