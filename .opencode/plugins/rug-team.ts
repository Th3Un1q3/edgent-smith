import { Plugin } from "@opencode-ai/plugin";

const rugTeamPlugin: Plugin = async ({ client }) => {
    const dirtySessions: Record<string, boolean> = {}

    return {
        "chat.message": async ({ agent, sessionID }, _output): Promise<void> => {
            if (agent !== "rug") return
            if (Object.hasOwn(dirtySessions, sessionID)) return

            const parts = _output.parts || []

            dirtySessions[sessionID] = true
            // await client.session.command({
            //     body: {
            //         command: "rug-brief",
            //         arguments: parts.filter(part => part.type === "text").map(part => part.text).join("\n"),
            //         agent
            //     },
            //     path: {
            //         id: sessionID,
            //     },
            // })

        },
    }
}

export {
    rugTeamPlugin,
}