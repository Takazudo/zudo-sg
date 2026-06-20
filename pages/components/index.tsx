/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Component catalog landing — `/components`.
//
// Lists all discovered components grouped by category. Each card links to the
// component's detail page at `/components/<slug>`. The CatalogFilter island
// provides live search + category filtering on top of the SSR markup.
//
// Data flow:
//   getCategoryGroups()  [from src/styleguide/data/registry]
//   → category-grouped cards (SSR, no-JS, with data-sg-* attributes)
//   → CatalogFilter island (filters by toggling `hidden` on cards)
//   → StyleguideLayout (the section shell: docs header/footer/sidebar reused,
//     sidebar fed the styleguide nav tree). The Overview leaf (slug "") is the
//     active highlight on this landing route.
//
// The docs chrome defaults (`HeaderWithDefaults` / `FooterWithDefaults` /
// `HeadWithDefaults` / `BodyEndIslands`) live under `pages/lib/*` (the
// tsc-excluded page tree that owns the `zfb/content` virtuals). This page —
// itself under `pages/` — composes them and passes them into the `src/`-side
// `StyleguideLayout` shell as props, so the shell never imports `pages/*`.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { getCategoryGroups, OVERVIEW_SLUG } from "@/styleguide/data/registry";
import { StyleguideLayout } from "@/features/styleguide/chrome/_styleguide-layout";
import CatalogFilter from "@/features/styleguide/search/catalog-filter";
import { FooterWithDefaults } from "../lib/_footer-with-defaults";
import { HeaderWithDefaults } from "../lib/_header-with-defaults";
import { HeadWithDefaults } from "../lib/_head-with-defaults";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { BodyEndIslands } from "../lib/_body-end-islands";

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

  return (
    <StyleguideLayout
      title={composeMetaTitle("Components")}
      activeSlug={OVERVIEW_SLUG}
      lang={locale}
      head={<HeadWithDefaults title={`Components — ${settings.siteName}`} />}
      header={<HeaderWithDefaults lang={locale} currentPath={currentPath} />}
      footer={<FooterWithDefaults lang={locale} />}
      bodyEnd={<BodyEndIslands basePath={settings.base ?? "/"} />}
    >
      <div class="mx-auto max-w-[64rem]">
        <header class="mb-vsp-lg">
          <h1 class="text-heading font-bold mb-vsp-2xs">Component catalog</h1>
          <p class="text-muted text-small">
            {total} components from <code>@zudo-sg/ui</code>, discovered from
            their <code>.stories.tsx</code> files.
          </p>
        </header>

        {filterIsland}

        <div data-sg-catalog>
          {groups.map((group) => (
            <section class="mb-vsp-xl" data-sg-section data-category={group.category}>
              <h2 class="mb-vsp-sm text-title font-semibold">
                {group.category}
              </h2>
              <div class="grid grid-cols-1 gap-hsp-md sm:grid-cols-2 lg:grid-cols-3">
                {group.stories.map((story) => (
                  <a
                    href={withBase(`/components/${story.slug}`)}
                    class="block rounded-md border border-line bg-surface p-hsp-md transition-colors hover:border-accent"
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
                    <h3 class="font-semibold text-fg">{story.meta.title}</h3>
                    <p class="mt-vsp-2xs text-small text-muted">
                      {story.meta.description}
                    </p>
                    <p class="mt-vsp-xs text-xs text-muted">
                      {story.variants.length} variant
                      {story.variants.length === 1 ? "" : "s"}
                    </p>
                  </a>
                ))}
              </div>
            </section>
          ))}
          <p class="text-muted text-small" data-sg-empty hidden>
            No components match your search.
          </p>
        </div>
      </div>
    </StyleguideLayout>
  );
}
