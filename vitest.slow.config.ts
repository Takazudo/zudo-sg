import { defineConfig } from "vitest/config";

// Slow tier: real `zfb build` / `zfb dev` runs against a temp copy of the host
// (`pnpm test:slow`). Excluded from `pnpm test:unit` by vitest.config.ts.
export default defineConfig({
  test: {
    include: ["scripts/__tests__/**/*.slow.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
