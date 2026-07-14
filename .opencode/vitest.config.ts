import { defineConfig } from 'vitest/config'


export default defineConfig({
  resolve: {
    conditions: ['node', 'development'],
    alias: {},
  },
  test: {
    mockReset: true,
    environment: 'node',
    globals: true,
  },
})
