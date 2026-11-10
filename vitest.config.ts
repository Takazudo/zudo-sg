import { configDefaults, defineConfig } from "vitest/config";
import { resolve } from "node:path";

const rootDir = import.meta.dirname;

export default defineConfig({
  // Vite 8 transforms JSX with OXC and ignores esbuild.jsxImportSource.
  oxc: {
    jsx: { runtime: "automatic", importSource: "@takazudo/zfb/zudo-react" },
  },
  resolve: {
    alias: {
      "@/": resolve(rootDir, "src") + "/",
      // zfb-only virtual module of @takazudo/zudo-sg/plugins/zdtp-apply-proxy —
      // plain Vite has no resolver for a "virtual:" specifier.
      "virtual:zudo-sg-preview-token-panel": resolve(
        rootDir,
        "packages/styleguide/src/token-tweak/__tests__/stubs/virtual-preview-token-panel.ts",
      ),
      // zudo-doc-only virtual modules, sole importer packages/styleguide/src/routes/_chrome.tsx —
      // same reason: plain Vite has no resolver for a "virtual:" specifier.
      "virtual:zudo-doc-route-context": resolve(
        rootDir,
        "packages/styleguide/src/routes/__tests__/stubs/virtual-doc-route-context.ts",
      ),
      "virtual:zudo-doc-chrome-bindings": resolve(
        rootDir,
        "packages/styleguide/src/routes/__tests__/stubs/virtual-doc-chrome-bindings.ts",
      ),
      "virtual:zudo-sg-registry": resolve(
        rootDir,
        "packages/styleguide/src/routes/__tests__/stubs/virtual-sg-registry.ts",
      ),
      "virtual:zudo-sg-tokens": resolve(
        rootDir,
        "packages/styleguide/src/routes/__tests__/stubs/virtual-sg-tokens.ts",
      ),
    },
  },
  test: {
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
      "scripts/__tests__/**/*.test.ts",
      "plugins/__tests__/**/*.test.ts",
      // @takazudo/zudo-sg engine package tests (also run by its own `test`).
      "packages/styleguide/src/**/__tests__/**/*.test.{ts,tsx}",
      // create-zudo-sg initializer tests (also run by its own `test`).
      "packages/create-zudo-sg/src/**/__tests__/**/*.test.ts",
      // @zudo-sg/demo-ui component DOM tests (happy-dom).
      "packages/demo-ui/src/**/__tests__/**/*.test.{ts,tsx}",
      // @zudo-sg/demo lib/config unit tests.
      "apps/demo/**/__tests__/**/*.test.{ts,tsx}",
    ],
    // Real `zfb build` / `zfb dev` proofs run via `pnpm test:slow` (vitest.slow.config.ts).
    exclude: [...configDefaults.exclude, "**/*.slow.test.ts"],
    // happy-dom provides the DOM for component suites. The non-DOM suites
    // (slug, generate, escape-for-mdx) run fine under it too.
    environment: "happy-dom",
    maxWorkers: 2,
    setupFiles: ["./vitest.setup.ts"],
  },
});
