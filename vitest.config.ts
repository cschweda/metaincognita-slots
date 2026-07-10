import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    testTimeout: 180_000,
    coverage: {
      provider: 'v8',
      // Ratchet, not target: ~2 points under the 2026-07-09 baseline
      // (S 88.5 / B 79.9 / F 90.6 / L 91.9) so a change that silently
      // drops a tested area fails CI. Raise these as coverage grows.
      thresholds: {
        statements: 86,
        branches: 77,
        functions: 88,
        lines: 89
      }
    }
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app')
    }
  }
})
