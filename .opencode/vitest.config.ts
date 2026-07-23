import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Use process.cwd() so aliases resolve correctly in both normal dev
// and Stryker's sandbox (where the working dir is the sandbox root).
function p(mod: string) {
  return resolve(process.cwd(), mod)
}

export default defineConfig({
  resolve: {
    conditions: ['node', 'development'],
    alias: {
      "@tests": p('plugins/tests'),
      "@plugins": p('plugins'),
    },
  },
  coverage: {
    provider: 'istanbul',
    include: ['plugins/**/*.ts'],
    exclude: [
      'plugins/tests/**/*',
      '**/*.d.ts',
      'node_modules/**/*',
    ],
  },
  test: {
    setupFiles: ['./plugins/tests/vitest-bun-polyfill.setup.ts'],
    mockReset: true,
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/.stryker-tmp/**'],
  },
})
