/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Injected at `sgContext.routes.componentsSlug`. Placeholder — the detail page
// is filled in by #662. zfb extracts `paths()` from this `.tsx` source by AST.

import type { JSX } from "preact";
import { registry } from "./_registry.js";

interface SlugProps {
  slug: string;
}

export function paths(): Array<{ params: { slug: string }; props: SlugProps }> {
  return registry.getAllSlugs().map((slug) => ({ params: { slug }, props: { slug } }));
}

export default function ComponentsSlugRoute(
  props: SlugProps & { params: { slug: string } },
): JSX.Element {
  const slug = props.slug ?? props.params.slug;
  const entry = registry.getStoryBySlug(slug);
  return (
    <main data-sg-route="components-slug">
      <h1>{entry?.meta.title ?? slug}</h1>
    </main>
  );
}
