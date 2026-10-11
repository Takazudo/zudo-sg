import { defineConfig } from "vitest/config";

// Slow tier: real `zfb build` / `zfb dev` runs against a temp copy of the host
// (`pnpm test:slow`). Excluded from `pnpm test:unit` by vitest.config.ts.
export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "@takazudo/zfb/zudo-react" },
  test: {
    include: ["scripts/__tests__/**/*.slow.test.ts"],
    environment: "node",
    maxWorkers: 2,
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
