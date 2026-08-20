import { SessionStorage, SESSION_FIELDS, type State } from './kv-store'
import { mkdir, writeFile } from 'node:fs/promises'

export const REVIEW_KEY = 'sessionReview'

export interface ProblemStatement {
  source: 'skill' | 'agent'
  thresholdName: string
  expectedMax: number
  actual: number
  message: string
}

export function skillProblemStatement(skillName: string, expectedMax: number, actual: number): ProblemStatement {
  return {
    source: 'skill',
    thresholdName: skillName,
    expectedMax,
    actual,
    message: `The session took ${actual} steps after skill '${skillName}' was loaded, exceeding the expected ${expectedMax} steps for the task. The skill may not have been effective — investigate.`,
  }
}

export function agentProblemStatement(agentName: string, expectedMax: number, actual: number): ProblemStatement {
  return {
    source: 'agent',
    thresholdName: agentName,
    expectedMax,
    actual,
    message: `The session took ${actual} tool calls for agent '${agentName}', exceeding the agent's budget of ${expectedMax} steps. Investigate why the agent exceeded its step budget.`,
  }
}

export function readProblems(storage: SessionStorage, sessionID: string): ProblemStatement[] {
  const problems = storage.readState<State, unknown>(sessionID, state => state[REVIEW_KEY])
  return Array.isArray(problems) ? (problems as ProblemStatement[]) : []
}

export function addProblem(storage: SessionStorage, sessionID: string, problem: ProblemStatement): ProblemStatement[] {
  const existing = readProblems(storage, sessionID)
  const identity = (p: ProblemStatement) => `${p.source}:${p.thresholdName}`
  if (existing.some(p => identity(p) === identity(problem))) {
    return existing
  }
  storage.updateState<State, State>(sessionID, state => ({ ...state, [REVIEW_KEY]: [...existing, problem] }))
  return [...existing, problem]
}

export function clearReviewState(storage: SessionStorage, sessionID: string): void {
  storage.updateState(sessionID, (state) => {
    const rest = { ...state }
    delete rest[REVIEW_KEY]
    delete rest[SESSION_FIELDS.needsReview]
    return rest
  })
}

export function renderProblemsMarkdown(problems: ProblemStatement[]): string {
  if (problems.length === 0) {
    return '# Reported Threshold Violations\n\n*None reported.*\n'
  }
  const sections = problems.map(p => `## ${p.source}: ${p.thresholdName}\n<!-- problem-id: ${p.source}:${p.thresholdName} -->\n${p.message}`)
  return `# Reported Threshold Violations\n\n${sections.join('\n\n')}\n`
}

export async function writeProblemsMarkdown(sessionID: string, problems: ProblemStatement[]): Promise<void> {
  const directory = `/workspace/.tmp/session-review/${sessionID}`
  await mkdir(directory, { recursive: true })
  await writeFile(`${directory}/problems.md`, renderProblemsMarkdown(problems))
}
