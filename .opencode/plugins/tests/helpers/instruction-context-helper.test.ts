import { describe, expect, it } from "vitest"

// Import the module-under-test (stub provides interfaces; throws on call in TDD red phase)
import { InstructionContextHelper, ResolvedInstruction } from "@plugins/helpers/instruction-context-helper"

// ── Helpers ──────────────────────────────────────────────────────────────

import { makeMockIndexer, createIndexerFactory } from "@tests/helpers/mock-utilities"

/** Build a helper instance with a mock indexer. */
function makeHelper(
  metas: Array<{ description: string; path: string; applyTo: string }>,
  bodyMap?: Record<string, string>,
) {
  return new InstructionContextHelper({
    indexerFactory: createIndexerFactory(makeMockIndexer(metas, bodyMap)),
  })
}

// ── Tests — TDD red phase: all tests assert expected output, will fail until implementation exists ──

describe("InstructionContextHelper", () => {
  // ════════════════════════════════════════════════════════════
  // Prioritization by glob specificity
  // ════════════════════════════════════════════════════════════

  describe("prioritization by glob specificity", () => {
    it("returns instructions sorted by glob specificity: most specific first (src/**/*.ts > **/*.ts > **/*.{ts,js})", async () => {
      const helper = makeHelper([
        { description: "global ts files", path: "/a.global.instructions.md", applyTo: "**/*.{ts,js}" },
        { description: "all ts files", path: "/b.all-ts.instructions.md", applyTo: "**/*.ts" },
        { description: "src ts files", path: "/c.src-ts.instructions.md", applyTo: "src/**/*.ts" },
      ])

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      // More specific globs should appear first in the output
      expect(result[0].description).toBe("src ts files")
      expect(result[1].description).toBe("all ts files")
      expect(result[2].description).toBe("global ts files")
    })

    it("falls back to alphabetical order by description when specificity is tied", async () => {
      const helper = makeHelper([
        { description: "zebra glob", path: "/a.zebra.instructions.md", applyTo: "**/*.ts" },
        { description: "alpha glob", path: "/b.alpha.instructions.md", applyTo: "**/*.js" },
      ])

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      // Same specificity → alphabetical by description (ascending)
      expect(result[0].description).toBe("alpha glob")
      expect(result[1].description).toBe("zebra glob")
    })
  })

  // ════════════════════════════════════════════════════════════
  // All matching instructions are returned — no content-size filtering
  // ════════════════════════════════════════════════════════════

  describe("returns ALL matching instructions regardless of content size", () => {
    // Pre-computed constant to avoid eslint conflicts (unicorn/prefer-code-point vs no-non-null-assertion)
    const A_CODE_POINT = 97;

    it.each([
      { name: "tiny bodies (10 chars each)", sizes: [10, 20, 30] },
      { name: "medium bodies (500 chars each)", sizes: [500, 600, 700] },
      { name: "large bodies (10k chars each)", sizes: [10_000, 20_000, 30_000] },
      { name: "huge bodies (500k chars total)", sizes: [200_000, 300_000] },
    ])("returns all instructions with $name", async ({ sizes }) => {
      const helper = makeHelper(
        sizes.map((size, index) => ({
          description: `instruction ${String.fromCodePoint(A_CODE_POINT + index)}`,
          path: `/inst-${index}.instructions.md`,
          applyTo: "**/*.ts",
        })),
        Object.fromEntries(sizes.map((size, index) => [`/inst-${index}.instructions.md`, "x".repeat(size)]))
      )

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result.length).toBe(sizes.length)
    })

    it("returns all 50 instructions when given 50 inputs", async () => {
      const instructions: Array<{ description: string; path: string; applyTo: string }> = []
      const bodyMap: Record<string, string> = {}
      for (let index = 0; index < 50; index++) {
        instructions.push({ description: `inst-${index}`, path: `/inst-${index}.md`, applyTo: "**/*.ts" })
        bodyMap[`/inst-${index}.md`] = "x".repeat(10_000) // each one large
      }

      const helper = makeHelper(instructions, bodyMap)
      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result.length).toBe(50)
    })

    it("has no perCall parameter — resolveInstructions accepts only filePaths", async () => {
      const helper = makeHelper([
        { description: "a", path: "/a.instructions.md", applyTo: "**/*.ts" },
      ])

      // Should NOT accept a second argument for size constraints
      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result.length).toBe(1)
    })
  })

  // ════════════════════════════════════════════════════════════
  // Context estimation and capping (REMOVED — size filtering eliminated in Phase 2)
  // ════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════
  // Empty / edge cases
  // ════════════════════════════════════════════════════════════

  describe("empty and edge cases", () => {
    it("returns empty array when filePaths is empty", async () => {
      const helper = makeHelper([])

      const result = await helper.resolveInstructions([])

      expect(result).toEqual([])
    })

    it("returns empty array when no instructions match the files", async () => {
      const helper = makeHelper([])

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result).toEqual([])
    })
  })

  // ════════════════════════════════════════════════════════════
  // calcSpecificity edge patterns (tested via resolveInstructions ordering)
  // ════════════════════════════════════════════════════════════

  describe("calcSpecificity edge patterns", () => {
    it("glob pattern with only wildcards and empty segments has zero specificity — falls back to alphabetical tiebreak", async () => {
      const helper = makeHelper([
        { description: "zebra wildcard", path: "/a.wildcard.instructions.md", applyTo: "*" },
        { description: "alpha wildcard-slash", path: "/b.wildslash.instructions.md", applyTo: "*/" },
      ])

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      // Both patterns have specificity 0 → alphabetical tiebreak (ascending)
      expect(result.length).toBe(2)
      expect(result[0].description).toBe("alpha wildcard-slash")
      expect(result[1].description).toBe("zebra wildcard")
    })

    it("deeply nested literal path has highest specificity over glob patterns", async () => {
      const helper = makeHelper([
        { description: "global ts", path: "/a.global.instructions.md", applyTo: "**/*.ts" },
        { description: "src helper", path: "/b.src-helper.instructions.md", applyTo: "src/app/utils/helper.ts" },
        { description: "all ts", path: "/c.all-ts.instructions.md", applyTo: "src/**/*.ts" },
      ])

      const result = await helper.resolveInstructions(["src/app/utils/helper.ts"])

      // "src/app/utils/helper.ts" has 5 literal segments → highest specificity
      expect(result[0].description).toBe("src helper")
    })

    it("trailing slash creates empty segment contributing zero — equal to no trailing slash", async () => {
      const helper = makeHelper([
        { description: "zebra-a-b-slash", path: "/a.ab-slash.instructions.md", applyTo: "a/b/" },
        { description: "alpha-a-b", path: "/b.ab-noSlash.instructions.md", applyTo: "a/b" },
      ])

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      // Both have specificity 2 (two literal segments) → alphabetical tiebreak
      expect(result.length).toBe(2)
      expect(result[0].description).toBe("alpha-a-b")
      expect(result[1].description).toBe("zebra-a-b-slash")
    })
  })

  // NOTE: max-5 limit tests moved to plugin-level test file (instructions-loader.test.ts)
  // because session-aware budgeting is owned by the plugin factory, not the helper.

  // ════════════════════════════════════════════════════════════
  // Body loading on demand
  // ════════════════════════════════════════════════════════════

  describe("body loading on demand", () => {
    it("loads body content and populates the content field of each ResolvedInstruction", async () => {
      const helper = makeHelper(
        [
          { description: "instruction a", path: "/a.instructions.md", applyTo: "**/*.ts" },
          { description: "instruction b", path: "/b.instructions.md", applyTo: "**/*.js" },
        ],
        {
          "/a.instructions.md": "# This is instruction A\n\nSome detailed text.",
          "/b.instructions.md": "# This is instruction B\n\nMore details here.",
        }
      )

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result.length).toBe(2)
      expect(result[0].content).toBe("# This is instruction A\n\nSome detailed text.")
      expect(result[1].content).toBe("# This is instruction B\n\nMore details here.")
    })

    it("generates idempotencyKey as instruction_load:<path>", async () => {
      const helper = makeHelper(
        [
          { description: "test", path: "/workspace/.opencode/plugins/tests/fixtures/sample.instructions.md", applyTo: "**/*.ts" },
        ],
        {} // empty body map — content will be loaded from actual files
      )

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result[0].idempotencyKey).toBe(
        "instruction_load:/workspace/.opencode/plugins/tests/fixtures/sample.instructions.md"
      )
    })

    it("returns all instructions regardless of body size", async () => {
      const helper = makeHelper(
        [
          { description: "tiny", path: "/a.tiny.instructions.md", applyTo: "**/*.ts" },
          { description: "huge", path: "/b.huge.instructions.md", applyTo: "**/*.js" },
        ],
        {
          "/a.tiny.instructions.md": "x".repeat(50),
          "/b.huge.instructions.md": "y".repeat(5000),
        }
      )

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      // No size filtering — all inputs return N results regardless of content length
      expect(result.length).toBe(2)
      const byDesc = Object.fromEntries(result.map(r => [r.description, r])) as Record<string, ResolvedInstruction>
      expect(byDesc["tiny"].content).toBe("x".repeat(50))
      expect(byDesc["huge"].content).toBe("y".repeat(5000))
    })
  })
})
