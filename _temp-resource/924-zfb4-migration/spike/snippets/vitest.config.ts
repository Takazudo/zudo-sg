import { defineConfig } from "vitest/config";
export default defineConfig({ esbuild: { jsx: "automatic", jsxImportSource: "@takazudo/zfb/zudo-react" }, test: { environment: "happy-dom", include: ["tests/*.test.tsx"] } });
