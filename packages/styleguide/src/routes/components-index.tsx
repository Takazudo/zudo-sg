/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Injected at `sgContext.routes.componentsIndex` — the component catalog
// landing: category-grouped tiles, each carrying its component rendered
// INLINE server-side (no preview iframes), filtered client-side by the
// CatalogFilter island, inside the StyleguideLayout docs-section shell.
// Reads the mode-neutral `CatalogEntry` fields, so module and descriptor
// registries render through the same markup.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { CatalogThumb, TILE_SIZE_RESTORE_SCRIPT } from "../catalog/index.js";
import { StyleguideLayout } from "../chrome/index.js";
import { OVERVIEW_SLUG } from "../registry/index.js";
import { CatalogFilter } from "../search/index.js";
import { componentHref } from "../sg-routes.js";
import { chromeProps } from "./_chrome.js";
import { ctx, withBase } from "./_context.js";
import { registry } from "./_registry.js";

export const frontmatter = { title: "Components" };

export default function ComponentsIndexRoute(): JSX.Element {
  const groups = registry.getCategoryGroups();
  const total = groups.reduce((n, g) => n + g.stories.length, 0);
  const categories = groups.map((g) => g.category);

  const filterIsland = Island({
    when: "load",
    children: <CatalogFilter categories={categories} total={total} />,
  }) as unknown as VNode;

  return (
    <StyleguideLayout
      {...chromeProps({
        pageTitle: "Components",
        path: ctx.routes.componentsIndex,
        // Restore the persisted tile size before first paint so the grid does
        // not re-flow when the island mounts.
        extraHead: <script dangerouslySetInnerHTML={{ __html: TILE_SIZE_RESTORE_SCRIPT }} />,
        activeSlug: OVERVIEW_SLUG,
      })}
      activeSlug={OVERVIEW_SLUG}
      contentWide
    >
      <header class="mb-vsp-lg max-w-[56rem]">
        <h1 class="text-heading font-bold mb-vsp-2xs">{ctx.catalog.title}</h1>
        <p class="text-[color:var(--sg-muted)] text-small" data-sg-catalog-intro>
          {ctx.catalog.intro ?? (ctx.registryMode === "descriptor" ? (
            <>
              {total} components{ctx.uiPackageName ? <> from <code>{ctx.uiPackageName}</code></> : null}, listed from
              the host's story descriptors.
            </>
          ) : (
            <>
              {total} components{ctx.uiPackageName ? <> from <code>{ctx.uiPackageName}</code></> : null},
              discovered from their <code>.stories.tsx</code> files. Each tile previews the
              component's first variant, rendered here on the server.
            </>
          ))}
        </p>
      </header>

      {filterIsland}

      <div data-sg-catalog>
        {groups.map((group) => (
          <section class="sg-gallery-section" data-sg-section data-category={group.category}>
            <h2 class="mb-vsp-sm text-heading font-semibold">{group.category}</h2>
            <div class="sg-grid">
              {group.stories.map((story) => (
                <div class="sg-tile" data-sg-tile>
                  <CatalogThumb entry={story} />
                  <a
                    href={withBase(componentHref(ctx.routes, story.slug))}
                    class="sg-tile-meta"
                    data-sg-card
                    data-name={story.title.toLowerCase()}
                    data-category={group.category}
                    data-keywords={[story.title, story.description, story.category ?? ""]
                      .join(" ")
                      .toLowerCase()}
                  >
                    <h3 class="sg-tile-title">{story.title}</h3>
                    <p class="sg-tile-desc">{story.description}</p>
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
        <p class="text-[color:var(--sg-muted)] text-small" data-sg-empty hidden>
          No components match your search.
        </p>
      </div>
    </StyleguideLayout>
  );
}
