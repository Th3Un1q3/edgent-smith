import { Plugin } from "@opencode-ai/plugin"
import Bun from "bun"
import { readdir } from "node:fs/promises"
import { log } from "./helpers/logger"

export const skillsLoaderPlugin: Plugin = async ({ client, directory }) => {
    return {
        // TODO: add a custom tool to list skills. under the hood should call `just agent_utils/list-skills` it's a simple text block.
        "tool.definition": async (input, output) => {
            // Guard: only modify the task tool
            if (input.toolID !== "task") return

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
                type: "array",
                items: { type: "string" },
                description: "Optional list of skill names to load from .agents/skills/<name>/SKILL.md and inject into the task prompt. Skills are loaded in mtime order (oldest first) for cache efficiency."
            }
        },

        "tool.execute.before": async (input, output) => {
            // GUARD 1: Only act when tool is "task"
            if (input.tool !== "task") return

            // GUARD 2: Only act when skills is a non-empty array
            const skills = output.args?.skills

            // GUARD 2a: skills must exist
            if (!skills) return

            // GUARD 2b: skills must be an array
            if (!Array.isArray(skills)) return

            // GUARD 2c: skills must be non-empty — output.args is guaranteed to exist
            // because skills came from output.args?.skills.
            if (skills.length === 0) {
                await log(client, "debug", "skills array is empty — nothing to load")
                delete (output.args as Record<string, unknown>).skills
                return
            }

            // GUARD 3: Need directory to resolve skill paths
            if (!directory) {
                delete output.args.skills
                return
            }

            // Load skill files — track both resolved and unresolved
            const resolved: { name: string; content: string; mtimeMs: number }[] = []
            const unresolved: string[] = []

            for (const name of skills) {
                const skillPath = `.agents/skills/${name}/SKILL.md`
                const filePath = `${directory}/${skillPath}`
                const file = Bun.file(filePath)
                // Check file exists; mock may return undefined after reset

                if (!file || !(await file.exists())) {
                    await log(client, "info", `Load the skill "${name}" by the name.`)
                    unresolved.push(name)
                    continue
                }
                const content = await file.text()
                const stat = await file.stat()
                const mtimeMs = stat.mtimeMs
                resolved.push({ name, content, mtimeMs })
            }

            // If nothing to inject (no resolved or unresolved), clean up and return
            if (resolved.length === 0 && unresolved.length === 0) {
                delete output.args.skills
                return
            }

            // Sort resolved by mtimeMs ascending (oldest/most-stable first)
            resolved.sort((a, b) => a.mtimeMs - b.mtimeMs)

            // Build skill_index block for a resolved skill.
            // Lists all files in the skill directory; falls back to SKILL.md only on readdir failure.
            // Captures `directory` from the enclosing closure to satisfy consistent scoping.
            async function buildSkillIndex(name: string): Promise<string> {
                const skillDirectory = `${directory}/.agents/skills/${name}`
                try {
                    const entries = await readdir(skillDirectory)
                    // readdir without withFileTypes returns string[]; filter for safety
                    const files = entries.filter((entry): entry is string => typeof entry === "string")
                    files.sort((a, b) => a.localeCompare(b))
                    const lines = files.map((f) => `.agents/skills/${name}/${f}`)
                    return `<skill_index>\n${lines.join("\n")}\n</skill_index>`
                } catch {
                    return `<skill_index>\n.agents/skills/${name}/SKILL.md\n</skill_index>`
                }
            }

            // Build resolved skill blocks with path attribute and skill_index
            const resolvedBlocks: string[] = []
            for (const s of resolved) {
                const index = await buildSkillIndex(s.name)
                const path = `.agents/skills/${s.name}/SKILL.md`
                resolvedBlocks.push(
                    `<skill name="${s.name}" path="${path}">\n${index}\n${s.content}\n</skill>`
                )
            }

            // Build unresolved skill blocks as reference tags
            const unresolvedBlocks = unresolved.map(
                (name) => `<skill name="${name}" reference="true">Load the skill "${name}" by the name.</skill>`
            )

            const allBlocks = [...resolvedBlocks, ...unresolvedBlocks]

            const skillsBlock = `<task_skills>
${allBlocks.join("\n")}
</task_skills>`

            // Inject into prompt — prepend with newline separator to existing prompt, wrapped to avoid accidental injection
            output.args.prompt = skillsBlock + "\n<user_request>\n" + (output.args.prompt || "") + "\n</user_request>"
    
            // Cleanup — always remove the skills field after processing
            delete output.args.skills
        },
    }
}
