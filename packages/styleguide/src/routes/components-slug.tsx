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
//
// Descriptor-mode entries carry no story source, so they get no CodePanel
// island, no component doc and no live-demo link — only the header and the
// workbench, built from the mode-neutral `CatalogEntry` fields.

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
  // `externalPreviewUrl` (issue #884) replaces the in-engine preview route
  // when the host serves its own preview document — same-shape `previewUrl`
  // either way, so DetailWorkbench and the code panel need no branching.
  const previewUrl = withBase(ctx.externalPreviewUrl ?? ctx.routes.componentsPreview);
  const chrome = chromeProps({
    pageTitle: entry ? entry.title : "Not found",
    path: componentHref(ctx.routes, slug),
    activeSlug: slug,
  });

  if (!entry) {
    return (
      <StyleguideLayout {...chrome} activeSlug={slug} codePanel={null}>
        <p class="text-[color:var(--sg-muted)]">Story not found: {slug}</p>
      </StyleguideLayout>
    );
  }

  const storyEntry = entry.source === "module" ? entry.storyEntry : undefined;

  let codePanel: VNode | null = null;
  if (storyEntry) {
    const panelVariants: CodePanelVariant[] = storyEntry.variants.map((v) => ({
      exportName: v.exportName,
      name: v.name,
      source: v.story.source ?? storyEntry.meta.usage,
    }));
    const codePanelIsland = Island({
      when: "load",
      children: (
        <CodePanel
          storyTitle={entry.title}
          variants={panelVariants}
          previewUrl={previewUrl}
          slug={slug}
        />
      ),
    }) as unknown as VNode;
    codePanel = (
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
  }

  // The collection of the components root this story's registry key belongs to
  // (`./<keyPrefix>/<dir>/<name>.stories.tsx` → `<dir>/<name>`).
  const docRef = storyEntry ? resolveComponentDoc(storyEntry.path, ctx.componentDocs) : null;
  const doc = docRef ? getEntry(docRef.collection, docRef.slug) : undefined;
  const previewRoute = storyEntry?.meta.previewRoute;

  // `when: "load"`: the toolbar is the page's primary control surface; each
  // iframe is `loading="lazy"`, so below-the-fold previews still defer.
  //
  // The engine's own detail route opts the two toolbar groups that default OFF
  // (#883, issue #872) back in explicitly, matching what this route actually
  // mounts: `codePanel` only when `storyEntry` exists — module mode, where the
  // CodePanel island above is mounted (descriptor-mode entries get none, S2b) —
  // and `tokenPanel` following `ctx.previewTokenPanel`, so the button is absent
  // rather than dead when no `zdtpApplyProxy.tabsModule` is wired.
  // `selection`/`theme` are passed at their pre-#883 defaults, unconditionally,
  // to keep this route's behavior spelled out rather than implicit.
  const workbench = Island({
    when: "load",
    children: (
      <DetailWorkbench
        slug={slug}
        previewUrl={previewUrl}
        variants={entry.variants.map((v) => ({
          exportName: v.exportName,
          name: v.name,
          controls: v.controls,
        }))}
        selection={{ mode: "all" }}
        theme={{ mode: "toolbar" }}
        toolbar={{ codePanel: Boolean(storyEntry), tokenPanel: ctx.previewTokenPanel }}
      />
    ),
  }) as unknown as VNode;

  return (
    <StyleguideLayout {...chrome} activeSlug={slug} codePanel={codePanel} contentWide>
      <div>
        <header class="mb-vsp-lg max-w-[56rem]">
          <h1 class="text-2xl font-bold text-[color:var(--sg-fg)]">{entry.title}</h1>
          <p class="mt-vsp-xs text-[color:var(--sg-muted)]">{entry.description}</p>
          <span class="mt-vsp-xs inline-block rounded-full border border-[color:var(--sg-border)] px-hsp-sm py-vsp-3xs text-caption leading-normal text-[color:var(--sg-muted)]">
            {entry.category}
          </span>
        </header>

        {previewRoute && (
          <section class="mb-vsp-xl max-w-[56rem] rounded-md border border-[color:var(--sg-border)] bg-[var(--sg-surface-2)] p-hsp-md">
            <h2 class="mb-vsp-2xs text-small font-semibold uppercase tracking-wide text-[color:var(--sg-muted)]">Live demo</h2>
            <a
              href={withBase(previewRoute)}
              class="text-sm font-medium text-[color:var(--sg-accent)] underline underline-offset-2"
            >
              Open live demo →
            </a>
          </section>
        )}

        {workbench}

        {doc && (
          <section class="mt-vsp-xl border-t border-[color:var(--sg-border)] pt-vsp-xl">
            <div class="zd-content max-w-[56rem]">
              <doc.Content components={componentDocMdxComponents} />
            </div>
          </section>
        )}
      </div>
    </StyleguideLayout>
  );
}
