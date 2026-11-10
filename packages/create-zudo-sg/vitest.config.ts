import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic", importSource: "@takazudo/zfb/zudo-react" },
  },
  test: {
    exclude: ["**/node_modules/**"],
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    maxWorkers: 2,
  },
});
