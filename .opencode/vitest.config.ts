import { defineConfig } from 'vitest/config'


export default defineConfig({
  resolve: {
    conditions: ['node', 'development'],
    alias: {
      "@tests": "/workspace/.opencode/plugins/tests",
      "@plugins": "/workspace/.opencode/plugins",
    },
  },
  test: {
    mockReset: true,
    environment: 'node',
    globals: true,
  },
})
