/** Shape of a single instruction entry returned by the indexer. */
export type InstructionEntry = { path: string; description: string; applyTo: string }

/** Build mock instructions with the correct shape for a single file. */
export function makeInstructions(path: string, description: string): Array<InstructionEntry> {
    return [{ path, description, applyTo: "**/*.{ts}" }]
}

/** Build 6 instructions for session-aware budget tests. */
export function getFiveInstructions(): Array<InstructionEntry> {
    const result: Array<InstructionEntry> = [
        { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
        { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
        { path: "/c.ts", description: "Inst C", applyTo: "**/*.{ts}" },
        { path: "/d.ts", description: "Inst D", applyTo: "**/*.{ts}" },
        { path: "/e.ts", description: "Inst E", applyTo: "**/*.{ts}" },
        { path: "/f.ts", description: "Inst F", applyTo: "**/*.{ts}" },
    ]
    return result
}

/** Helper to read the message and extract which instructions were injected with content. */
export function getInjectedDescriptions(message: string): Array<{ desc: string; hasContent: boolean }> {
    const blocks = message.split("=== INSTRUCTION:")
    return blocks.slice(1).map(block => {
        const descLine = block.split("\n", 1)[0]
        const desc = descLine.replace(/ ===/, "")
        // Check if there's content after the --- separator (reference-only has empty body)
        const afterDesc = block.slice(Math.max(0, descLine.length + 1))
        const afterSeparator = afterDesc.indexOf("---")
        const bodyAfterSeparator = afterSeparator === -1 ? "" : afterDesc.slice(Math.max(0, afterSeparator + 3))
        // Content is non-empty only if there's actual text on lines that aren't metadata or the closing divider
        const hasContent = bodyAfterSeparator.split("\n").some(line => line.trim().length > 0 && !line.startsWith("Source") && !line.startsWith("===") && !line.startsWith("---"))
        return { desc, hasContent }
    })
}

interface FakeIndex {
    forFiles: () => Promise<Array<InstructionEntry>>
    loadBody: (path: string) => Promise<string>
}

export function createFakeIndex(forFilesResult: Array<InstructionEntry>, loadBodyImpl?: (path: string) => Promise<string>): FakeIndex {
    return {
        forFiles: async () => forFilesResult,
        loadBody: loadBodyImpl ?? (async (path: string) => `Content of ${path}`),
    } as unknown as FakeIndex
}
