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
 */

export const harnessConfig = {
  plugins: {
    'skill-usage-tracker': {
      thresholds: {
        // Read relevant references + read relevant file, update relevant file, run test, fix test, update implementation, run test.
        'test-design': 8,
        // read 3 recepis, find mcp + create sandbox + read something + write an update ideally 4 steps. + 1 step for correction.
        'context-gathering': 8,
      },
    },
    'tool-limit-reminder': {
      factor: 0.8, // agent budget = floor(steps * factor)
      padding: 2, // PADDING_TILL_ERROR — extra calls for the in-flight current call
    },
    // Future plugin sections:
    // 'quality-gate-enforcer': { ... },   // gates from .opencode/quality-gates.json
    // 'todo-enforcer': { ... },
  },
} as const
