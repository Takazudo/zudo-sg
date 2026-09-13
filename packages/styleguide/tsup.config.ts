import { defineConfig } from "tsup";

// Mirrors @takazudo/zudo-doc's build (ADR decision 2):
//   - bundle:false compiles every source file 1:1 (`src/<path>.ts(x)` →
//     `dist/<path>.js`). zfb's island scanner keys off each file's top-level
//     "use client" directive, which bundling would strip from inner modules.
//   - Declarations come from a separate `tsc -p tsconfig.build.json` pass
//     (see the `build` script); tsup's rollup DTS bundler is combinatorial in
//     memory with many bundle:false entries.
//   - Relative imports in `src/` carry a `.js` extension so the emitted files
//     also load under plain Node ESM (zfb's plugin host loads dist/plugins/*.js).
//
// APPEND CONVENTION: new `.ts`/`.tsx` files under `src/**` are picked up by
// the globs below automatically — only `package.json#exports` needs a new
// entry. Non-glob sources (copied assets, generated files) go in `onSuccess`.
export default defineConfig((options) => ({
  entry: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "!src/**/__tests__/**",
    "!src/**/*.test.ts",
    "!src/**/*.test.tsx",
    // Ambient declarations (e.g. virtual-module types) have no runtime output.
    "!src/**/*.d.ts",
  ],
  format: "esm",
  bundle: false,
  dts: false,
  sourcemap: false,
  // Never clean under --watch: tsup cannot regenerate the tsc-owned .d.ts it
  // would wipe (zudolab/zudo-doc#3113).
  clean: !options.watch,
  // Regenerate the Tailwind safelist from the freshly compiled dist/*.js
  // after every build (one-shot and each --watch recompile). Must run AFTER
  // tsup, not before: a one-shot build's `clean` wipes dist/ first, and the
  // generator only scans compiled JS (#661; model: @takazudo/zudo-doc).
  onSuccess: "node scripts/gen-safelist.mjs",
}));
