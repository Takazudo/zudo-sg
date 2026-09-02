/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Component catalog landing — `/components`.
//
// A visual contact sheet: every tile carries its component RENDERED INLINE,
// server-side, into the static HTML (#540). No preview iframes — see
// src/features/styleguide/catalog/component-thumb.tsx for why 72 of them would
// each have parsed the whole story set — so the catalogue costs nothing at
// runtime and still shows components with JavaScript disabled.
//
// Data flow:
//   getCategoryGroups()  [from src/styleguide/data/registry]
//   → category-grouped tiles (SSR, no-JS, with data-sg-* attributes)
//   → CatalogFilter island (filters by toggling `hidden` on tiles; also owns
//     the tile-size segmented control)
//   → StyleguideLayout (the section shell: docs header/footer/sidebar reused,
//     sidebar fed the styleguide nav tree). The Overview leaf (slug "") is the
//     active highlight on this landing route.
//
// Layout: the band opts into zudo-doc's WIDE content layout (`contentWide` →
// `data-zd-wide`), which the tile grid uses in full. Prose keeps its own
// reading measure — a wide band must not mean 1150px-wide paragraphs.
//
// The docs chrome defaults (`HeaderWithDefaults` / `FooterWithDefaults` /
// `HeadWithDefaults` / `BodyEndIslands`) live under `pages/lib/*` (the
// tsc-excluded page tree that owns the `zfb/content` virtuals). This page —
// itself under `pages/` — composes them and passes them into the `src`-side
// `StyleguideLayout` shell as props, so the shell never imports `pages/*`.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { getCategoryGroups, OVERVIEW_SLUG } from "@/styleguide/data/registry";
import { StyleguideLayout } from "@/features/styleguide/chrome/_styleguide-layout";
import { ComponentThumb } from "@/features/styleguide/catalog/component-thumb";
import { TILE_SIZE_RESTORE_SCRIPT } from "@/features/styleguide/catalog/tile-size";
import CatalogFilter from "@/features/styleguide/search/catalog-filter";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { buildStyleguideChrome } from "../lib/_styleguide-chrome";

export const frontmatter = { title: "Components" };

export default function ComponentsIndexPage(): JSX.Element {
  const locale = defaultLocale;
  const groups = getCategoryGroups();
  const total = groups.reduce((n, g) => n + g.stories.length, 0);
  const currentPath = withBase("/components");

  // Category list in display order (for the CatalogFilter chip row).
  const categories = groups.map((g) => g.category);

  const filterIsland = Island({
    when: "load",
    children: <CatalogFilter categories={categories} total={total} />,
  }) as unknown as VNode;

  const { head, ...chrome } = buildStyleguideChrome({
    lang: locale,
    pageTitle: "Components",
    currentPath,
    activeSlug: OVERVIEW_SLUG,
  });

  // Restore the persisted tile size before first paint, so a reader who chose
  // Large does not watch the whole grid re-flow when the island mounts. This
  // is composed here rather than in StyleguideLayout because it is specific to
  // this one route (mirrors PanelStateHeadScript, which is layout-wide).
  const composedHead = (
    <>
      {head}
      <script dangerouslySetInnerHTML={{ __html: TILE_SIZE_RESTORE_SCRIPT }} />
    </>
  );

  return (
    <StyleguideLayout
      title={composeMetaTitle("Components")}
      activeSlug={OVERVIEW_SLUG}
      lang={locale}
      contentWide
      head={composedHead}
      {...chrome}
    >
      <header class="mb-vsp-lg max-w-[56rem]">
        <h1 class="text-heading font-bold mb-vsp-2xs">Component catalog</h1>
        <p class="text-muted text-small" data-sg-catalog-intro>
          {total} components from <code>@zudo-sg/ui</code>, discovered from
          their <code>.stories.tsx</code> files. Each tile previews the
          component's first variant, rendered here on the server.
        </p>
      </header>

      {filterIsland}

      <div data-sg-catalog>
        {groups.map((group) => (
          <section
            class="sg-gallery-section"
            data-sg-section
            data-category={group.category}
          >
            <h2 class="mb-vsp-sm text-heading font-semibold">
              {group.category}
            </h2>
            <div class="sg-grid">
              {group.stories.map((story) => (
                <div class="sg-tile" data-sg-tile>
                  <ComponentThumb entry={story} />
                  <a
                    href={withBase(`/components/${story.slug}`)}
                    class="sg-tile-meta"
                    data-sg-card
                    data-name={story.meta.title.toLowerCase()}
                    data-category={group.category}
                    data-keywords={[
                      story.meta.title,
                      story.meta.description ?? "",
                      story.meta.category ?? "",
                    ]
                      .join(" ")
                      .toLowerCase()}
                  >
                    <h3 class="sg-tile-title">{story.meta.title}</h3>
                    <p class="sg-tile-desc">{story.meta.description}</p>
                    <p class="sg-tile-count">
                      {story.variants.length} variant
                      {story.variants.length === 1 ? "" : "s"}
                    </p>
                  </a>
                </div>
              ))}
            </div>
          </section>
        ))}
        <p class="text-muted text-small" data-sg-empty hidden>
          No components match your search.
        </p>
      </div>
    </StyleguideLayout>
  );
}
