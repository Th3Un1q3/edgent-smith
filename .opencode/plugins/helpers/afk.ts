/**
 * AFK enforcer message builder and denial hint table.
 *
 * Defined here rather than in the plugin entry file so that
 * `afk-enforcer.ts` only exports Plugin-typed values. opencode loads plugin
 * root files by directory scan and exporting non-Plugin values from an entry
 * file prevents the plugin from loading. This is guarded from recurring by the
 * `plugin-export-guard/no-non-plugin-export` rule in `eslint.config.js`.
 *
 * One generic message covers every denial; `AFK_HINTS` adds an optional,
 * first-match guidance line. Adding a restriction is one table row plus one
 * test row.
 */

export type AfkHint = {
  id: string
  match: (permission: string, command: string) => boolean
  hint: string
}

const STEERING_OPEN = '<steering priority="warning" reason="user is away from keyboard - permission auto-denied by afk-enforcer plugin" type="instructions">'

const CORE = `Permission auto-denied (AFK): this action is denied and final as-is.
Do not retry this command as-is, and never reproduce the denied effect through any other tool, wrapper, subprocess, or indirect invocation.
Continue the rest of the task with permitted actions. If the action is essential, stop and tell the user what you need - they can run it or grant access when back.`

const renderMessage = (hint?: string): string => {
  const body = hint === undefined ? CORE : `${CORE}\nHint: ${hint}`
  return `${STEERING_OPEN}\n${body}\n</steering>`
}

/**
 * Leading tokens that wrap the real command without changing it: shell
 * prefixes, privilege/env wrappers, and the repo `rtk` alias.
 */
const WRAPPER_TOKENS = new Set(['sudo', 'command', 'env', 'nohup', 'rtk'])

/**
 * A leading `NAME=value` assignment. The trailing whitespace keeps a lone
 * `FOO=1` from being treated as a prefix.
 */
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/

const SHELL_C = /^(?:bash|sh|zsh)\s+-c\s+([\s\S]+)$/

const WHOLE_BACKTICK = /^`([\s\S]*)`$/

const WHOLE_SUBSTITUTION = /^\$\(([\s\S]*)\)$/

/**
Substitution bodies (`\`cmd\`` / `$(cmd)`), scanned one nesting level deep.
*/
const SUBSTITUTION = /`([^`]*)`|\$\(([^()]*)\)/g

const stripQuotes = (value: string): string => {
  const trimmed = value.trim()
  const first = trimmed[0]
  const last = trimmed.at(-1)
  if (first === last && trimmed.length >= 2 && (first === '"' || first === '\'')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/**
Strips one leading wrapper token or env assignment, or returns undefined.
*/
const stripWrapper = (command: string): string | undefined => {
  const wrapper = command.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s+/)
  if (wrapper && WRAPPER_TOKENS.has(wrapper[1])) return command.slice(wrapper[0].length).trim()

  const environment = command.match(ENV_ASSIGNMENT)
  if (environment) return command.slice(environment[0].length).trim()

  return undefined
}

/**
Removes one shell-`-c` / whole-string `` `cmd` `` / `$(cmd)` layer, or undefined.
*/
const unwrapIndirection = (command: string): string | undefined => {
  const shellC = command.match(SHELL_C)
  if (shellC) return stripQuotes(shellC[1])

  const backtick = command.match(WHOLE_BACKTICK)
  if (backtick) return backtick[1].trim()

  const substitution = command.match(WHOLE_SUBSTITUTION)
  if (substitution) return substitution[1].trim()

  return undefined
}

/**
 * Removes leading wrappers, env assignments, and one level of shell-`-c` or
 * whole-string `` `cmd` `` / `$(cmd)` indirection, so a hidden command is matched
 * by its real program name (`FOO=1 git status` → `git status`).
 */
export const normalizeCommand = (command: string): string => {
  let current = command.trim()

  for (;;) {
    const next = stripWrapper(current) ?? unwrapIndirection(current)
    if (next === undefined || next === current) return current
    current = next
  }
}

const QUOTED = /"(\\.|[^"\\])*"|'[^']*'/g

const maskQuotedOperators = (command: string): string => {
  let masked = ''
  let lastIndex = 0

  for (const match of command.matchAll(QUOTED)) {
    const index = match.index ?? 0
    masked += command.slice(lastIndex, index)
    masked += match[0].replaceAll(/[&|;<>]/g, '\u{0}')
    lastIndex = index + match[0].length
  }

  return masked + command.slice(lastIndex)
}

/**
 * Splits a command on top-level `&&`, `||`, `;`, `|`, and `<<` while ignoring
 * operators inside single or double quotes, so a quoted grep pattern stays one
 * simple command.
 */
export const splitCommandSegments = (command: string): string[] =>
  maskQuotedOperators(command)
    .split(/\s*(?:&&|\|\||;|<<|\|)\s*/)
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)

const extractSubstitutions = (command: string): string[] => {
  const inner: string[] = []
  for (const match of command.matchAll(SUBSTITUTION)) {
    const body = (match[1] ?? match[2] ?? '').trim()
    if (body.length > 0) inner.push(body)
  }
  return inner
}

/**
 * Top-level segments of the normalized command plus its substitution bodies,
 * so a program hidden in `` `...` `` / `$(...)` is still seen as a command.
 */
const analyzedSegments = (command: string): string[] => {
  const normalized = normalizeCommand(command)
  const candidates = [normalized, ...extractSubstitutions(normalized).map(segment => normalizeCommand(segment))]
  return candidates.flatMap(segment => splitCommandSegments(segment))
}

const GIT = /^git(?:\s|$)/

const CURL = /^curl(?:\s|$)/

const BARE_RUNNER = /^(?:vitest|pytest|tsc)(?:\s|$)/

const RUNNER_LAUNCHER = /^(?:npx|bunx|pnpm|yarn|uv|python3?|bun)(?:\s|$)/

const RUNNER_PROGRAM = /(?:^|\s)(?:vitest|pytest|tsc)(?:\s|$)/

const BUN_TEST = /^bun\s+(?:run\s+)?(?:--bun\s+)?test(?:\s|$)/

const isRunnerSegment = (segment: string): boolean =>
  BARE_RUNNER.test(segment)
  || BUN_TEST.test(segment)
  || (RUNNER_LAUNCHER.test(segment) && RUNNER_PROGRAM.test(segment))

/**
 * Ordered first-match hint table. Each entry owns only its specific guidance;
 * `git`/`fetch`/`runner` win over the `compound` fallback so near-identical
 * command shapes resolve the same way every time.
 */
export const AFK_HINTS = [
  {
    id: 'git',
    match: (permission, command) =>
      permission === 'bash' && analyzedSegments(command).some(segment => GIT.test(segment)),
    hint: 'Git: that form is not permitted. Use a canonical read form - see .opencode/instructions/no-permission-workarounds.instructions.md.',
  },
  {
    id: 'fetch',
    match: (permission, command) =>
      permission === 'webfetch'
      || (permission === 'bash' && analyzedSegments(command).some(segment => CURL.test(segment))),
    hint: 'Web fetching: direct fetch tools are disabled. Use the MCP fetch server - follow the context-gathering skill.',
  },
  {
    id: 'runner',
    match: (permission, command) =>
      permission === 'bash' && analyzedSegments(command).some(segment => isRunnerSegment(segment)),
    hint: 'Runners: raw runners are not permitted. Use the repository entrypoints - see .opencode/instructions/test-run-commands.instructions.md.',
  },
  {
    id: 'compound',
    match: (permission, command) =>
      permission === 'bash' && splitCommandSegments(normalizeCommand(command)).length > 1,
    hint: 'Compound commands are not permitted. See .opencode/instructions/no-permission-workarounds.instructions.md.',
  },
] as const satisfies readonly AfkHint[]

/**
 * Union of the ids declared in {@link AFK_HINTS}. Derived from the table so a
 * new restriction needs only a table row, never a second id list.
 */
export type AfkHintId = (typeof AFK_HINTS)[number]['id']

/**
 * Builds the single AFK denial message. The core applies to every denial; the
 * first matching hint is inserted when one matches.
 */
export const buildAfkMessage = (permission: string, patterns: readonly string[] = []): string => {
  const commands = patterns.length > 0 ? patterns.map(pattern => pattern.trim()) : ['']
  const matched = AFK_HINTS.find(entry => commands.some(command => entry.match(permission, command)))
  return renderMessage(matched?.hint)
}

/**
 * Generic hint-less message; kept for backward compatibility with existing
 * consumers.
 */
export const AFK_MESSAGE = renderMessage()
