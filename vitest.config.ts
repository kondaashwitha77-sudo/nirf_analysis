import { defineConfig } from 'vitest/config'

// Live mode, so answers carry no demo-data wording. No browser and no AI are involved.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], env: { VITE_USE_MOCK: 'false' } },
})
