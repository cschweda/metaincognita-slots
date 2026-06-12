import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    testTimeout: 180_000
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app')
    }
  }
})
