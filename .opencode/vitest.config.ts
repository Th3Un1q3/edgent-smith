import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      'bun:fs': path.resolve(__dirname, './tests/__mocks__/bun-fs.ts'),
      bun: path.resolve(__dirname, './tests/__mocks__/bun.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
