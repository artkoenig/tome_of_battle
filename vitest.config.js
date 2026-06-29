import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/ui.test.js', 'node_modules/**', 'dist/**'],
  },
})
