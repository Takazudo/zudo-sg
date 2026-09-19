import { configDefaults, defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // Root `tsconfig.json` sets `"jsx": "preserve"` — required by zfb's own
  // build pipeline (it re-parses each file's `@jsxImportSource` pragma
  // comment itself), but this Vite version's default transformer (oxc/
  // rolldown, not esbuild — see the "Both esbuild and oxc options were set"
  // warning this replaced) takes tsconfig's `jsx` value literally and leaves
  // "preserve" JSX untranspiled, which then fails import-analysis.
  // `packages/demo-ui` and `apps/demo` dodge this because THEIR nearest
  // tsconfig.json already sets `jsx: "react-jsx"` / `jsxImportSource:
  // "preact"` (Vite resolves the nearest tsconfig per file). Root
  // `src/**/*.tsx` test files (#247) have no such override, so this explicit
  // oxc option does for them what a per-directory tsconfig override does for
  // the two workspace packages — safe monorepo-wide since every `.tsx` file
  // here targets Preact.
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "preact",
    },
  },
  resolve: {
    alias: {
      "@/": resolve(__dirname, "src") + "/",
      // zfb-only virtual module of @takazudo/zudo-sg/plugins/zdtp-apply-proxy —
      // plain Vite has no resolver for a "virtual:" specifier.
      "virtual:zudo-sg-preview-token-panel": resolve(
        __dirname,
        "packages/styleguide/src/token-tweak/__tests__/stubs/virtual-preview-token-panel.ts",
      ),
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
      "src/**/__tests__/**/*.test.tsx",
      "scripts/__tests__/**/*.test.ts",
      "plugins/__tests__/**/*.test.ts",
      // @takazudo/zudo-sg engine package tests (also run by its own `test`).
      "packages/styleguide/src/**/__tests__/**/*.test.{ts,tsx}",
      // create-zudo-sg initializer tests (also run by its own `test`).
      "packages/create-zudo-sg/src/**/__tests__/**/*.test.ts",
      // @zudo-sg/demo-ui component DOM tests (Testing Library + happy-dom).
      "packages/demo-ui/src/**/__tests__/**/*.test.{ts,tsx}",
      // @zudo-sg/demo lib/config unit tests.
      "apps/demo/**/__tests__/**/*.test.{ts,tsx}",
    ],
    // Real `zfb build` / `zfb dev` proofs run via `pnpm test:slow` (vitest.slow.config.ts).
    exclude: [...configDefaults.exclude, "**/*.slow.test.ts"],
    // happy-dom provides the DOM for @testing-library/preact. The non-DOM
    // suites (slug, generate, escape-for-mdx) run fine under it too.
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
