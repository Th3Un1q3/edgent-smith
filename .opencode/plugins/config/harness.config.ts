/**
 * Modular configuration for the plugin infrastructure: each plugin's config is a
 * named section under `plugins`, keyed by plugin id. Add sections as plugins grow.
 *
 * Lives in a subdirectory so it is NOT auto-loaded as a plugin — only root
 * `.opencode/plugins/*.ts` files are plugins.
 */

import type { GateConfig } from '../types/quality-gate'
import type { GoalEnforcementConfig } from '../types/goal-enforcement'
import type { ToolLimitConfig } from '../types/tool-limit'

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

// Goal-first enforcement gate (ADR-008): enabled for the agents listed below;
// the code default in `../types/goal-enforcement` enforces nothing.
const goalEnforcement: GoalEnforcementConfig = {
  enforceAll: false,
  agents: ['rug', 'rug-workflow'],
  optOut: [],
  readOnlyAllowlist: ['question', 'read', 'glob', 'grep', 'skill'],
  maxSteeringRepeats: 3,
}

/**
 * Declared as a typed `ToolLimitConfig` (not an inline literal) so the `as const`
 * on `harnessConfig` does not widen `ignoreTools`/`limits` into `readonly`,
 * which would not satisfy `ToolLimitConfig.ignoreTools: string[]`.
 */
const toolLimit: ToolLimitConfig = {
  factor: 0.8, // agent budget = floor(steps * factor)
  padding: 2, // PADDING_TILL_ERROR — extra calls for the in-flight current call
  limits: {}, // agent -> budget override; wins over floor(steps * factor)
  ignoreTools: ['goal'], // never counted (both counters)
  review: { export: true, command: 'just agent_utils/export-opencode-session', writeMarkdown: true },
}

export const harnessConfig = {
  plugins: {
    'tool-limit-reminder': toolLimit,
    'quality-gate-enforcer': {
      gates: qualityGates,
      debounceMs: 1500,
    },
    'goal-continuation': goalEnforcement,
  },
} as const
