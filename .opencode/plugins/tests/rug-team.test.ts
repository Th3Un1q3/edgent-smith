vi.mock("@opencode-ai/plugin", () => ({
  Plugin: {} as Record<string, unknown>,
}));

import { rugTeamPlugin } from "@plugins/rug-team";
import type { PluginInput } from "@opencode-ai/plugin";

// ── Type Definitions ───────────────────────────────────────────────────────

type PartItem = { type: string; text?: string; imageUrl?: string; data?: unknown };
type ClientMock = { session: { command: ReturnType<typeof vi.fn> } };
type Handler = (input: Record<string, unknown>, output: Record<string, unknown>) => Promise<unknown>;

function makePluginInput(clientObject: Record<string, unknown>, directory = "/tmp/test"): PluginInput {
    return ({ client: clientObject, directory }) as unknown as PluginInput;
}

function makeDependencies() {
    const commandCalls: Array<Record<string, unknown>> = [];
     
    const mockCommand = vi.fn(async (_payload: unknown) => {
        void _payload;
        // captured via closure above
    });
     
    const mockSession = { command: mockCommand };
    const mockClient = { session: mockSession } as ClientMock;
    return { commandCalls, mockCommand, mockClient };
}

function makeOutput(parts: Array<PartItem> = []): Record<string, unknown> {
    return { parts };
}

// ── Test A: Returns "chat.message" handler ───────────────────────────────

describe("rugTeamPlugin", () => {
    describe("Factory Registration", () => {
        it("Test A: returns an object with 'chat.message' async function key", async () => {
            const { mockClient } = makeDependencies();
            const plugin = await rugTeamPlugin(makePluginInput(mockClient));

            expect(Object.keys(plugin)).toEqual(["chat.message"]);
            expect(typeof plugin["chat.message"]).toBe("function");
        });

        // Test B: State isolation per invocation
        it("Test B: state is isolated between separate plugin instances", async () => {
            const mockCommandA = vi.fn(async (_p: unknown) => {});

            const mockClientA = { session: { command: mockCommandA } };

            const mockCommandB = vi.fn(async (_p: unknown) => {});

            const mockClientB = { session: { command: mockCommandB } };

            const pluginA = await rugTeamPlugin(makePluginInput(mockClientA));
            const pluginB = await rugTeamPlugin(makePluginInput(mockClientB));

            // Fire handler on A for sess-A
            await (pluginA["chat.message"] as Handler)(
                { agent: "rug", sessionID: "sess-B" },
                makeOutput([{ type: "text", text: "X" }]),
            );

            // Fire handler on B for same sessionID 'sess-B'
            await (pluginB["chat.message"] as Handler)(
                { agent: "rug", sessionID: "sess-B" },
                makeOutput([{ type: "text", text: "Y" }]),
            );

            // Both should have fired once — idempotency is per-instance
            expect(mockCommandA).toHaveBeenCalledTimes(1);
            expect(mockCommandB).toHaveBeenCalledTimes(1);
        });
    });

    // ── Agent Filtering ──────────────────────────────────────────────────

    describe("handler", () => {
        describe("Agent Filtering", () => {
            it("Test C: ignores non-'rug' agents ('user')", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                await (plugin["chat.message"] as Handler)(
                    { agent: "user" as const, sessionID: "sess-xyz" },
                    makeOutput([{ type: "text", text: "hello" }]),
                );

                expect(mockCommand).not.toHaveBeenCalled();
            });

            it("Test D: ignores non-'rug' agents ('copilot')", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                await (plugin["chat.message"] as Handler)(
                    { agent: "copilot" as const, sessionID: "sess-xyz" },
                    makeOutput([{ type: "text", text: "hello" }]),
                );

                expect(mockCommand).not.toHaveBeenCalled();
            });
        });

        // ── Text Extraction & Dispatch ─────────────────────────────────────

        describe("Text Extraction & Dispatch", () => {
            it("Test E: processes 'rug' agent messages correctly (text extraction + dispatch)", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-new" },
                    makeOutput([
                        { type: "text", text: "Line 1" },
                        { type: "image", imageUrl: "http://..." },
                        { type: "text", text: "Line 2" },
                    ]),
                );

                expect(mockCommand).toHaveBeenCalledTimes(1);
                const call = mockCommand.mock.calls[0][0] as { body: unknown; path: unknown };
                expect((call.path as { id: string }).id).toBe("sess-new");
                expect((call.body as { command: string; arguments: string; agent: string }).command).toBe(
                    "rug-brief",
                );
                expect((call.body as { arguments: string }).arguments).toBe("Line 1\nLine 2");
                expect((call.body as { agent: string }).agent).toBe("rug");
            });

            it("Test F: text extraction edge case — single text part (no trailing newline)", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-single" },
                    makeOutput([{ type: "text", text: "single line" }]),
                );

                const call = mockCommand.mock.calls[0][0] as { body: { arguments: string } };
                expect((call.body as { arguments: string }).arguments).toBe("single line");
            });

            it(String.raw`Test G: multiple text parts joined by \n`, async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-multi" },
                    makeOutput([
                        { type: "text", text: "A" },
                        { type: "text", text: "B" },
                        { type: "text", text: "C" },
                    ]),
                );

                const call = mockCommand.mock.calls[0][0] as { body: { arguments: string } };
                expect((call.body as { arguments: string }).arguments).toBe("A\nB\nC");
            });

            it("Test H: no text parts → empty string", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-none" },
                    makeOutput([
                        { type: "image", imageUrl: "x" },
                        { type: "json", data: {} },
                    ]),
                );

                const call = mockCommand.mock.calls[0][0] as { body: { arguments: string } };
                expect((call.body as { arguments: string }).arguments).toBe("");
            });

            it("Test I: missing parts property → no crash", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                expect(() => {
                    void (plugin["chat.message"] as Handler)(
                        { agent: "rug", sessionID: "sess-no-parts" },
                        ({} as unknown) as Record<string, unknown>,
                    );
                }).not.toThrow();

                expect(mockCommand).toHaveBeenCalledTimes(1);
                const call = mockCommand.mock.calls[0][0] as { body: { arguments: string } };
                expect((call.body as { arguments: string }).arguments).toBe("");
            });
        });

        // ── Idempotency & Session Tracking ─────────────────────────────────

        describe("Idempotency & Session Tracking", () => {
            it("Test J: same sessionID does not trigger second dispatch (idempotent)", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                // First call — should fire
                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-dirty" },
                    makeOutput([{ type: "text", text: "first" }]),
                );
                expect(mockCommand).toHaveBeenCalledTimes(1);

                // Second call — same sessionID, should be ignored
                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-dirty" },
                    makeOutput([{ type: "text", text: "second" }]),
                );
                expect(mockCommand).toHaveBeenCalledTimes(1); // still 1, not 2
            });

            it("Test K: different sessions are tracked independently", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                // First call for sess-dirty
                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-dirty" },
                    makeOutput([{ type: "text", text: "dirty-text" }]),
                );

                // Second call for DIFFERENT session sess-fresh — should fire
                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-fresh" },
                    makeOutput([{ type: "text", text: "fresh-text" }]),
                );

                expect(mockCommand).toHaveBeenCalledTimes(2);
                const secondCall = mockCommand.mock.calls[1][0] as { body: { arguments: string } };
                expect((secondCall.body as { arguments: string }).arguments).toBe("fresh-text");
            });
        });

        // ── Payload Structure ──────────────────────────────────────────────

        describe("Payload Structure", () => {
            it("Test L: full payload structure verified with exact call signature", async () => {
                const { mockCommand } = makeDependencies();
                const plugin = await rugTeamPlugin(makePluginInput({ session: { command: mockCommand } }));

                await (plugin["chat.message"] as Handler)(
                    { agent: "rug", sessionID: "sess-payload" },
                    makeOutput([
                        { type: "text", text: "hello" },
                        { type: "text", text: "world" },
                    ]),
                );

                expect(mockCommand).toHaveBeenCalledWith({
                    body: { command: "rug-brief", arguments: "hello\nworld", agent: "rug" },
                    path: { id: "sess-payload" },
                });
            });
        });
    });
});
