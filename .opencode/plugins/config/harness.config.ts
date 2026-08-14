/**
 * Modular, extensible configuration for the entire plugin infrastructure.
 *
 * Designed eslint-style: each plugin's config is a named section under `plugins`,
 * keyed by plugin id. Add new plugin sections as they grow (quality gates, etc.).
 *
 * Referenced by plugins via:
 *   import { harnessConfig } from './config/harness.config'
 *
 * File location: .opencode/plugins/config/harness.config.ts
 * (in a subdirectory so it is NOT auto-loaded as a plugin — only root *.ts are plugins;
 * helpers/ and types/ subdirs already prove this.)
 *
 * Test reference: .opencode/plugins/tests/skill-usage-tracker.test.ts L262
 * Test reference: .opencode/plugins/tests/helpers/gate-config.test.ts
 */

import type { GateConfig } from '../types/quality-gate'

/**
 * Declared as a typed `GateConfig[]` (not an inline literal) so the `as const`
 * on `harnessConfig` does not widen it into a `readonly` tuple, which would not
 * satisfy `GateConfig.patterns: string[]`.
 */
const qualityGates: GateConfig[] = [
  {
    name: 'opencode-typecheck',
    patterns: ['.opencode/plugins/**/*.ts'],
    commands: ['cd /workspace/.opencode && just typecheck'],
  },
  {
    name: 'opencode-lint',
    patterns: ['.opencode/plugins/**/*.ts'],
    commands: ['cd /workspace/.opencode && just lint'],
  },
  {
    name: 'opencode-test',
    patterns: ['.opencode/plugins/**/*.ts'],
    commands: ['cd /workspace/.opencode && just test --coverage --coverage.thresholds.branches 85 --coverage.thresholds.functions 85 --coverage.thresholds.lines 85 --coverage.thresholds.statements 85'],
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
    patterns: ['justfile', '**/justfile'],
    commands: ['for f in $(find /workspace -name justfile -not -path \'*/node_modules/*\' -not -path \'*/.git/*\' -not -path \'*/.stryker-tmp/*\'); do cd "$(dirname "$f")" && just --unstable --fmt --check || exit 1; done'],
  },
]

export const harnessConfig = {
  plugins: {
    'skill-usage-tracker': {
      thresholds: {
        // Read relevant references + read relevant file, update relevant file, run test, fix test, update implementation, run test.
        'test-design': 8,
        // read 3 recepis, find mcp + create sandbox + read something + write an update ideally 4 steps. + 1 step for correction.
        'context-gathering': 12,
      },
    },
    'tool-limit-reminder': {
      factor: 0.8, // agent budget = floor(steps * factor)
      padding: 2, // PADDING_TILL_ERROR — extra calls for the in-flight current call
    },
    'quality-gate-enforcer': {
      gates: qualityGates,
      debounceMs: 300,
    },
    'todo-enforcer': {
      maxConsecutiveErrors: 3,
    },
  },
} as const
