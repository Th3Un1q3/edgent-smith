 
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock factories — synchronous imports avoid circular dependency issues.
import type { PluginInput } from "@opencode-ai/plugin"
import { defaultCreateClient } from "@tests/helpers/mock-utilities"
import type { ClientMock } from "@tests/helpers/mock-utilities"

vi.mock("bun", () => {
    const mockFile = vi.fn()
    return { default: { file: mockFile }, Glob: vi.fn() }
})
vi.mock("@plugins/helpers/logger")

// Import stubs AFTER vi.mock() calls
import Bun from "bun"
import { log } from "@plugins/helpers/logger"

// Future implementation — module-not-found is expected RED state
import { skillsLoaderPlugin } from "@plugins/skills-loader"

// ── Type helpers ──────────────────────────────────────────────────

const mockBunFile = Bun.file as ReturnType<typeof vi.fn>

interface SkillFileMock {
    exists: ReturnType<typeof vi.fn>
    text: ReturnType<typeof vi.fn>
    stat: ReturnType<typeof vi.fn>
}

// ── Helpers ───────────────────────────────────────────────────────

function createMockClient(overrides?: Partial<ClientMock>): ClientMock {
    return {
        ...defaultCreateClient(),
        app: {
            log: vi.fn().mockResolvedValue(undefined),
            agents: vi.fn().mockResolvedValue({ data: [{ name: "build" }] }),
        },
        ...overrides,
    }
}

function makeSkillFile({ name, content, mtimeMs }: { name: string; content: string; mtimeMs: number }): SkillFileMock {
    void name // used to document which skill file this represents
    return {
        exists: vi.fn().mockResolvedValue(true),
        text: vi.fn().mockResolvedValue(content),
        stat: vi.fn().mockResolvedValue({ mtimeMs }),
    }
}

function makeMissingSkillFile(): SkillFileMock {
    return {
        exists: vi.fn().mockResolvedValue(false),
        text: vi.fn().mockRejectedValue(new Error("File does not exist")),
        stat: vi.fn().mockRejectedValue(new Error("File does not exist")),
    }
}

/**
 * Registers a skill file name → mock mapping so that Bun.file(name)
 * calls return the corresponding mock.
 */
function registerSkillFiles(
    files: Record<string, SkillFileMock>,
    pathPattern: (name: string) => string = (name) => `.agents/skills/${name}/SKILL.md`,
): void {
    mockBunFile.mockImplementation((path: string) => {
        for (const [name, mock] of Object.entries(files)) {
            if (path.endsWith(pathPattern(name))) {
                return mock
            }
        }
        // Default to missing
        return makeMissingSkillFile()
    })
}

// ── Tests ─────────────────────────────────────────────────────────

describe("skillsLoaderPlugin", () => {
    let client: ClientMock
    let plugin: Awaited<ReturnType<typeof skillsLoaderPlugin>>

    function executeBeforeHook() {
        return plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
    }

    beforeEach(async () => {
        client = createMockClient()
        plugin = await skillsLoaderPlugin({ client, directory: "/workspace" } as unknown as PluginInput)
    })

    // ── TEST 1: task tool with skills field ──────────────────────

    it("injects skills into prompt and removes skills field when task tool has skills", async () => {
        registerSkillFiles({
            "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A\nBody of skill A.", mtimeMs: 100 }),
            "skill-b": makeSkillFile({ name: "skill-b", content: "---\nname: skill-b\n---\n\n# Skill B\nBody of skill B.", mtimeMs: 200 }),
        })

        const hook = executeBeforeHook()

        const input = { tool: "task", sessionID: "sess-1", callID: "call-1" }
        const output = { args: { prompt: "original prompt", skills: ["skill-a", "skill-b"] } }

        await hook(input, output)

        // Skills field removed
        expect(output.args.skills).toBeUndefined()

        // Prompt starts with <task_skills> block
        expect(output.args.prompt).toMatch(/^<task_skills>/)
        expect(output.args.prompt).toContain("</task_skills>")

        // Both skills injected
        expect(output.args.prompt).toContain("skill-a")
        expect(output.args.prompt).toContain("skill-b")
        expect(output.args.prompt).toContain("Body of skill A.")
        expect(output.args.prompt).toContain("Body of skill B.")

        // Skill blocks separated by newlines (not collapsed via join(""))
        expect(output.args.prompt).toMatch(/<\/skill>\n<skill name=/)

        // Original prompt wrapped in <user_request> block
        expect(output.args.prompt).toContain("<user_request>\noriginal prompt\n</user_request>")
        // Original prompt comes after closing task_skills tag
        expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)
    })

    // ── when no skills to inject ─────────────────────────────────

    describe("when no skills to inject", () => {
        // eslint-disable-next-line unicorn/consistent-function-scoping -- scoped helper alongside executeBeforeHook
        async function act(output: { args: Record<string, unknown> }): Promise<void> {
            const hook = executeBeforeHook()
            const input = { tool: "task", sessionID: "sess-1", callID: "call-no-skills" }
            await hook(input, output)
        }

        it.each([
            { desc: "skills field is absent", output: { args: { prompt: "original prompt" } } },
            { desc: "skills array is empty", output: { args: { prompt: "original prompt", skills: [] } } },
        ])("does not modify prompt when $desc", async ({ output }) => {
            await act(output)
            expect(output.args.prompt).toBe("original prompt")
        })

        it("does not call Bun.file when skills field is absent", async () => {
            const output = { args: { prompt: "original prompt" } }
            await act(output)
            expect(mockBunFile).not.toHaveBeenCalled()
        })

        it("removes skills field when skills array is empty", async () => {
            const output = { args: { prompt: "original prompt", skills: [] } }
            await act(output)
            expect(output.args.skills).toBeUndefined()
        })

        it("logs debug message when skills array is empty", async () => {
            const output = { args: { prompt: "original prompt", skills: [] } }
            await act(output)
            expect(log).toHaveBeenCalledWith(
                expect.any(Object),
                "debug",
                expect.stringContaining("skills array is empty"),
            )
        })
    })

    // ── tests for surviving mutants: optional chaining, non-array guard, directory guard ──

    it("returns early without throwing when output.args is undefined", async () => {
        const hook = executeBeforeHook()
        const input = { tool: "task", sessionID: "sess-1", callID: "call-no-args" }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally testing runtime behavior when args is missing
        const output: any = {}

        await expect(hook(input, output)).resolves.toBeUndefined()

        // No args property should have been added
        expect(output.args).toBeUndefined()
        // Bun.file should not be called
        expect(mockBunFile).not.toHaveBeenCalled()
    })

    it.each([
        { desc: "string", skills: "not-an-array" as unknown },
        { desc: "undefined", skills: undefined as unknown },
    ])("returns early and preserves skills field when skills is $desc", async ({ skills }) => {
        const hook = executeBeforeHook()
        const input = { tool: "task", sessionID: "sess-1", callID: "call-bad-skills" }
        const output = { args: { prompt: "original prompt", skills } }

        await hook(input, output)

        // Prompt must remain unchanged
        expect(output.args.prompt).toBe("original prompt")
        // skills field must be preserved (not deleted by the cleanup block)
        expect(output.args.skills).toBe(skills)
        // Bun.file must not be called
        expect(mockBunFile).not.toHaveBeenCalled()
    })

    it("removes skills field and returns early when directory is undefined", async () => {
        const pluginNoDirectory = await skillsLoaderPlugin({ client } as unknown as PluginInput)
        const hook = pluginNoDirectory?.["tool.execute.before"] ?? (() => Promise.resolve())

        registerSkillFiles({
            "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }),
        })

        const input = { tool: "task", sessionID: "sess-1", callID: "call-no-dir" }
        const output = { args: { prompt: "original prompt", skills: ["skill-a"] } }

        await hook(input, output)

        // skills field must be deleted
        expect(output.args.skills).toBeUndefined()
        // Prompt must remain unchanged (early return before file loading)
        expect(output.args.prompt).toBe("original prompt")
        // Bun.file must not be called (guard returns before file loading)
        expect(mockBunFile).not.toHaveBeenCalled()
    })

    // ── TEST 4: non-task tool with skills field ──────────────────

    it("does not intercept non-task tools even with skills field", async () => {
        const hook = executeBeforeHook()

        const input = { tool: "write", sessionID: "sess-1", callID: "call-write" }
        const output = { args: { prompt: "do something", skills: ["skill-a"] } }

        await hook(input, output)

        // Prompt unchanged
        expect(output.args.prompt).toBe("do something")
        // skills field preserved (plugin only removes for the task tool)
        expect(output.args.skills).toEqual(["skill-a"])
    })

    // ── TEST 5: skills sorted by mtime ascending (oldest first) ──

    it("sorts skills by file modification time ascending (oldest first)", async () => {
        registerSkillFiles({
            "skill-c": makeSkillFile({ name: "skill-c", content: "---\nname: skill-c\n---\n\n# Skill C", mtimeMs: 300 }),
            "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A", mtimeMs: 100 }),
            "skill-b": makeSkillFile({ name: "skill-b", content: "---\nname: skill-b\n---\n\n# Skill B", mtimeMs: 200 }),
        })

        const hook = executeBeforeHook()

        const input = { tool: "task", sessionID: "sess-1", callID: "call-order" }
        const output = { args: { prompt: "prompt", skills: ["skill-c", "skill-a", "skill-b"] } }

        await hook(input, output)

        const prompt = (output.args.prompt ?? "")
        const re = /<skill name="([^"]+)">/g
        const skillNames: string[] = Array.from(prompt.matchAll(re), match => match[1]);

        // Oldest first: skill-a (100), skill-b (200), skill-c (300)
        expect(skillNames).toEqual(["skill-a", "skill-b", "skill-c"])
    })

    // ── TEST 6: missing skill file → skip and warn ───────────────

    it("skips missing skill files and injects remaining skills", async () => {
        registerSkillFiles({
            "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A", mtimeMs: 100 }),
            // skill-b does not register → default missing
            "skill-c": makeSkillFile({ name: "skill-c", content: "---\nname: skill-c\n---\n\n# Skill C", mtimeMs: 300 }),
        })

        const hook = executeBeforeHook()

        const input = { tool: "task", sessionID: "sess-1", callID: "call-missing" }
        const output = { args: { prompt: "prompt", skills: ["skill-a", "skill-b", "skill-c"] } }

        await hook(input, output)

        expect(output.args.skills).toBeUndefined()
        expect(output.args.prompt).toContain("Skill A")
        expect(output.args.prompt).toContain("Skill C")
        expect(output.args.prompt).not.toContain("Skill B")

        // Warning logged for missing skill
        expect(log).toHaveBeenCalledWith(
            expect.any(Object),
            "warn",
            expect.stringContaining("skill-b"),
        )
    })

    // ── TEST 7: all skills missing → prompt unchanged, warn ──────

    it("does not inject when all skills are missing", async () => {
        // No skills registered → default missing for all

        const hook = executeBeforeHook()

        const input = { tool: "task", sessionID: "sess-1", callID: "call-all-missing" }
        const output = { args: { prompt: "prompt", skills: ["no-such-skill"] } }

        await hook(input, output)

        expect(output.args.prompt).toBe("prompt")
        expect(output.args.skills).toBeUndefined()

        // Warning logged
        expect(log).toHaveBeenCalledWith(
            expect.any(Object),
            "warn",
            expect.stringContaining("no-such-skill"),
        )
    })

    // ── TEST 8: single skill injection ───────────────────────────

    it("injects a single skill correctly", async () => {
        registerSkillFiles({
            "only-skill": makeSkillFile({ name: "only-skill", content: "---\nname: only-skill\n---\n\n# Only\nSingle body.", mtimeMs: 150 }),
        })

        const hook = executeBeforeHook()

        const input = { tool: "task", sessionID: "sess-1", callID: "call-single" }
        const output = { args: { prompt: "original prompt", skills: ["only-skill"] } }

        await hook(input, output)

        expect(output.args.skills).toBeUndefined()
        expect(output.args.prompt).toContain("<task_skills>")
        expect(output.args.prompt).toContain("only-skill")
        expect(output.args.prompt).toContain("Single body.")
        expect(output.args.prompt).toContain("<user_request>\noriginal prompt\n</user_request>")
        expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)
    })

    // ── TEST: missing prompt fallback (line 90: output.args.prompt || "") ──

    it("uses empty string fallback when prompt is missing from args", async () => {
        registerSkillFiles({
            "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }),
        })

        const hook = executeBeforeHook()

        const input = { tool: "task", sessionID: "sess-1", callID: "call-no-prompt" }
        const output: { args: Record<string, unknown> } = { args: { skills: ["skill-a"] } }

        await hook(input, output)

        expect(output.args.skills).toBeUndefined()
        // Prompt must NOT contain "undefined" — uses "" fallback
        expect(output.args.prompt).toContain("<task_skills>")
        expect(output.args.prompt).toContain("Skill A")
        expect(output.args.prompt).toContain("<user_request>\n\n</user_request>")
    })

    // ── tool.definition hook tests ─────────────────────────────────
    //
    // The hook modifies output.jsonSchema (plain JSON Schema format that the LLM sees).

    describe("tool.definition", () => {
        // eslint-disable-next-line unicorn/consistent-function-scoping -- scoped to tool.definition describe for clarity alongside executeBeforeHook
        function toolDefinitionHook() {
            return plugin?.["tool.definition"] ?? (() => Promise.resolve())
        }

        async function applyDefinitionHook(input: { toolID: string }, output: ToolHookOutput): Promise<void> {
            const hook = toolDefinitionHook()
            await hook(input, output)
        }

        interface SchemaProperty {
            type?: string
            items?: { type: string }
            description?: string
        }

        interface ToolJsonSchema {
            type: string
            properties?: Record<string, SchemaProperty>
            required?: string[]
        }

        interface ToolHookOutput {
            description: string
            parameters: Record<string, unknown>
            jsonSchema?: ToolJsonSchema
        }

        it("adds skills parameter to task tool jsonSchema", async () => {
            const output: ToolHookOutput = {
                description: "Run a subagent",
                parameters: {},
                jsonSchema: {
                    type: "object",
                    properties: {
                        prompt: { type: "string", description: "The task for the agent" }
                    },
                    required: ["prompt"]
                }
            }

            await applyDefinitionHook({ toolID: "task" }, output)

            const schema = output.jsonSchema as ToolJsonSchema
            const properties = schema.properties as Record<string, SchemaProperty>

            // skills property added
            expect(properties.skills).toBeDefined()
            expect(properties.skills.type).toBe("array")
            expect(properties.skills.items).toEqual({ type: "string" })
            expect(properties.skills.description).toContain(".agents/skills")

            // Existing properties preserved
            expect(properties.prompt).toBeDefined()
            expect(properties.prompt.type).toBe("string")

            // Not added to required
            expect(schema.required).not.toContain("skills")
        })

        it("does not modify non-task tool jsonSchema", async () => {
            const output: ToolHookOutput = {
                description: "Write a file",
                parameters: {},
                jsonSchema: {
                    type: "object",
                    properties: {
                        filePath: { type: "string" }
                    }
                }
            }

            await applyDefinitionHook({ toolID: "write" }, output)

            const schema = output.jsonSchema as ToolJsonSchema
            const properties = schema.properties as Record<string, SchemaProperty>

            // skills NOT added
            expect(properties.skills).toBeUndefined()
            // Existing property preserved
            expect(properties.filePath).toBeDefined()
        })

        it("initializes jsonSchema.properties when missing", async () => {
            const output: ToolHookOutput = {
                description: "Run a subagent",
                parameters: {},
                jsonSchema: {
                    type: "object"
                    // no properties key
                }
            }

            await applyDefinitionHook({ toolID: "task" }, output)

            const schema = output.jsonSchema as ToolJsonSchema

            // properties was created by the hook
            expect(schema.properties).toBeDefined()

            const properties = schema.properties as Record<string, SchemaProperty>
            expect(properties.skills).toBeDefined()
            expect(properties.skills.type).toBe("array")
        })

        it("handles missing jsonSchema by returning early", async () => {
            const output: ToolHookOutput = {
                description: "Run a subagent",
                parameters: {},
                // no jsonSchema at all
            }

            // Should not throw
            await expect(applyDefinitionHook({ toolID: "task" }, output)).resolves.toBeUndefined()
            // jsonSchema should not be created
            expect(output.jsonSchema).toBeUndefined()
        })

        it("does not overwrite skills property when it already exists (idempotent)", async () => {
            const output: ToolHookOutput = {
                description: "Run a subagent",
                parameters: {},
                jsonSchema: {
                    type: "object",
                    properties: {
                        skills: { type: "array", items: { type: "string" }, description: "custom skills" },
                        prompt: { type: "string" },
                    },
                },
            }

            await applyDefinitionHook({ toolID: "task" }, output)

            const schema = output.jsonSchema as ToolJsonSchema
            const properties = schema.properties as Record<string, SchemaProperty>

            // Existing skills property must NOT be overwritten
            expect(properties.skills).toBeDefined()
            expect(properties.skills.description).toBe("custom skills")
            expect(properties.skills.type).toBe("array")
            // prompt should still be preserved
            expect(properties.prompt).toBeDefined()
        })
    })

    // (tool.listSkills removed — TODO to be re-implemented later)
})
