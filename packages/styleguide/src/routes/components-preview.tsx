/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Injected at `sgContext.routes.componentsPreview`. Placeholder — the preview
// document (and its `_preview-app.tsx` island) is filled in by #662.

import type { JSX } from "preact";
import { ctx, withBase } from "./_context.js";

export const frontmatter = { title: "Preview" };

export default function ComponentsPreviewRoute(): JSX.Element {
  return (
    <main data-sg-route="components-preview">
      <link rel="stylesheet" href={withBase(ctx.previewCssUrl)} />
    </main>
  );
}
