import { defineConfig } from "@takazudo/zfb/config";

/**
 * apps/styleguide — a standalone Preact styleguide site for @zudo-sg/ui.
 *
 * - `framework: "preact"` — pages are Preact components.
 * - `base: "/"` — deployed at its own subdomain.
 * - `tailwind: { enabled: true }` — wires @tailwindcss/vite into the build.
 * - `bundle.mainFields` — resolves CommonJS-first packages (e.g. gray-matter)
 *   by checking "main" before "module" in their package.json.
 *
 * `plugins: []` — dev-save plugin slot; wired in a later sub-issue.
 */
export default defineConfig({
  framework: "preact",
  tailwind: { enabled: true },
  base: "/",
  bundle: { mainFields: ["main", "module"] },
  plugins: [],
});
