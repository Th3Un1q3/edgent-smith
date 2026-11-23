import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { REPO_ROOT } from '@tests/helpers/repo-root'

interface Action {
  type: string
  params?: { name?: string }
}

interface SessionMachine {
  states: {
    towards_goal: {
      states: {
        retrospective: { entry: Action[] }
      }
    }
  }
}

const COMMANDS_ROOT = path.join(REPO_ROOT, '.opencode', 'commands')
const MACHINE_PATH = path.join(
  REPO_ROOT,
  '.opencode',
  'plugins',
  'state-machine',
  'machines',
  'session',
  'machine.json',
)

const markdownFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)

    return entry.isDirectory() ? markdownFiles(full) : [full]
  })

/**
Names opencode registers for a command file: the path under `.opencode/commands` with
the `.md` suffix removed, keeping nested directories (`sessions/retrospect.md` -> `sessions/retrospect`).
*/
const registeredNames = (): Set<string> =>
  new Set(
    markdownFiles(COMMANDS_ROOT).map(file =>
      path.relative(COMMANDS_ROOT, file).replace(/\.md$/, ''),
    ),
  )

const machine = (): SessionMachine =>
  JSON.parse(readFileSync(MACHINE_PATH, 'utf8')) as SessionMachine

const runCommands = (): Array<{ at: string, name: string }> => {
  const found: Array<{ at: string, name: string }> = []

  function walkList(nodes: unknown[], at: string): void {
    for (const [index, child] of nodes.entries()) walk(child, `${at}[${index}]`)
  }

  function walkObject(record: Record<string, unknown>, at: string): void {
    if (record.type === 'run_command') {
      found.push({ at, name: String((record.params as { name?: unknown }).name) })
    }

    for (const [key, child] of Object.entries(record)) walk(child, `${at}/${key}`)
  }

  function walkRecord(node: unknown, at: string): void {
    if (node === null || typeof node !== 'object') return

    walkObject(node as Record<string, unknown>, at)
  }

  function walk(node: unknown, at: string): void {
    if (Array.isArray(node)) {
      walkList(node, at)
      return
    }

    walkRecord(node, at)
  }

  walk(machine(), '')

  return found
}

const retrospectiveName = (): string | undefined =>
  machine().states.towards_goal.states.retrospective.entry
    .find(action => action.type === 'run_command')?.params?.name

describe('run_command names', () => {
  it('names the command file the loader registers for sessions/retrospect.md', () => {
    expect(retrospectiveName()).toBe('sessions/retrospect')
    expect(registeredNames()).toContain(retrospectiveName())
  })

  it('resolves every run_command name to a registered command file', () => {
    const registered = registeredNames()
    const actions = runCommands()
    const unresolved = actions
      .filter(action => !registered.has(action.name))
      .map(action => `${action.at}: ${action.name}`)

    expect(actions.length).toBeGreaterThan(0)
    expect(unresolved).toEqual([])
  })
})
