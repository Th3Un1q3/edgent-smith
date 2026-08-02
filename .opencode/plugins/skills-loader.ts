import { Plugin } from '@opencode-ai/plugin'
import Bun from 'bun'
import { readdir } from 'node:fs/promises'
import { log } from './helpers/logger'

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

      // --- Build prefix (skills + budget) ---
      let prefix = ''

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

        prefix = `<task_skills>\n${allBlocks.join('\n')}\n</task_skills>`
      }

      // --- Always wrap prompt ---
      // Strip existing user_request wrappers to prevent nesting when the model echoes them back
      const prompt = (output.args.prompt || '').replaceAll(/<\/?user_request>/g, '')
      output.args.prompt = (prefix ? prefix + '\n' : '')
        + '<user_request>\n'
        + prompt
        + '\n</user_request>'

      // --- Cleanup skills field (only for arrays) ---
      if (Array.isArray(skills)) {
        delete output.args.skills
      }
    },
  }
}
