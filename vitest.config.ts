import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["src/shared/__tests__/breakpoint-tokens.test.ts"],
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
