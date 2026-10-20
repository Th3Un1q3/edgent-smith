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

const parsePassword = (text: string): string | undefined => {
  try {
    const parsed = JSON.parse(text) as { password?: unknown }
    return typeof parsed.password === 'string' ? parsed.password : undefined
  }
  catch {
    return undefined
  }
}

const parseRegistration = (text: string): Registration | undefined => {
  try {
    const parsed = JSON.parse(text) as { url?: unknown, password?: unknown }
    return typeof parsed.url !== 'string' || typeof parsed.password !== 'string' ? undefined : { url: trimURL(parsed.url), password: parsed.password }
  }
  catch {
    return undefined
  }
}

const stateDirectory = (dependencies: ResolutionDependencies): string => {
  if (dependencies.stateDir !== undefined) return dependencies.stateDir
  const environment = dependencies.env ?? process.env
  const base = environment.XDG_STATE_HOME ?? path.join(homedir(), '.local/state')
  return path.join(base, 'opencode')
}

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

const registrations = (dependencies: ResolutionDependencies): Registration[] => {
  const readFile = dependencies.readFile ?? ((file: string) => readFileSync(file, 'utf8'))
  const readDirectory = dependencies.readDirectory ?? ((directory: string) => readdirSync(directory))
  const parsed: Registration[] = []
  for (const file of stateFiles(dependencies, readDirectory)) {
    try {
      const registration = parseRegistration(readFile(file))
      if (registration !== undefined) parsed.push(registration)
    }
    catch {
      // file removed between listing and read
    }
  }
  return parsed
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

// /proc/net/tcp columns: sl, local_address, rem_address, st, ..., inode.
const portOfRow = (line: string, inodes: Set<string>): number | undefined => {
  const columns = line.trim().split(/\s+/u)
  if (columns.length < 10 || columns[3] !== '0A' || !inodes.has(columns[9])) return undefined
  const port = Number.parseInt(columns[1].split(':', 2)[1] ?? '', 16)
  return port > 0 ? port : undefined
}

const processSocketInodes = (): Set<string> => {
  const inodes = new Set<string>()
  for (const fd of readdirSync('/proc/self/fd')) {
    try {
      const match = readlinkSync(`/proc/self/fd/${fd}`).match(/^socket:\[(\d+)\]$/u)
      if (match) inodes.add(match[1])
    }
    catch {
      // fd closed between readdir and readlink
    }
  }
  return inodes
}

const processPorts = (): number[] => {
  const inodes = processSocketInodes()
  const ports: number[] = []
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let table = ''
    try {
      table = readFileSync(file, 'utf8')
    }
    catch {
      continue
    }
    for (const line of table.split('\n').slice(1)) {
      const port = portOfRow(line, inodes)
      if (port !== undefined) ports.push(port)
    }
  }
  return ports
}

const environmentCandidates = (
  environment: Record<string, string | undefined>,
  password: string | undefined,
): Connection[] => {
  const url = environment.OPENCODE_SERVER_URL?.trim()
  if (url === undefined || url === '') return []
  const resolved = environment.OPENCODE_SERVER_PASSWORD ?? password
  return resolved === undefined ? [] : [{ url: trimURL(url), password: resolved, source: 'env' }]
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
    ...environmentCandidates(dependencies.env ?? process.env, password),
    ...found.map(registration => ({ ...registration, source: 'state' as const })),
    ...socketCandidates(dependencies, password),
  ]
}

const resolve = async (dependencies: ResolutionDependencies): Promise<Connection> => {
  const probe = dependencies.probe ?? isConnectionLive
  const list = candidates(dependencies)
  for (const candidate of list) {
    if (await probe(candidate.url, candidate.password)) return candidate
  }
  throw new Error(
    `no service: ${list.length} candidate(s) rejected (env, state registration, /proc socket); last url ${list.at(-1)?.url ?? 'none'}`,
  )
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

/**
 * Returns a probed connection, preferring env, then the state registration file,
 * then the process socket. A cached connection is re-probed and replaced when it
 * stops answering, so a failed lookup is never cached.
 */
export const getConnection = async (dependencies: ResolutionDependencies = DEFAULT_DEPS): Promise<Connection> => {
  const cache = cacheFor(dependencies)
  const cached = cache.connection
  if (cached !== undefined) {
    const probe = dependencies.probe ?? isConnectionLive
    if (await probe(cached.url, cached.password)) return cached
    cache.connection = undefined
  }
  const resolved = await resolve(dependencies)
  cache.connection = resolved
  return resolved
}

export const getClient = async (dependencies: ResolutionDependencies = DEFAULT_DEPS): Promise<OpenCodeClient> => {
  const cache = cacheFor(dependencies)
  const connection = await getConnection(dependencies)
  const key = `${connection.url}\n${connection.password}`
  if (cache.client !== undefined && cache.clientKey === key) return cache.client
  const client = OpenCode.make({
    baseUrl: connection.url,
    headers: { authorization: authorization(connection.password) },
  })
  cache.client = client
  cache.clientKey = key
  return client
}
