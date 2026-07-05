import { readState, updateState } from "./kv-store.ts"
import { OpencodeClient } from "@opencode-ai/sdk"
import { log } from "./logger.ts"

export const sendMessage = async ({
  client,
  sessionId,
  message,
  noReply = false,
}: {
  client: OpencodeClient,
  sessionId: string,
  message: string,
  noReply?: boolean, // when set to true, the message is sent withut triggering agent reply
}) => {
  if (!client.session) { log(client, "warn", `Client session not available for sending message to session ${sessionId}.`); return }
  const session = await client.session.get({ path: { id: sessionId } })
  if (!session) { log(client, "warn", `Session ${sessionId} not found for injection.`); return }
  const agent = (session.data as any)?.agent || "build"
  await client.session.prompt({ path: { id: sessionId }, body: { agent, noReply, parts: [{ type: "text", text: message }] } })
}