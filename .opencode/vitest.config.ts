import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    conditions: ['node', 'development'],
    alias: {
      // TODO: remove this, no need to mock as I run tests with bun
      // 'bun:fs': path.resolve(__dirname, './plugins/tests/__mocks__/bun-fs.ts'),
      // bun: path.resolve(__dirname, './plugins/tests/__mocks__/bun.ts'),
    },
  },
  test: {
    mockReset: true,
    environment: 'node',
    globals: true,
  },
})
