/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Story detail (`/sg/[slug]`). Enumerates one route per discovered story
// (paths()), and renders its variants as stacked isolated preview iframes plus
// a right-region code panel (source + live CSS injection).
//
// paths() is synchronous (zfb ADR-004) and reads the eager-glob registry. Each
// VariantFrame and the CodePanel are islands; the slug + variant export names
// are passed as plain (JSON-serializable) props.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { StyleguideLayout } from "@/styleguide/chrome/styleguide-layout";
import VariantFrame from "@/styleguide/preview/variant-frame";
import CodePanel, {
  type CodePanelVariant,
} from "@/styleguide/code-panel/code-panel";
import {
  getAllSlugs,
  getStoryBySlug,
  resolveVariantSource,
} from "@/styleguide/data/registry";

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
  const entry = getStoryBySlug(slug);

  if (!entry) {
    return (
      <StyleguideLayout title="Not found" activeSlug={slug}>
        <p class="text-ink-soft">Story not found: {slug}</p>
      </StyleguideLayout>
    );
  }

  const codePanelVariants: CodePanelVariant[] = entry.variants.map((v) => ({
    exportName: v.exportName,
    name: v.name,
    source: resolveVariantSource(entry, v),
  }));

  const codePanel = Island({
    when: "visible",
    children: (
      <CodePanel storyTitle={entry.meta.title} variants={codePanelVariants} />
    ),
  }) as unknown as VNode;

  return (
    <StyleguideLayout
      title={entry.meta.title}
      activeSlug={slug}
      codePanel={codePanel}
    >
      <div class="mx-auto max-w-[56rem]">
        <header class="mb-vsp-lg">
          <h1 class="text-2xl font-bold text-ink">{entry.meta.title}</h1>
          <p class="mt-vsp-xs text-ink-soft">{entry.meta.description}</p>
          <span class="mt-vsp-xs inline-block rounded-full border border-line px-hsp-sm py-vsp-3xs text-xs text-ink-mute">
            {entry.meta.category}
          </span>
        </header>

        <section class="mb-vsp-xl">
          <h2 class="mb-vsp-sm text-small font-semibold uppercase tracking-wide text-ink-mute">
            Usage
          </h2>
          <pre class="overflow-auto rounded-md bg-surface-sunken p-hsp-md text-xs text-ink-soft">
            <code>{entry.meta.usage}</code>
          </pre>
        </section>

        <div class="flex flex-col gap-vsp-xl">
          {entry.variants.map((v) => {
            const frame = Island({
              when: "visible",
              children: (
                <VariantFrame
                  slug={slug}
                  exportName={v.exportName}
                  name={v.name}
                  controls={v.story.controls}
                />
              ),
            }) as unknown as VNode;
            return <div>{frame}</div>;
          })}
        </div>
      </div>
    </StyleguideLayout>
  );
}
