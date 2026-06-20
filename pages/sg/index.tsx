/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Styleguide catalog landing (`/sg`). Lists every discovered story grouped by
// category, each linking to its detail page. Discovery is the eager-glob
// registry (see packages/sg-registry.ts).
//
// The grouped grid is SERVER-RENDERED (no-JS + crawlable). A client island
// (CatalogFilter) layers search + category-tag filtering on top by toggling
// `hidden` on the SSR-rendered cards/sections — so the registry is never
// re-shipped into the island chunk. Each card carries the `data-sg-*` search
// metadata the island reads (see catalog-filter.tsx for the contract).

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { withBase } from "@/utils/base";
import { StyleguideLayout } from "@/styleguide/chrome/styleguide-layout";
import { getCategoryGroups } from "@/styleguide/data/registry";
import CatalogFilter from "@/styleguide/search/catalog-filter";

export const frontmatter = { title: "Styleguide" };

export default function StyleguideIndex(): JSX.Element {
  const groups = getCategoryGroups();
  const total = groups.reduce((n, g) => n + g.stories.length, 0);
  const categories = groups.map((g) => g.category);

  const filter = Island({
    when: "load",
    children: <CatalogFilter categories={categories} total={total} />,
  }) as unknown as VNode;

  return (
    <StyleguideLayout title="Styleguide">
      <div class="mx-auto max-w-[64rem]">
        <header class="mb-vsp-lg">
          <h1 class="text-2xl font-bold text-ink">Component catalog</h1>
          <p class="mt-vsp-xs text-ink-soft">
            {total} components from <code>@zudo-sg/ui</code>, discovered from
            their <code>.stories.tsx</code> files.
          </p>
        </header>

        {filter}

        <div data-sg-catalog>
          {groups.map((group) => (
            <section class="mb-vsp-xl" data-sg-section data-category={group.category}>
              <h2 class="mb-vsp-sm text-lg font-semibold text-ink">
                {group.category}
              </h2>
              <div class="grid grid-cols-1 gap-hsp-md sm:grid-cols-2 lg:grid-cols-3">
                {group.stories.map((story) => {
                  const keywords = [
                    story.meta.title,
                    story.meta.category,
                    story.meta.description,
                    ...story.variants.map((v) => v.name),
                  ]
                    .join(" ")
                    .toLowerCase();
                  return (
                    <a
                      href={withBase(`/sg/${story.slug}`)}
                      class="block rounded-md border border-line bg-surface p-hsp-md transition-colors hover:border-brand"
                      data-sg-card
                      data-name={story.meta.title.toLowerCase()}
                      data-category={story.meta.category}
                      data-keywords={keywords}
                    >
                      <h3 class="font-semibold text-ink">{story.meta.title}</h3>
                      <p class="mt-vsp-2xs text-small text-ink-soft">
                        {story.meta.description}
                      </p>
                      <p class="mt-vsp-xs text-xs text-ink-mute">
                        {story.variants.length} variant
                        {story.variants.length === 1 ? "" : "s"}
                      </p>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}

          <p
            class="rounded-md border border-dashed border-line bg-surface-sunken p-hsp-lg text-center text-small text-ink-mute"
            data-sg-empty
            hidden
          >
            No components match your search.
          </p>
        </div>
      </div>
    </StyleguideLayout>
  );
}
