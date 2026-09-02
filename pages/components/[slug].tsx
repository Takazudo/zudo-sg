/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Component detail — `/components/<slug>`.
//
// Enumerates one route per discovered story (paths() → getAllSlugs()), and
// hands that story's variants to a single DetailWorkbench island: one
// page-level toolbar (theme / viewport / layout / code-panel / preview tokens)
// plus one isolated preview iframe stage per variant. The toolbar owns that
// state and passes it down as props — see the header of
// `src/features/styleguide/preview/detail-workbench.tsx` for why it is one
// island and not a toolbar broadcasting to independent stages (#541).
//
// Width (#541): the page opts into the DocLayout WIDE band so the preview
// column gets the room the whole route exists to provide. The band is shared
// with prose, so the title/description and the trailing component-docs MDX
// section keep their own ~56rem reading measure — only the workbench spans the
// full band.
//
// Chrome composition (mirrors pages/components/index.tsx): the docs chrome
// defaults (`HeaderWithDefaults` / `FooterWithDefaults` / `HeadWithDefaults` /
// `BodyEndIslands`) live under `pages/lib/*` — the tsc-EXCLUDED page tree that
// owns the `zfb/content` virtuals. A static `src → pages` import would drag
// those excluded files into the `pnpm check` program and fail. So this page
// (itself under `pages/`, free to import `pages/lib/*`) composes the slots and
// passes them into the `src/`-side `StyleguideLayout` shell as props.
//
// Code panel (#49): the right-region CodeMirror code panel is wired here via
// the `codePanel` prop of StyleguideLayout. It flows into the DocLayout
// `tocOverride` slot and flips `hideToc` to false. The panel is composed as
// `<aside id="sg-code-panel">…</aside>` and the CodePanel island is loaded
// inside it. It is the page's single source display — the content column used
// to repeat the same string in a USAGE `<pre>` that overflowed its own box.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { getEntry } from "zfb/content";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { getAllSlugs, getStoryBySlug } from "@/styleguide/data/registry";
import {
  COMPONENT_DOCS_COLLECTION,
  componentDocSlug,
} from "@/styleguide/data/component-docs";
import { componentDocMdxComponents } from "@/components/content/component-doc-mdx-components";
import { StyleguideLayout } from "@/features/styleguide/chrome/_styleguide-layout";
import DetailWorkbench from "@/features/styleguide/preview/detail-workbench";
import CodePanel from "@/features/styleguide/code-panel/code-panel";
import type { CodePanelVariant } from "@/features/styleguide/code-panel/code-panel";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { buildStyleguideChrome } from "../lib/_styleguide-chrome";

export const frontmatter = { title: "Component" };

interface SlugProps {
  slug: string;
}

export function paths(): Array<{ params: { slug: string }; props: SlugProps }> {
  return getAllSlugs().map((slug) => ({ params: { slug }, props: { slug } }));
}

export default function StoryDetailPage(
  props: SlugProps & { params: { slug: string } },
): JSX.Element {
  const slug = props.slug ?? props.params.slug;
  const locale = defaultLocale;
  const entry = getStoryBySlug(slug);
  const currentPath = withBase(`/components/${slug}`);

  // Chrome slots — composed here (in the page tree) and passed into the shell.
  // HeadWithDefaults runs its `title` through composeMetaTitle internally
  // (→ "<title> | <siteName>"), so pass the RAW page title here — that yields
  // an og:title ("Button | Zudo Sg") matching the `<title>` element. The
  // shell's `title` prop below is the pre-composed `<title>` value.
  const pageTitle = entry ? entry.meta.title : "Not found";
  const chrome = buildStyleguideChrome({
    lang: locale,
    pageTitle,
    currentPath,
    activeSlug: slug,
  });

  // >>> #49 SEAM: compose the code panel for the StyleguideLayout `codePanel`
  // slot (which the shell flows into the DocLayout `tocOverride` region).
  // The panel is only relevant when we have a valid story entry; "not found"
  // pages fall through with codePanel=null (content fills full width).
  let codePanel: VNode | null = null;
  if (entry) {
    // Build the variant list for the CodePanel. Each variant uses
    // Story.source if provided, falling back to meta.usage so there is
    // always something to show in the source viewer.
    const panelVariants: CodePanelVariant[] = entry.variants.map((v) => ({
      exportName: v.exportName,
      name: v.name,
      source: v.story.source ?? entry.meta.usage,
    }));

    const codePanelIsland = Island({
      when: "load",
      children: (
        <CodePanel
          storyTitle={entry.meta.title}
          variants={panelVariants}
        />
      ),
    }) as unknown as VNode;

    codePanel = (
      <aside
        id="sg-code-panel"
        class="sg-code-panel"
        aria-label="Code panel"
      >
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

  if (!entry) {
    return (
      <StyleguideLayout
        title={composeMetaTitle("Not found")}
        activeSlug={slug}
        lang={locale}
        {...chrome}
        codePanel={codePanel}
      >
        <p class="text-muted">Story not found: {slug}</p>
      </StyleguideLayout>
    );
  }

  // Per-component docs (#119): render the OPTIONAL co-located MDX doc
  // (`packages/ui/src/<name>/<name>.mdx`) as a trailing section. `getEntry`
  // returns undefined when the component ships no doc file, so a component
  // without docs renders no extra section (acceptance criterion).
  const docSlug = componentDocSlug(entry.path);
  const doc = docSlug ? getEntry(COMPONENT_DOCS_COLLECTION, docSlug) : undefined;

  // `when: "load"` — the toolbar is the page's primary control surface and
  // owns every stage's theme/viewport, so it must never wait on a viewport
  // intersection. The stages themselves stay cheap: each iframe is
  // `loading="lazy"`, so below-the-fold previews still defer their network.
  const workbench = Island({
    when: "load",
    children: (
      <DetailWorkbench
        slug={slug}
        variants={entry.variants.map((v) => ({
          exportName: v.exportName,
          name: v.name,
          controls: v.story.controls,
        }))}
      />
    ),
  }) as unknown as VNode;

  return (
    <StyleguideLayout
      title={composeMetaTitle(entry.meta.title)}
      activeSlug={slug}
      lang={locale}
      {...chrome}
      codePanel={codePanel}
      contentWide
    >
      {/* One wrapper keeps `.zd-content`'s flow spacing out of the page's own
          vertical rhythm; the blocks below own their spacing explicitly. */}
      <div>
        <header class="mb-vsp-lg max-w-[56rem]">
          <h1 class="text-2xl font-bold text-fg">{entry.meta.title}</h1>
          <p class="mt-vsp-xs text-muted">{entry.meta.description}</p>
          <span class="mt-vsp-xs inline-block rounded-full border border-border px-hsp-sm py-vsp-3xs text-caption leading-normal text-muted">
            {entry.meta.category}
          </span>
        </header>

        {entry.meta.previewRoute && (
          // Sanctioned `previewRoute` pattern (STORIES.md §6): a link out to a
          // REAL page route, not one of the variant preview iframes below —
          // kept visually distinct (its own bordered callout, not a frame).
          <section class="mb-vsp-xl max-w-[56rem] rounded-md border border-border bg-surface-2 p-hsp-md">
            <h2 class="mb-vsp-2xs text-small font-semibold uppercase tracking-wide text-muted">
              Live demo
            </h2>
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
            {/* `.zd-content` supplies the shared prose typography (headings,
                lists, code blocks) via zudo-doc's content.css; the components
                map adds the admonition tags. Prose keeps its reading measure
                even though the band is wide. */}
            <div class="zd-content max-w-[56rem]">
              <doc.Content components={componentDocMdxComponents} />
            </div>
          </section>
        )}
      </div>
    </StyleguideLayout>
  );
}
