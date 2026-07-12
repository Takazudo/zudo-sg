/**
 * Explicit MDX component map. zfb ignores `import` statements written inside
 * MDX content — every custom tag content uses must be registered here or
 * the build fails with a 500 on that page.
 *
 * Placeholder (Wave 5 #232 — shell only, no content yet): seeds the map with
 * zfb's built-in passthrough overrides so `pages/[...slug].tsx` has a real
 * map to import. #233 (the content sub) extends this with the ported prose
 * components (Card, table/dl overrides, etc.) and an `img: PlaceholderBox`
 * override for the ~100 content image references that have no backing
 * asset files.
 */
import { defaultComponents } from "@takazudo/zfb";
import type { MdxComponents } from "@takazudo/zfb";

export const mdxComponents: MdxComponents = {
  ...defaultComponents,
};
