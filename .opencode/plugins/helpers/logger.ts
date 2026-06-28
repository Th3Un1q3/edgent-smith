/**
 * Unified logger wrapping client.app.log with consistent formatting.
 * All log messages are prefixed with the plugin ID for traceability across modules.
 */

import { OpencodeClient } from "@opencode-ai/sdk"

const PLUGIN_ID = "harness-plugin"

export async function log(
  client: OpencodeClient,
  level: "debug" | "info" | "warn" | "error",
  message: string,
): Promise<void> {
  await client.app.log({
    body: {
      service: PLUGIN_ID,
      level,
      message: `[${PLUGIN_ID}] ${message}`,
    },
  })
}
