import { OpencodeClient } from "@opencode-ai/sdk"
import { log } from "./logger.ts"


type SendMessageImplementation = (args: {
  client: OpencodeClient,
  sessionId: string,
  message: string,
  noReply?: boolean, // when set to true, the message is sent withut triggering agent reply
}) => Promise<void>


const sendMessage: SendMessageImplementation = async ({
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
  const session = await client.session.get({ path: { id: sessionId } }) // TODO: implement as context resolver
  if (!session) { log(client, "warn", `Session ${sessionId} not found for injection.`); return }
  const agent = (session.data as { agent?: string })?.agent || "build"
  await client.session.prompt({ path: { id: sessionId }, body: { agent, noReply, parts: [{ type: "text", text: message }] } })
}

export {
  sendMessage,
  SendMessageImplementation,
}