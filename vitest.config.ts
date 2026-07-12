import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@/": resolve(__dirname, "src") + "/",
      // zfb-only virtual module (see vitest-stubs/zdtp-apply-config.ts) —
      // plain Vite has no resolver for a "virtual:" specifier.
      "virtual:zdtp-apply-config": resolve(__dirname, "vitest-stubs/zdtp-apply-config.ts"),
      // React → Preact compat aliases (mirrors production zfb/vite build).
      // Most-specific keys first so `react/jsx-runtime` is not swallowed by `react`.
      "react/jsx-runtime": "preact/jsx-runtime",
      "react/jsx-dev-runtime": "preact/jsx-runtime",
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
      react: "preact/compat",
    },
  },
  test: {
    include: [
      "src/**/__tests__/**/*.test.ts",
      "scripts/__tests__/**/*.test.ts",
      "plugins/__tests__/**/*.test.ts",
      // @zudo-sg/ui component DOM tests (Testing Library + happy-dom).
      "packages/ui/src/**/__tests__/**/*.test.{ts,tsx}",
      // @zudo-sg/demo lib/config unit tests.
      "apps/demo/**/__tests__/**/*.test.{ts,tsx}",
    ],
    // happy-dom provides the DOM for @testing-library/preact. The non-DOM
    // suites (slug, generate, escape-for-mdx) run fine under it too.
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
