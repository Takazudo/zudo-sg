/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Injected at `sgContext.routes.componentsSlug` — the component detail page.
// zfb extracts `paths()` from this `.tsx` source by AST (one route per story).
//
// One DetailWorkbench island owns the page toolbar (theme / viewport / layout
// / code panel / preview tokens) and one isolated preview iframe per variant;
// the CodePanel island sits in the right region. Both receive the same
// base-prefixed preview URL (VariantFrame builds iframe `src` from it; the
// code panel's CSS injection selects iframes by it). The optional co-located
// component MDX doc renders as a trailing section.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { getEntry } from "@takazudo/zfb/content";
import { makeAdmonition } from "@takazudo/zudo-doc/content-admonition";
import { StyleguideLayout } from "../chrome/index.js";
import { CodePanel, type CodePanelVariant } from "../code-panel/index.js";
import { DetailWorkbench } from "../preview/index.js";
import { resolveComponentDoc } from "../registry/index.js";
import { componentHref } from "../sg-routes.js";
import { chromeProps } from "./_chrome.js";
import { ctx, withBase } from "./_context.js";
import { registry } from "./_registry.js";

export const frontmatter = { title: "Component" };

interface SlugProps {
  slug: string;
}

/** Admonition tags emitted by `:::note` directives / github alerts inside component docs. */
const componentDocMdxComponents = {
  Note: makeAdmonition("note"),
  Tip: makeAdmonition("tip"),
  Info: makeAdmonition("info"),
  Warning: makeAdmonition("warning"),
  Danger: makeAdmonition("danger"),
  Caution: makeAdmonition("caution"),
  Important: makeAdmonition("important"),
};

export function paths(): Array<{ params: { slug: string }; props: SlugProps }> {
  return registry.getAllSlugs().map((slug) => ({ params: { slug }, props: { slug } }));
}

export default function ComponentsSlugRoute(props: SlugProps & { params: { slug: string } }): JSX.Element {
  const slug = props.slug ?? props.params.slug;
  const entry = registry.getStoryBySlug(slug);
  const previewUrl = withBase(ctx.routes.componentsPreview);
  const chrome = chromeProps({
    pageTitle: entry ? entry.meta.title : "Not found",
    path: componentHref(ctx.routes, slug),
    activeSlug: slug,
  });

  if (!entry) {
    return (
      <StyleguideLayout {...chrome} activeSlug={slug} codePanel={null}>
        <p class="text-muted">Story not found: {slug}</p>
      </StyleguideLayout>
    );
  }

  const panelVariants: CodePanelVariant[] = entry.variants.map((v) => ({
    exportName: v.exportName,
    name: v.name,
    source: v.story.source ?? entry.meta.usage,
  }));
  const codePanelIsland = Island({
    when: "load",
    children: <CodePanel storyTitle={entry.meta.title} variants={panelVariants} previewUrl={previewUrl} />,
  }) as unknown as VNode;
  const codePanel = (
    <aside id="sg-code-panel" class="sg-code-panel" aria-label="Code panel">
      <div
        class="sg-code-panel-resizer"
        data-sg-code-panel-resizer
        role="separator"
        aria-label="Resize code panel"
        aria-orientation="vertical"
        tabindex={0}
      />
      {codePanelIsland}
    </aside>
  ) as unknown as VNode;

  // The collection of the components root this story's registry key belongs to
  // (`./<keyPrefix>/<dir>/<name>.stories.tsx` → `<dir>/<name>`).
  const docRef = resolveComponentDoc(entry.path, ctx.componentDocs);
  const doc = docRef ? getEntry(docRef.collection, docRef.slug) : undefined;

  // `when: "load"`: the toolbar is the page's primary control surface; each
  // iframe is `loading="lazy"`, so below-the-fold previews still defer.
  const workbench = Island({
    when: "load",
    children: (
      <DetailWorkbench
        slug={slug}
        previewUrl={previewUrl}
        variants={entry.variants.map((v) => ({
          exportName: v.exportName,
          name: v.name,
          controls: v.story.controls,
        }))}
      />
    ),
  }) as unknown as VNode;

  return (
    <StyleguideLayout {...chrome} activeSlug={slug} codePanel={codePanel} contentWide>
      <div>
        <header class="mb-vsp-lg max-w-[56rem]">
          <h1 class="text-2xl font-bold text-fg">{entry.meta.title}</h1>
          <p class="mt-vsp-xs text-muted">{entry.meta.description}</p>
          <span class="mt-vsp-xs inline-block rounded-full border border-border px-hsp-sm py-vsp-3xs text-caption leading-normal text-muted">
            {entry.meta.category}
          </span>
        </header>

        {entry.meta.previewRoute && (
          <section class="mb-vsp-xl max-w-[56rem] rounded-md border border-border bg-surface-2 p-hsp-md">
            <h2 class="mb-vsp-2xs text-small font-semibold uppercase tracking-wide text-muted">Live demo</h2>
            <a
              href={withBase(entry.meta.previewRoute)}
              class="text-sm font-medium text-accent underline underline-offset-2"
            >
              Open live demo →
            </a>
          </section>
        )}

        {workbench}

        {doc && (
          <section class="mt-vsp-xl border-t border-border pt-vsp-xl">
            <div class="zd-content max-w-[56rem]">
              <doc.Content components={componentDocMdxComponents} />
            </div>
          </section>
        )}
      </div>
    </StyleguideLayout>
  );
}
