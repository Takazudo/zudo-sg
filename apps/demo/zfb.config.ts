import { z } from "zod";
import { defineConfig } from "@takazudo/zfb/config";
import { buildContentSchema } from "./lib/content-schema";

const contentSchema = buildContentSchema();
const contentSchemaJson = z.toJSONSchema(contentSchema) as Record<string, unknown>;

/**
 * apps/demo — a static Preact demo site for zudo-sg.
 *
 * - `framework: "preact"` — pages are Preact components.
 * - `base: "/"` — deployed at its own subdomain.
 * - `tailwind: { enabled: true }` — wires @tailwindcss/vite into the
 *   build so `@import "tailwindcss"` + `@theme` blocks are processed.
 * - `collections` — the single `content` collection (see content/), whose
 *   JSON schema `zfb check` validates. The site-tree and search boundaries
 *   parse with the same Zod schema as an additional typed build-time guard.
 * - `stripMdExt` / `trailingSlash: false` — content authors write
 *   `[label](other.md)`-style links; hrefs resolve to the rendered route
 *   (`/other`) without a trailing slash.
 *
 * No SSR adapter: this is a fully static site (prerender = true for all
 * pages). Only add @takazudo/zfb-adapter-cloudflare if API routes with
 * prerender = false are added later.
 *
 * No dev-apply plugin, panel-mount island, or password gate — those belong
 * to the reference implementation's design-review tooling and are
 * explicitly out of scope for this public demo (see the epic notes).
 */
export default defineConfig({
  framework: "preact",
  base: "/",
  tailwind: { enabled: true },
  collections: [
    {
      name: "content",
      path: "content",
      schema: contentSchemaJson,
    },
  ],
  // zfb natively copies its default `public/` directory. Keep root-relative
  // dummy-image URLs unchanged rather than rebasing them under `base`.
  copyPublicWithBase: false,
  stripMdExt: true,
  trailingSlash: false,
});
