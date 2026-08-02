/**
 * Shared helper for fetching agent step/tool-call limits from the OpenCode API.
 *
 * Extracted from skills-loader.ts (buildTaskBudgetTag) and tool-limit-reminder.ts
 * to unify agent info detection across both plugins.
 */

export interface AgentInfo {
  name: string
  steps?: number
}

/**
 * Fetches the agent list from the API.
 * Returns an empty array if the call fails or data is missing.
 */
export async function fetchAgentList(client: { app: { agents: () => unknown } }): Promise<AgentInfo[]> {
  try {
    const raw = await client.app.agents() as { data?: AgentInfo[] }
    return raw.data ?? []
  }
  catch {
    return []
  }
}

/**
 * Returns the step count for a named agent, or undefined if not found / no steps.
 */
export async function getAgentSteps(client: { app: { agents: () => unknown } }, agentName: string): Promise<number | undefined> {
  const agents = await fetchAgentList(client)
  const agent = agents.find(a => a.name === agentName)
  if (!agent || typeof agent.steps !== 'number') return undefined
  return agent.steps
}

/**
 * Resolves the current agent name for a given session.
 * Falls back to "build" when no agent is specified.
 */
export async function getSessionAgent(
  client: { session: { get: (parameters: { path: { id: string } }) => Promise<unknown> } },
  sessionID: string,
): Promise<string> {
  const result = await client.session.get({ path: { id: sessionID } }) as { data?: Record<string, unknown> }
  const agent = result?.data?.agent
  return typeof agent === 'string' && agent.length > 0 ? agent : 'build'
}
