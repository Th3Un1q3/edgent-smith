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

  // Reuse prior mutant results from the incremental file on warm runs. force must
  // stay false: force:true discards that cache on every invocation.
  force: false,

  // Skip static mutants (no per-test coverage shortcut, so each needs a full run).
  // Measured on identical code (Stryker 9.6.1): 274 of 3125 mutants (~9%) are static
  // yet consume ~57% of wall time; ignoring them cut a run from 451s to 193s while
  // 2851 mutants are still tested. Static mutants are excluded from the score by design.
  ignoreStatic: true,

  // Persist incremental results under reports/ (gitignored) so CI can cache the file.
  // Measured warm re-run: 17s with 3125/3125 results reused, identical score.
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',

  // Thresholds for mutation score reporting
  thresholds: {
    high: 80,
    low: 60,
    break: 72,
  },

  // Coverage analysis strategy (perTest is the default and best performance)
  coverageAnalysis: 'perTest',

  // Concurrency: saturate all logical CPUs with test runners. With static mutants
  // excluded (ignoreStatic) the run is dominated by test-execution wall time; raising
  // from '50%' to '100%' cuts that without touching mutant scope.
  // Stryker 9 removed `maxConcurrentTestRunners` — `concurrency` controls test runners.
  concurrency: '100%',

  // Ignore non-relevant directories from the sandbox copy
  ignorePatterns: [
    'node_modules',
    '.git',
    'coverage',
    'reports',
    'stryker-incremental.json',
  ],

  cleanTempDir: "always",

  // Disable type checking during mutation (Stryker inserts @ts-nocheck)
  disableTypeChecks: true,

  // reporters are optional; defaults ([clear-text, progress, html]) work well
  "clearTextReporter": {
    "allowColor": true,
    "allowEmojis": false,
    "logTests": true,
    "maxTestsToLog": 3,
    "reportMutants": true,
    "reportScoreTable": true,
    "skipFull": true
  }
};

export default config;
