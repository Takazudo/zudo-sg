/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Injected at `sgContext.routes.componentsIndex`. Placeholder — the catalog
// landing is filled in by #662.

import type { JSX } from "preact";
import { ctx } from "./_context.js";
import { registry } from "./_registry.js";

export const frontmatter = { title: "Components" };

export default function ComponentsIndexRoute(): JSX.Element {
  return (
    <main data-sg-route="components-index">
      <h1>{ctx.catalog.title}</h1>
      <p>{registry.storyEntries.length} components</p>
    </main>
  );
}
