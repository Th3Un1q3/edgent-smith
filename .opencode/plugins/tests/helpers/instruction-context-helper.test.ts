import { describe, expect, it } from "vitest"

// Import the module-under-test (stub provides interfaces; throws on call in TDD red phase)
import { InstructionContextHelper } from "../../helpers/instruction-context-helper"

// ── Helpers ──────────────────────────────────────────────────────────────

import { makeMockIndexer, createIndexerFactory } from "./mock-utilities"

/** Build a helper instance with a mock indexer and optional config. */
function makeHelper(
  metas: Array<{ description: string; path: string; applyTo: string }>,
  bodyMap?: Record<string, string>,
  options?: { maxChars?: number; blockOverheadChars?: number },
) {
  return new InstructionContextHelper({
    indexerFactory: createIndexerFactory(makeMockIndexer(metas, bodyMap)),
    ...options,
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
  // Context estimation and capping
  // ════════════════════════════════════════════════════════════

  describe("context estimation and capping", () => {
    it("caps output when total chars exceed maxChars budget (body chars + blockOverhead per instruction)", async () => {
      const helper = makeHelper(
        [
          { description: "a small", path: "/a.small.instructions.md", applyTo: "**/*.ts" },
          { description: "b large", path: "/b.large.instructions.md", applyTo: "**/*.js" },
        ],
        { "/a.small.instructions.md": "x".repeat(180), "/b.large.instructions.md": "y".repeat(350) },
        { maxChars: 500, blockOverheadChars: 200 }
      )

      // a.small: 180 + 200 = 380 (fits)
      // b.large: 350 + 200 = 550 → total would be 930 > 500 → dropped
      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result.length).toBe(1)
      expect(result[0].description).toBe("a small")
    })

    it("includes all instructions when none exceed maxChars budget", async () => {
      const helper = makeHelper(
        [
          { description: "instruction a", path: "/a.instructions.md", applyTo: "**/*.ts" },
          { description: "instruction b", path: "/b.instructions.md", applyTo: "**/*.js" },
        ],
        { "/a.instructions.md": "short body A", "/b.instructions.md": "short body B" },
        { maxChars: 8192 } // generous budget
      )

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result.length).toBe(2)
    })

    it("drops lowest priority instructions first until remaining fit within budget", async () => {
      const helper = makeHelper(
        [
          { description: "specific", path: "/a.specific.instructions.md", applyTo: "src/**/*.ts" },
          { description: "general", path: "/b.general.instructions.md", applyTo: "**/*.ts" },
          { description: "global", path: "/c.global.instructions.md", applyTo: "**/*.{ts,js}" },
        ],
        {
          "/a.specific.instructions.md": "x".repeat(50),
          "/b.general.instructions.md": "y".repeat(200),
          "/c.global.instructions.md": "z".repeat(300),
        },
        { maxChars: 400 } // enough for specific only (50+200=250)
      )

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      // Only the most specific fits; next two would exceed budget cumulatively
      expect(result.length).toBe(1)
      expect(result[0].description).toBe("specific")
    })

    it("respects runtime override of maxChars via resolveInstructions options", async () => {
      const helper = makeHelper(
        [
          { description: "a", path: "/a.instructions.md", applyTo: "**/*.ts" },
          { description: "b", path: "/b.instructions.md", applyTo: "**/*.js" },
        ],
        { "/a.instructions.md": "x".repeat(100), "/b.instructions.md": "y".repeat(100) },
        { maxChars: 8192 } // high default — overridden below
      )

      // Override at call site: only allow 300 chars → first fits (100+200=300)
      const result = await helper.resolveInstructions(["src/dir/file.ts"], { maxChars: 300 })

      expect(result.length).toBe(1)
      expect(result[0].description).toBe("a")
      expect(result[0].content).toBe("x".repeat(100))
    })
  })

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

    it("returns empty array when maxChars is zero", async () => {
      const helper = makeHelper(
        [{ description: "a tiny instruction", path: "/a.instructions.md", applyTo: "**/*.ts" }],
        { "/a.instructions.md": "hi" },
        { maxChars: 0 }
      )

      // Even highest-priority instruction has body + overhead > 0 → nothing fits
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
        },
        { maxChars: 16_384 } // generous budget — all instructions included
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

    it("loads body content only for instructions that fit within budget", async () => {
      const helper = makeHelper(
        [
          { description: "tiny", path: "/a.tiny.instructions.md", applyTo: "**/*.ts" },
          { description: "huge", path: "/b.huge.instructions.md", applyTo: "**/*.js" },
        ],
        {
          "/a.tiny.instructions.md": "x".repeat(50),
          "/b.huge.instructions.md": "y".repeat(5000),
        },
        { maxChars: 500 } // only tiny (50+200=250) fits; huge would be 5000+200=5200 → exceeds
      )

      const result = await helper.resolveInstructions(["src/dir/file.ts"])

      expect(result.length).toBe(1)
      expect(result[0].description).toBe("tiny")
      expect(result[0].content).toBe("x".repeat(50))
    })
  })
})
