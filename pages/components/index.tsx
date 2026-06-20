/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Component catalog landing — `/components`.
//
// Lists all discovered components grouped by category. Each card links to the
// component's detail page at `/components/<slug>`. This page is static
// (server-rendered, no search island yet — later wave).
//
// Data flow:
//   getCategoryGroups()  [from src/styleguide/data/registry]
//   → category-grouped cards (SSR, no-JS)
//   → DocLayoutWithDefaults (mirrors root pages/index.tsx)

import type { JSX } from "preact";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { settings } from "@/config/settings";
import { withBase } from "@/utils/base";
import { defaultLocale } from "@/config/i18n";
import { getCategoryGroups } from "@/styleguide/data/registry";
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

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle("Components")}
      head={<HeadWithDefaults title={`Components — ${settings.siteName}`} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      sidebarOverride={<></>}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={currentPath} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
    >
      <div class="mx-auto max-w-[64rem]">
        <header class="mb-vsp-lg">
          <h1 class="text-heading font-bold mb-vsp-2xs">Component catalog</h1>
          <p class="text-muted text-small">
            {total} components from <code>@zudo-sg/ui</code>, discovered from
            their <code>.stories.tsx</code> files.
          </p>
        </header>

        <div>
          {groups.map((group) => (
            <section class="mb-vsp-xl">
              <h2 class="mb-vsp-sm text-title font-semibold">
                {group.category}
              </h2>
              <div class="grid grid-cols-1 gap-hsp-md sm:grid-cols-2 lg:grid-cols-3">
                {group.stories.map((story) => (
                  <a
                    href={withBase(`/components/${story.slug}`)}
                    class="block rounded-md border border-line bg-surface p-hsp-md transition-colors hover:border-accent"
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
        </div>
      </div>
    </DocLayoutWithDefaults>
  );
}
