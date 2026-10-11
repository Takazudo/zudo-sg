import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "@takazudo/zfb/zudo-react" },
  test: {
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["src/shared/__tests__/breakpoint-tokens.test.ts"],
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    maxWorkers: 2,
  },
});
