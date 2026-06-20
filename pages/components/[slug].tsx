/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Component detail — `/components/<slug>`.
//
// Enumerates one route per discovered story (paths() → getAllSlugs()), and
// renders that story's variants as stacked isolated preview iframes
// (VariantFrame islands). Each VariantFrame loads `/components/preview?slug=…
// &variant=…` as its iframe src and auto-sizes to the preview's reported
// height.
//
// Chrome composition (mirrors pages/components/index.tsx): the docs chrome
// defaults (`HeaderWithDefaults` / `FooterWithDefaults` / `HeadWithDefaults` /
// `BodyEndIslands`) live under `pages/lib/*` — the tsc-EXCLUDED page tree that
// owns the `zfb/content` virtuals. A static `src → pages` import would drag
// those excluded files into the `pnpm check` program and fail. So this page
// (itself under `pages/`, free to import `pages/lib/*`) composes the slots and
// passes them into the `src/`-side `StyleguideLayout` shell as props.
//
// Code panel (#49): the right-region CodeMirror code panel is NOT wired here —
// that is Wave #49's scope. The `StyleguideLayout` already exposes a
// `codePanel` prop (it flows into the DocLayout `tocOverride` slot and flips
// `hideToc`). We pass `codePanel={null}` now, leaving that seam for #49 to
// fill with `<aside id="sg-code-panel">…</aside>` framing. See the
// `>>> #49 SEAM` marker below.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { getAllSlugs, getStoryBySlug } from "@/styleguide/data/registry";
import { StyleguideLayout } from "@/features/styleguide/chrome/_styleguide-layout";
import VariantFrame from "@/features/styleguide/preview/variant-frame";
import { FooterWithDefaults } from "../lib/_footer-with-defaults";
import { HeaderWithDefaults } from "../lib/_header-with-defaults";
import { HeadWithDefaults } from "../lib/_head-with-defaults";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { BodyEndIslands } from "../lib/_body-end-islands";

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
  const head = <HeadWithDefaults title={pageTitle} />;
  const header = <HeaderWithDefaults lang={locale} currentPath={currentPath} />;
  const footer = <FooterWithDefaults lang={locale} />;
  const bodyEnd = <BodyEndIslands basePath={settings.base ?? "/"} />;

  // >>> #49 SEAM: the code panel goes in the StyleguideLayout `codePanel` slot
  // (which the shell flows into the DocLayout `tocOverride` region and uses to
  // un-hide the right band). Wave #49 composes `<aside id="sg-code-panel">…`
  // here and passes it as `codePanel={…}`. Until then it stays absent so the
  // content band fills the full width.
  const codePanel: VNode | null = null;

  if (!entry) {
    return (
      <StyleguideLayout
        title={composeMetaTitle("Not found")}
        activeSlug={slug}
        lang={locale}
        head={head}
        header={header}
        footer={footer}
        bodyEnd={bodyEnd}
        codePanel={codePanel}
      >
        <p class="text-ink-soft">Story not found: {slug}</p>
      </StyleguideLayout>
    );
  }

  return (
    <StyleguideLayout
      title={composeMetaTitle(entry.meta.title)}
      activeSlug={slug}
      lang={locale}
      head={head}
      header={header}
      footer={footer}
      bodyEnd={bodyEnd}
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
          <div class="sg-snippet">
            <pre class="overflow-auto rounded-md bg-surface-sunken p-hsp-md text-xs text-ink-soft">
              <code>{entry.meta.usage}</code>
            </pre>
          </div>
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
