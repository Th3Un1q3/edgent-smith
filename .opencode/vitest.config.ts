import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve aliases, setup files and the cache against this config's directory,
// never the caller's cwd. An ad-hoc `vitest` run from the repo root used to
// point them at /workspace/plugins and write a stray /workspace/node_modules.
const configDir = fileURLToPath(new URL('.', import.meta.url))

function p(mod: string) {
  return resolve(configDir, mod)
}

export default defineConfig({
  root: configDir,
  cacheDir: resolve(configDir, 'node_modules/.vite'),
  resolve: {
    conditions: ['node', 'development'],
    alias: {
      "@tests": p('plugins/tests'),
      "@plugins": p('plugins'),
      // Stryker runs under Node (node_modules/.bin/stryker has a node shebang), where the
      // "bun" module does not exist. Route it to a faithful shim so tests load under Node.
      "bun": p('plugins/tests/__mocks__/bun.ts'),
    },
  },
  test: {
    setupFiles: [resolve(configDir, 'plugins/tests/vitest-bun-polyfill.setup.ts')],
    mockReset: true,
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/.stryker-tmp/**'],
    // Bound pathological tests so they fail fast instead of spinning. A test
    // that blocks the event loop is still caught by the gate-level `timeout`.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    teardownTimeout: 30_000,
    coverage: {
      provider: 'istanbul',
      include: ['plugins/**/*.ts'],
      exclude: [
        'plugins/tests/**/*',
        '**/*.d.ts',
        'node_modules/**/*',
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
})
