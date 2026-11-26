/**
 * Prompt wording, one markdown file per template id in `templates/`.
 *
 * A file is the only home for its words; the machine's definitions supply the
 * values and their defaults. Files are read once, at load, from a directory
 * resolved beside this module, so the rendered prompt does not depend on the
 * process's working directory.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const TEMPLATE_IDS = [
  'goal_request',
  'quality_check_failed',
  'validation_self_report',
  'memorize',
  'panic_escalation',
  'park_summary',
  'work_towards_goal',
  'idle_nudge',
  'plan_stage',
  'retrospective_stage',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

export type TemplateValues = Readonly<Record<string, string | boolean | undefined>>

type Node
  = | { readonly kind: 'text', readonly value: string }
    | { readonly kind: 'value', readonly name: string }
    | { readonly kind: 'section', readonly name: string, readonly inverted: boolean, readonly body: readonly Node[] }

export interface Template {
  readonly id: TemplateId
  readonly source: string
  readonly nodes: readonly Node[]
}

/**
 * The one newline an editor appends is not part of the wording; a second one is.
 */
const trimOneNewline = (content: string): string => {
  const withoutNewline = content.endsWith('\n') ? content.slice(0, -1) : content

  return withoutNewline.endsWith('\r') ? withoutNewline.slice(0, -1) : withoutNewline
}

const lineAt = (content: string, index: number): number => content.slice(0, index).split('\n').length

type SectionNode = { kind: 'section', name: string, inverted: boolean, body: Node[] }

type OpenSection = { readonly node: SectionNode, readonly line: number }

const closeSection = (open: OpenSection[], source: string, line: number, name: string): void => {
  const section = open.pop()

  if (section === undefined || section.node.name !== name) {
    throw new Error(source + ':' + line + ' closes section ' + name + ', which is not open')
  }
}

const openSection = (nodes: Node[], open: OpenSection[], source: string, line: number, name: string, isInverted: boolean): void => {
  const enclosing = open.at(-1)

  if (enclosing !== undefined) throw new Error(source + ':' + line + ' nests section ' + name + ' inside ' + enclosing.node.name)

  const node: SectionNode = { kind: 'section', name, inverted: isInverted, body: [] }

  nodes.push(node)
  open.push({ node, line })
}

const innermostBody = (nodes: Node[], open: readonly OpenSection[]): Node[] => open.at(-1)?.node.body ?? nodes

type Tag = { readonly marker: string, readonly name: string, readonly end: number, readonly line: number }

/**
Reads one `{{...}}` tag and rejects a tag that has no name or no closing braces.
*/
const readTag = (content: string, start: number, source: string): Tag => {
  const end = content.indexOf('}}', start + 2)
  const line = lineAt(content, start)

  if (end === -1) throw new Error(source + ':' + line + ' has an unclosed tag')

  const tag = content.slice(start + 2, end)
  const marker = tag.slice(0, 1)
  const name = tag.replace(/^[#^/]/, '')

  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(source + ':' + line + ' has a malformed tag {{' + tag + '}}')

  return { marker, name, end, line }
}

const SECTION_INVERTED = new Map<string, boolean>([['#', false], ['^', true]])

const applyTag = (tag: Tag, target: Node[], nodes: Node[], open: OpenSection[], source: string): void => {
  if (tag.marker === '/') {
    closeSection(open, source, tag.line, tag.name)
    return
  }

  const inverted = SECTION_INVERTED.get(tag.marker)

  if (inverted === undefined) {
    target.push({ kind: 'value', name: tag.name })
    return
  }

  openSection(nodes, open, source, tag.line, tag.name, inverted)
}

const assertSectionsClosed = (open: readonly OpenSection[], source: string): void => {
  const unclosed = open.at(-1)

  if (unclosed !== undefined) throw new Error(source + ':' + unclosed.line + ' leaves section ' + unclosed.node.name + ' open')
}

const pushText = (nodes: Node[], open: readonly OpenSection[], text: string): void => {
  if (text !== '') innermostBody(nodes, open).push({ kind: 'text', value: text })
}

/**
 * Parses a template into text, value and section nodes. Sections do not nest:
 * a section body may hold value tags and text only.
 */
export const parseTemplate = (source: string, content: string): readonly Node[] => {
  const nodes: Node[] = []
  const open: OpenSection[] = []

  let index = 0

  while (index < content.length) {
    const start = content.indexOf('{{', index)

    if (start === -1) {
      pushText(nodes, open, content.slice(index))
      break
    }

    pushText(nodes, open, content.slice(index, start))

    const tag = readTag(content, start, source)

    applyTag(tag, innermostBody(nodes, open), nodes, open, source)

    index = tag.end + 2
  }

  assertSectionsClosed(open, source)

  return nodes
}

const isDefined = (value: TemplateValues[string]): boolean =>
  value !== undefined && value !== null && value !== false

const valueOf = (values: TemplateValues, name: string, source: string): TemplateValues[string] => {
  if (!Object.hasOwn(values, name)) {
    throw new Error(source + ' names the placeholder ' + name + ', which the template values do not supply')
  }

  return values[name]
}

type RenderSection = Extract<Node, { readonly kind: 'section' }>

const renderSection = (node: RenderSection, values: TemplateValues, source: string): string =>
  isDefined(valueOf(values, node.name, source)) === node.inverted ? '' : renderNodes(node.body, values, source)

const renderValue = (name: string, values: TemplateValues, source: string): string =>
  String(valueOf(values, name, source) ?? '')

const renderNode = (node: Node, values: TemplateValues, source: string): string => {
  if (node.kind === 'text') return node.value
  return node.kind === 'value' ? renderValue(node.name, values, source) : renderSection(node, values, source)
}

export const renderNodes = (nodes: readonly Node[], values: TemplateValues, source: string): string =>
  nodes.map(node => renderNode(node, values, source)).join('')

const stems = (directory: URL): readonly string[] =>
  readdirSync(directory).filter(name => name.endsWith('.md')).map(name => name.slice(0, -'.md'.length))

export interface TemplateReadFailure {
  readonly id: TemplateId
  readonly source: string
}

const FALLBACK_PREFIX = 'Stage text unavailable: the template file '

/**
A file the loader cannot read degrades that one stage. Throwing here runs at
import, before any effect exists, so it takes the whole plugin down and the host
reports nothing but a load warning.
*/
const fallbackTemplate = (id: TemplateId, source: string, reason: string): Template => ({
  id,
  source,
  nodes: [{
    kind: 'text',
    value: FALLBACK_PREFIX + source + ' could not be read (' + reason + '). '
      + 'This stage continues without its guidance; report the file.',
  }],
})

const loadTemplate = (id: TemplateId, directory: URL, failed: Set<TemplateId>): Template => {
  const file = new URL(id + '.md', directory)
  const source = fileURLToPath(file)

  try {
    return { id, source, nodes: parseTemplate(source, trimOneNewline(readFileSync(file, 'utf8'))) }
  }
  catch (error) {
    failed.add(id)

    return fallbackTemplate(id, source, String(error))
  }
}

const FALLBACK_LOG = '[state-machine] template unreadable '

/**
 * A failure the values only reach at resolution - a placeholder no provider
 * supplies, or a value that cannot become text - happens while a session runs,
 * where a throw ends the caller instead of the load. It reports here, because no
 * assembly-time log runs again once the plugin is up.
*/
const degradeAtRender = (id: TemplateId, source: string, error: unknown, failed: Set<TemplateId>): Template => {
  if (!failed.has(id)) process.stderr.write(FALLBACK_LOG + 'path=' + source + ' reason=' + String(error) + '\n')

  failed.add(id)

  return fallbackTemplate(id, source, String(error))
}

/**
 * A directory can be absent during a checkout, a branch switch or a partial
 * write. Throwing here runs at import, before any effect exists, so the read
 * reports once and the loader records every id as unreadable instead.
 */
const readStems = (directory: URL): readonly string[] => {
  try {
    return stems(directory)
  }
  catch (error) {
    process.stderr.write(FALLBACK_LOG + 'path=' + fileURLToPath(directory) + ' reason=' + String(error) + '\n')

    return []
  }
}

/**
 * Reads every template. A stray file is still refused here, so a renamed or
 * half-added file cannot sit unnoticed; an unreadable one is recorded in
 * `failures()` and renders its fallback instead of stopping assembly.
 */
export const createTemplateLoader = (directory: URL) => {
  const templates = new Map<TemplateId, Template>()
  const failed = new Set<TemplateId>()
  const stray = readStems(directory).filter(stem => !(TEMPLATE_IDS as readonly string[]).includes(stem))

  if (stray.length > 0) {
    throw new Error('template directory ' + fileURLToPath(directory) + ' has no template id for: ' + stray.join(', '))
  }

  for (const id of TEMPLATE_IDS) templates.set(id, loadTemplate(id, directory, failed))

  const template = (id: TemplateId): Template => {
    const found = templates.get(id)

    if (found === undefined) throw new Error('no template file for ' + id)

    return found
  }

  return {
    template,
    failures: (): readonly TemplateReadFailure[] =>
      [...failed].map(id => ({ id, source: template(id).source })),
    render: (id: TemplateId, values: TemplateValues): string => {
      const { source, nodes } = template(id)

      try {
        return renderNodes(nodes, values, source)
      }
      catch (error) {
        return renderNodes(degradeAtRender(id, source, error, failed).nodes, values, source)
      }
    },
  }
}

const moduleUrl = (import.meta as ImportMeta & { readonly url?: string }).url

if (typeof moduleUrl !== 'string' || !moduleUrl.startsWith('file:')) {
  throw new Error(
    'the state-machine template loader resolves machines/session/templates/ from import.meta.url, which is '
    + String(moduleUrl) + '; that URL cannot name a template file, and this module refuses a cwd-relative read',
  )
}

export const TEMPLATE_DIRECTORY: URL = new URL('templates/', moduleUrl)

const defaultLoader = createTemplateLoader(TEMPLATE_DIRECTORY)

export const TEMPLATE_READ_FAILURES: readonly TemplateReadFailure[] = defaultLoader.failures()

const isLeafPath = (states: readonly string[], path: string): boolean =>
  states.every(other => !other.startsWith(path + '.'))

/**
Registration states what it attached; silence about a missing machine is what
let a dead state machine go unnoticed.
*/
export const attachLogLine = (states: readonly string[], agents: readonly string[]): string =>
  '[state-machine] attached templates=' + TEMPLATE_IDS.length
  + ' states=' + states.filter(path => isLeafPath(states, path)).length
  + ' agents=' + agents.join(',')

export const renderTemplateFile = (id: TemplateId, values: TemplateValues): string =>
  defaultLoader.render(id, values)

const namesIn = (nodes: readonly Node[]): readonly string[] =>
  nodes.flatMap(node => node.kind === 'value'
    ? [node.name]
    : (node.kind === 'section' ? [node.name, ...namesIn(node.body)] : []))

export const templatePlaceholders = (id: TemplateId): readonly string[] =>
  namesIn(defaultLoader.template(id).nodes)
