/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Styleguide catalog landing (`/sg`). Lists every discovered story grouped by
// category, each linking to its detail page. Discovery is the eager-glob
// registry (see packages/sg-registry.ts).

import type { JSX } from "preact";
import { withBase } from "@/utils/base";
import { StyleguideLayout } from "@/styleguide/chrome/styleguide-layout";
import { getCategoryGroups } from "@/styleguide/data/registry";

export const frontmatter = { title: "Styleguide" };

export default function StyleguideIndex(): JSX.Element {
  const groups = getCategoryGroups();
  const total = groups.reduce((n, g) => n + g.stories.length, 0);

  return (
    <StyleguideLayout title="Styleguide">
      <div class="mx-auto max-w-[64rem]">
        <header class="mb-vsp-xl">
          <h1 class="text-2xl font-bold text-ink">Component catalog</h1>
          <p class="mt-vsp-xs text-ink-soft">
            {total} components from <code>@zudo-sg/ui</code>, discovered from
            their <code>.stories.tsx</code> files.
          </p>
        </header>

        {groups.map((group) => (
          <section class="mb-vsp-xl">
            <h2 class="mb-vsp-sm text-lg font-semibold text-ink">
              {group.category}
            </h2>
            <div class="grid grid-cols-1 gap-hsp-md sm:grid-cols-2 lg:grid-cols-3">
              {group.stories.map((story) => (
                <a
                  href={withBase(`/sg/${story.slug}`)}
                  class="block rounded-md border border-line bg-surface p-hsp-md transition-colors hover:border-brand"
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
              ))}
            </div>
          </section>
        ))}
      </div>
    </StyleguideLayout>
  );
}
