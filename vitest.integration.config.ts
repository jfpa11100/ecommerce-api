import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.integration.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
})