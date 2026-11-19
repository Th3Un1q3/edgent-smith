/**
 * Modular configuration for the plugin infrastructure: each plugin's config is a
 * named section under `plugins`, keyed by plugin id. Add sections as plugins grow.
 *
 * Lives in a subdirectory so it is NOT auto-loaded as a plugin — only root
 * `.opencode/plugins/*.ts` files are plugins.
 */

import type { GateConfig } from '../types/quality-gate'
import type { LoopStateId } from '../state-machine/core/machine'
import type { ToolLimitConfig } from '../types/tool-limit'

// TODO: DEFERRED (owned by the config-literals follow-up ADR, additive only) hoist the settings literals in this file, from the `qualityGates` section through the `harnessConfig` object, into `as const` declarations; deferred because ADR-017 declares this file read-only and every plugin reads these sections, so the change only lands as an additive follow-up.
/**
 * Declared as a typed `GateConfig[]` (not an inline literal) so the `as const`
 * on `harnessConfig` does not widen it into a `readonly` tuple, which would not
 * satisfy `GateConfig.patterns: string[]`.
 */
const qualityGates: GateConfig[] = [
  {
    name: 'opencode-checks',
    patterns: ['.opencode/plugins/**/*.ts'],
    // 5-minute hard cap per command (typecheck, lint, coverage test) so a
    // hung/infinite-looping test can never freeze later `.opencode` edits.
    timeoutMs: 300_000,
    commands: ['cd /workspace/.opencode && just typecheck', 'cd /workspace/.opencode && just lint', 'cd /workspace/.opencode && just test --coverage --coverage.thresholds.branches 85 --coverage.thresholds.functions 85 --coverage.thresholds.lines 85 --coverage.thresholds.statements 85'],
  },
  {
    name: 'python-lint',
    patterns: ['cli/**/*.py', 'agents/**/*.py', 'evals/**/*.py', 'scripts/**/*.py'],
    commands: ['cd /workspace && just lint'],
  },
  {
    name: 'python-typecheck',
    patterns: ['cli/**/*.py', 'agents/**/*.py', 'evals/**/*.py'],
    commands: ['cd /workspace && just typecheck'],
  },
  {
    name: 'python-test',
    patterns: ['cli/**/*.py', 'agents/**/*.py', 'evals/**/*.py', 'scripts/**/*.py', 'tests/**/*.py'],
    commands: ['cd /workspace && just test'],
  },
  {
    name: 'justfile-fmt',
    patterns: ['justfile', '*/justfile'],
    commands: ['for f in $(find /workspace -name justfile -not -path \'*/node_modules/*\' -not -path \'*/.git/*\' -not -path \'*/.stryker-tmp/*\'); do cd "$(dirname "$f")" && just --unstable --fmt --check || exit 1; done'],
  },
]

/**
 * Declared as a typed `ToolLimitConfig` (not an inline literal) so the `as const`
 * on `harnessConfig` does not widen `ignoreTools`/`limits` into `readonly`,
 * which would not satisfy `ToolLimitConfig.ignoreTools: string[]`.
 */
const toolLimit: ToolLimitConfig = {
  factor: 0.8, // agent budget = floor(steps * factor)
  padding: 2, // PADDING_TILL_ERROR — extra calls for the in-flight current call
  limits: {}, // agent -> budget override; wins over floor(steps * factor)
  ignoreTools: ['signal_send'], // the loop's control tool is never counted (both counters)
  review: { export: true, command: 'just agent_utils/export-opencode-session', writeMarkdown: true },
}

/**
 * Declared as a typed literal so `as const` does not widen `agents` into a
 * `readonly` tuple. `agents` is the sole gate for workflow instruction
 * injection; tool exposure is diagnostic only.
 */
const workflowPlugin: { instructions: string, agents: string[] } = {
  instructions: '.agents/skills/task-delegation/SKILL.md',
  agents: ['rug'],
}

const stateMachine: { readonly startStates: Readonly<Record<string, LoopStateId>> } = {
  startStates: {
    'rug': 'define_goal',
    'rug-swe': 'define_goal',
    'rug-team-coach': 'define_goal',
  },
}

export const harnessConfig = {
  plugins: {
    'tool-limit-reminder': toolLimit,
    'quality-gate-enforcer': {
      gates: qualityGates,
    },
    'state-machine': stateMachine,
    'workflow': workflowPlugin,
  },
} as const
