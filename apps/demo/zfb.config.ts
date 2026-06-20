import { defineConfig } from "@takazudo/zfb/config";

/**
 * apps/demo — a static Preact demo site for zudo-sg.
 *
 * - `framework: "preact"` — pages are Preact components.
 * - `base: "/"` — deployed at its own subdomain.
 * - `tailwind: { enabled: true }` — wires @tailwindcss/vite into the
 *   build so `@import "tailwindcss"` + `@theme` blocks are processed.
 *
 * No SSR adapter: this is a fully static site (prerender = true for all
 * pages). Only add @takazudo/zfb-adapter-cloudflare if API routes with
 * prerender = false are added later.
 */
export default defineConfig({
  framework: "preact",
  base: "/",
  tailwind: { enabled: true },
});
