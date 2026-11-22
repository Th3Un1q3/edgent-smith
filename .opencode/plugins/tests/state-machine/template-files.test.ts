import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { renderPrompt, renderTemplate } from '@plugins/state-machine/machines/session/definitions'
import {
  TEMPLATE_DIRECTORY,
  TEMPLATE_IDS,
  createTemplateLoader,
  parseTemplate,
  renderNodes,
  templatePlaceholders,
} from '@plugins/state-machine/machines/session/template-files'

import type { LoopContext } from '@plugins/state-machine/core/machine'
import type { TemplateId } from '@plugins/state-machine/machines/session/template-files'

const context = (overrides: Record<string, unknown> = {}): LoopContext => ({
  goal: 'ship it',
  attempts: 0,
  intent: 'none',
  memories: [],
  improvements: [],
  memoryLimit: 3,
  injected: {},
  injectedSkills: [],
  memoryTokens: [],
  results: {},
  signalsPolicy: { names: [] },
  ...overrides,
} as unknown as LoopContext)

interface ParityCase {
  readonly name: TemplateId
  readonly state?: string
  readonly context: LoopContext
  readonly expected: string
}

const cases: readonly ParityCase[] = [
  {
    name: 'goal_request',
    context: context(),
    expected: 'This session runs a state machine. What goal should it accomplish?',
  },
  {
    name: 'idle_nudge',
    state: 'work',
    context: context(),
    expected: 'You are idle in `work`, which has not finished. Call signal_send with CLAIM_WORK when the current work unit is done. The loop stays in `work` until a signal or command moves it on, so act rather than stop.',
  },
  {
    name: 'validation_self_report',
    context: context(),
    expected: 'Verdict: call signal_send with type GOAL_ACHIEVED when the goal is met, or GOAL_INCOMPLETE when it is not.',
  },
  {
    name: 'quality_check_failed',
    context: context(),
    expected: 'Quality check failed: unknown. Parked in panic for investigation.',
  },
  {
    name: 'quality_check_failed',
    context: context({ failure: { reason: 'exit 1', detail: 'type error' } }),
    expected: 'Quality check failed: exit 1 (type error). Parked in panic for investigation.',
  },
  {
    name: 'quality_check_failed',
    context: context({ failure: { reason: 'exit 1', detail: '' } }),
    expected: 'Quality check failed: exit 1 (). Parked in panic for investigation.',
  },
  {
    name: 'panic_escalation',
    context: context(),
    expected: 'Parked for investigation: unknown',
  },
  {
    name: 'panic_escalation',
    context: context({ failure: { reason: 'attempts exhausted', detail: 'three tries' } }),
    expected: 'Parked for investigation: attempts exhausted (three tries)',
  },
  {
    name: 'memorize',
    context: context({ intent: 'improvement' }),
    expected: 'Name one improvement.',
  },
  {
    name: 'memorize',
    context: context({ intent: 'none' }),
    expected: 'Name what to change next attempt.',
  },
  {
    name: 'park_summary',
    context: context({ goal: 'ship it', improvements: ['read the line.'] }),
    expected: 'Goal reached: ship it. Improvements: read the line. Waiting for your next instruction.',
  },
  {
    name: 'park_summary',
    context: context({ goal: 'ship it.', improvements: [] }),
    expected: 'Goal reached: ship it. Improvements: none. Waiting for your next instruction.',
  },
  {
    name: 'work_towards_goal',
    context: context({
      goal: 'ship it',
      memories: ['a', 'b'],
      injected: { 'preferences/user': { full: ['p'], index: [] } },
    }),
    expected: 'Work towards: ship it. Memories: a | b. Preferences: p',
  },
  {
    name: 'work_towards_goal',
    context: context({ goal: 'ship it', memories: [], injected: {} }),
    expected: 'Work towards: ship it. Memories: none. Preferences: none',
  },
]

describe('template parity with the pre-extraction output', () => {
  it.each(cases)('renders $name byte-identically', ({ name, state, context: loop, expected }) => {
    expect(renderTemplate({ template: name }, loop, state)).toBe(expected)
  })

  it('covers every template and every placeholder', () => {
    expect(new Set(cases.map(item => item.name))).toEqual(new Set(TEMPLATE_IDS))
    expect(new Set(cases.flatMap(item => templatePlaceholders(item.name)))).toEqual(new Set([
      'reason',
      'detail',
      'goal',
      'improvements',
      'memories',
      'preferences',
      'improvement',
      'state',
      'status',
    ]))
  })

  it('keeps the literal text form, which wins over a template', () => {
    expect(renderPrompt({ template: 'goal_request', text: 'literal line', description: 'A line.' }, context()))
      .toBe('literal line')
  })
})

describe('template files', () => {
  it('has one file per template id and one template id per file', () => {
    const stems = readdirSync(TEMPLATE_DIRECTORY)
      .filter(name => name.endsWith('.md'))
      .map(name => name.slice(0, -'.md'.length))
    const ids: readonly string[] = TEMPLATE_IDS

    expect(ids.filter(id => !stems.includes(id))).toEqual([])
    expect(stems.filter(stem => !ids.includes(stem))).toEqual([])
  })

  it('fails at load when the directory holds a file with no template id', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'state-machine-templates-'))
    writeFileSync(path.join(directory, 'stray.md'), 'no such template\n')

    expect(() => createTemplateLoader(pathToFileURL(directory + '/')))
      .toThrow(/no template id for: stray/)
  })

  it('fails at load naming the absolute path of a missing template file', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'state-machine-templates-'))

    expect(() => createTemplateLoader(pathToFileURL(directory + '/')))
      .toThrow(/goal_request\.md cannot be read/)
  })

  it('refuses an unknown template id by name', () => {
    const loader = createTemplateLoader(TEMPLATE_DIRECTORY)

    expect(() => loader.template('missing' as TemplateId)).toThrow('no template file for missing')
  })
})

describe('placeholder rules', () => {
  it('throws naming the file and the tag when the values omit a tag', () => {
    const nodes = parseTemplate('probe.md', 'hello {{nope}}')

    expect(() => renderNodes(nodes, {}, 'probe.md')).toThrow(/probe\.md names the placeholder nope/)
  })

  it('renders a declared placeholder with no value as empty text', () => {
    expect(renderNodes(parseTemplate('probe.md', 'a{{x}}b'), { x: undefined }, 'probe.md')).toBe('ab')
  })

  it('substitutes a repeated placeholder at each occurrence', () => {
    expect(renderNodes(parseTemplate('probe.md', '{{x}}/{{x}}'), { x: 'v' }, 'probe.md')).toBe('v/v')
  })

  it('renders a section for a defined empty value and skips an omitted one', () => {
    const nodes = parseTemplate('probe.md', '{{#detail}} ({{detail}}){{/detail}}')

    expect(renderNodes(nodes, { detail: '' }, 'probe.md')).toBe(' ()')
    expect(renderNodes(nodes, { detail: undefined }, 'probe.md')).toBe('')
  })

  it('renders the inverted section only for an undefined or false value', () => {
    const nodes = parseTemplate('probe.md', '{{^x}}fallback{{/x}}')

    expect(renderNodes(nodes, { x: false }, 'probe.md')).toBe('fallback')
    expect(renderNodes(nodes, { x: true }, 'probe.md')).toBe('')
  })

  it('throws at load naming the file and line of an unclosed tag', () => {
    expect(() => parseTemplate('bad.md', 'line one\n{{name')).toThrow(/bad\.md:2 has an unclosed tag/)
  })

  it('throws at load naming the file and line of a nested section', () => {
    expect(() => parseTemplate('bad.md', '{{#a}}{{#b}}x{{/b}}{{/a}}'))
      .toThrow(/bad\.md:1 nests section b inside a/)
  })

  it('throws naming the file and line of a malformed tag', () => {
    expect(() => parseTemplate('bad.md', '{{bad-name}}')).toThrow(/bad\.md:1 has a malformed tag \{\{bad-name\}\}/)
  })

  it('throws when a closing tag has no open section', () => {
    expect(() => parseTemplate('bad.md', '{{/attempt}}')).toThrow(/bad\.md:1 closes section attempt, which is not open/)
  })

  it('throws when a section is left open at the end of the file', () => {
    expect(() => parseTemplate('bad.md', '{{#attempts}}work')).toThrow(/bad\.md:1 leaves section attempts open/)
  })
})
