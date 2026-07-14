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
 * - `collections` — the single `content` collection (see content/), schema
 *   validated at runtime by lib/site-tree.ts (zfb accepts but does not
 *   enforce a collection's `schema` today — v1.1 reserved).
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
  // zfb does not copy project public/ assets into dist/ itself. Keep the
  // local dummy-image catalog available at its resolver URLs after a build.
  plugins: [
    {
      name: "../../plugins/copy-public-plugin.mjs",
      options: {
        publicDir: "public",
      },
    },
  ],
  stripMdExt: true,
  trailingSlash: false,
});
