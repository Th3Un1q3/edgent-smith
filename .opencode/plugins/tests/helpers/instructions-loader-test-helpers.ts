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
    const blocks = message.split("<instruction>")
    return blocks.slice(1).map(block => {
        const descMatch = block.match(/<description>(.*?)<\/description>/s)
        const desc = descMatch ? descMatch[1].trim() : ""
        // Full-content blocks have a <content> element; reference-only blocks have <meta/> instead
        const hasContent = block.includes("<content>")
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
