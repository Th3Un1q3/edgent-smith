// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  // Use the Vitest runner plugin for mutation testing
  testRunner: 'vitest',

  // Which source files to mutate (production code only, not tests or types)
  mutate: [
    'plugins/*.ts',
    'plugins/helpers/**/*.ts',
    '!**/__mocks__/**',
    '!**/tests/**',
    '!bun-shim.d.ts',          // declaration shim — no executable logic
    '!types/instructions.ts',  // type-only interfaces (no branches to mutate)
  ],

  // No pre-build needed — Vitest handles TS on-the-fly via its transformer
  buildCommand: '',

  // Reference the local vitest config so aliases and settings are respected in the sandbox
  vitest: {
    configFile: 'vitest.config.ts',
    related: false,
  },

  // Explicitly include all plugin tests; disabling `related` mode above means Stryker won't
  // auto-discover them via import analysis (which fails with @plugins absolute aliases).
  testFiles: ['plugins/tests/**/*.test.ts'],

  // Run all mutants regardless of incremental state on each invocation
  force: true,

  // Thresholds for mutation score reporting
  thresholds: {
    high: 80,
    low: 60,
    break: 72,
  },

  // Coverage analysis strategy (perTest is the default and best performance)
  coverageAnalysis: 'perTest',

  // Concurrency: use n-1 workers for parallel mutation testing
  concurrency: '50%',

  // Ignore non-relevant directories from the sandbox copy
  ignorePatterns: [
    'node_modules',
    '.git',
    'coverage',
    'reports',
    'stryker-incremental.json',
  ],

  // Disable type checking during mutation (Stryker inserts @ts-nocheck)
  disableTypeChecks: true,

  // reporters are optional; defaults ([clear-text, progress, html]) work well
};

export default config;
