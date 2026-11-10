import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 transforms JSX with OXC and ignores esbuild.jsxImportSource.
  oxc: {
    jsx: { runtime: "automatic", importSource: "@takazudo/zfb/zudo-react" },
  },
  test: {
    environment: "happy-dom",
    maxWorkers: 2,
  },
});
