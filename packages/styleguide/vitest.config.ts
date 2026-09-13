import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Package-scoped config: `pnpm --filter @takazudo/zudo-sg test`. The root
// vitest config also includes `packages/styleguide/src/**/__tests__/**`, so
// `pnpm test:unit` covers these suites too. No `@/` alias here on purpose —
// package code must not depend on the host alias (scripts/check-no-host-alias.mjs).
export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      // zfb-only virtual module; the root vitest.config.ts carries the same alias.
      "virtual:zudo-sg-preview-token-panel": resolve(
        import.meta.dirname,
        "src/token-tweak/__tests__/stubs/virtual-preview-token-panel.ts",
      ),
    },
  },
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "preact",
    },
  },
  test: {
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
