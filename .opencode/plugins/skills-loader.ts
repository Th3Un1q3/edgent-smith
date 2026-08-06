/**
 * Skills loader plugin — envelope flow:
 * tool.execute.before stores the full skill payload in the in-memory envelope store
 * (helpers/envelope-store.ts) and injects only a tiny generic self-closing
 * <envelope id=... description=.../> tag into the task prompt; the chat.message
 * hook unwraps each envelope one-time, replacing the tag with the payload via
 * in-place part.text mutation.
 */
import { Plugin } from '@opencode-ai/plugin'
import Bun from 'bun'
import { readdir } from 'node:fs/promises'
import { createEnvelope, resolveEnvelope } from './helpers/envelope-store'
import type { EnvelopeMetadata } from './helpers/envelope-store'
import { log } from './helpers/logger'

/**
 * UUID-precise envelope tag pattern. Real envelope ids are always
 * crypto.randomUUID() values (lowercase hex UUID v4), so a tag counts as an
 * envelope only when its id has exactly that shape. Literal prose examples
 * like `<envelope id="..." description="..."/>` or `<envelope id="<uuid>"
 * .../>` never match, so the idempotency guard and the chat.message unwrap
 * are never tripped by documentation/templates. Non-global: the unwrap hook
 * derives a fresh global instance per part to avoid lastIndex hazards.
 */
const ENVELOPE_TAG_PATTERN = /<envelope\b[^>]*\bid="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"[^>]*\/>/

async function buildSkillIndex(name: string, directory: string): Promise<string> {
  const skillDirectory = `${directory}/.agents/skills/${name}`
  try {
    const entries = await readdir(skillDirectory)
    const files = entries.filter((entry): entry is string => typeof entry === 'string')
    const sorted = [...files].sort((a, b) => a.localeCompare(b))
    const lines = sorted.map(f => `.agents/skills/${name}/${f}`)
    return `<skill_index>\n${lines.join('\n')}\n</skill_index>`
  }
  catch {
    return `<skill_index>\n.agents/skills/${name}/SKILL.md\n</skill_index>`
  }
}

export const skillsLoaderPlugin: Plugin = async ({ client, directory }) => {
  return {
    'tool.definition': async (input, output) => {
      // Guard: only modify the task tool
      if (input.toolID !== 'task') return

      // Guard: need jsonSchema to modify
      const out = output as Record<string, unknown>
      if (!out.jsonSchema) return

      const jsonSchema = out.jsonSchema as Record<string, unknown>

      // Ensure properties object exists on jsonSchema
      if (!jsonSchema.properties) {
        jsonSchema.properties = {}
      }
      const properties = jsonSchema.properties as Record<string, unknown>

      // Skip if skills already added (idempotent)
      if (properties.skills) return

      // Add skills as an optional array of strings in JSON Schema format
      properties.skills = {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of skill names to load from .agents/skills/<name>/SKILL.md and inject into the task prompt. Skills are loaded in mtime order (oldest first) for cache efficiency.',
      }
    },

    'tool.execute.before': async (input, output) => {
      // GUARD 1: Only act when tool is "task"
      if (input.tool !== 'task') return

      // GUARD 2: Need args to modify
      if (!output.args) return

      const skills = output.args.skills
      const existingPrompt = (output.args.prompt || '') as string

      // GUARD 3: Idempotency — never double-envelope. If the prompt already
      // carries a REAL envelope tag (UUID id, e.g. the model echoed a
      // previously-enveloped prompt back into a new task), skip skill loading
      // and envelope creation entirely and just proceed to wrapping. Prose
      // examples like `<envelope id="..." .../>` never match this pattern.
      const isAlreadyEnveloped = ENVELOPE_TAG_PATTERN.test(existingPrompt)

      let prefix = ''

      if (!isAlreadyEnveloped) {
        // --- Skill loading (optional) ---
        const resolved: { name: string, content: string, mtimeMs: number }[] = []
        const unresolved: string[] = []

        if (Array.isArray(skills) && skills.length > 0 && directory) {
          // Load skill files — track both resolved and unresolved
          for (const name of skills) {
            const skillPath = `.agents/skills/${name}/SKILL.md`
            const filePath = `${directory}/${skillPath}`
            const file = Bun.file(filePath)

            if (!file || !(await file.exists())) {
              await log(client, 'info', `Load the skill "${name}" by the name.`)
              unresolved.push(name)
              continue
            }
            const content = await file.text()
            const stat = await file.stat()
            const mtimeMs = stat.mtimeMs
            resolved.push({ name, content, mtimeMs })
          }
        }
        else if (Array.isArray(skills) && skills.length === 0) {
          await log(client, 'debug', 'skills array is empty — nothing to load')
        }

        // Sort resolved by mtimeMs ascending (oldest/most-stable first)
        const sortedResolved = [...resolved].sort((a, b) => a.mtimeMs - b.mtimeMs)

        // --- Build envelope (skills + budget) ---
        if (sortedResolved.length > 0 || unresolved.length > 0) {
          // Build resolved skill blocks with path attribute and skill_index
          const resolvedBlocks: string[] = []
          for (const s of sortedResolved) {
            const index = await buildSkillIndex(s.name, directory)
            const path = `.agents/skills/${s.name}/SKILL.md`
            resolvedBlocks.push(
              `<skill name="${s.name}" path="${path}">\n${index}\n${s.content}\n</skill>`,
            )
          }

          // Build unresolved skill blocks as reference tags
          const unresolvedBlocks = unresolved.map(
            name => `<skill name="${name}" reference="true">Load the skill "${name}" by the name.</skill>`,
          )

          const allBlocks = [...resolvedBlocks, ...unresolvedBlocks]

          // Full payload — byte-identical to the previous direct-injection format
          const payload = `<task_skills>\n${allBlocks.join('\n')}\n</task_skills>`

          // Store the payload in the in-memory envelope store under a random key
          const metadata: EnvelopeMetadata = {
            skills: sortedResolved.map(s => ({ name: s.name, mtimeMs: s.mtimeMs })),
            unresolved,
          }
          const key = await createEnvelope(payload, metadata)

          // Inject ONLY a tiny generic self-closing envelope tag; the recipient
          // unwraps it into the full payload. The description attribute lists
          // every requested skill name (resolved + unresolved, final ordering)
          // so the parent sees a minimalistic but descriptive sign of what it
          // sent. Skill names are XML-escaped for safe embedding in the
          // double-quoted attribute (& → &amp;, " → &quot;, ' → &apos;, > → &gt;
          // — & first so escapes are not double-processed; ' is escaped for
          // symmetric single-quote-safe names inside the JS-array-like repr; >
          // must be escaped because ENVELOPE_TAG_PATTERN's [^>]* ends at the
          // first literal '>' and a raw one would break tag matching/unwrapping).
          const allNames = [...sortedResolved.map(s => s.name), ...unresolved]
          const escapeAttribute = (value: string): string =>
            value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('\'', '&apos;').replaceAll('>', '&gt;')
          const description = `Skills specified by skills array: [${allNames.map(n => `'${escapeAttribute(n)}'`).join(', ')}]. Subagent will unpack full skills content.`
          prefix = `<envelope id="${key}" description="${description}"/>`
        }
      }

      // --- Always wrap prompt ---
      // Strip existing user_request wrappers to prevent nesting when the model echoes them back
      const prompt = existingPrompt.replaceAll(/<\/?user_request>/g, '')
      output.args.prompt = (prefix ? prefix + '\n' : '')
        + '<user_request>\n'
        + prompt
        + '\n</user_request>'

      // --- Cleanup skills field (only for arrays) ---
      if (Array.isArray(skills)) {
        delete output.args.skills
      }
    },

    'chat.message': async (input, output) => {
      const parts = output.parts

      // Cheap guard: no REAL envelope tag anywhere → no-op, leave every part
      // untouched. Uses the UUID-precise pattern so prose examples (id="...",
      // id="<uuid>") never even enter the unwrap loop, hence never reach the
      // warn path.
      if (parts.every(p => !(p.type === 'text' && ENVELOPE_TAG_PATTERN.test(p.text)))) return

      for (const part of parts) {
        if (part.type !== 'text' || !ENVELOPE_TAG_PATTERN.test(part.text)) continue

        // Fresh global regex per part: exec() mutates lastIndex, and
        // resolveEnvelope is awaited inside the loop, so a shared instance
        // could be clobbered by a concurrently-dispatched message. Matches
        // standalone self-closing <envelope ... id="<uuid>" .../> tags (id in
        // any attribute position); tags without a UUID-shaped id — real prose
        // examples or malformed non-self-closing tags without "/>" — are left
        // untouched.
        const envelopeTag = new RegExp(ENVELOPE_TAG_PATTERN.source, 'g')

        let result = ''
        let lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = envelopeTag.exec(part.text)) !== null) {
          const tag = match[0]
          const id = match[1]
          const payload = await resolveEnvelope(id)

          if (payload === undefined) {
            // Envelope already consumed or unknown key — leave the placeholder
            // tag in place (one-time unwrap; never strip or re-create).
            await log(client, 'warn', `Envelope ${id} not found — leaving placeholder.`)
            result += part.text.slice(lastIndex, match.index) + tag
          }
          else {
            result += part.text.slice(lastIndex, match.index) + payload
          }
          lastIndex = match.index + tag.length
        }

        part.text = result + part.text.slice(lastIndex)
      }
    },
  }
}
