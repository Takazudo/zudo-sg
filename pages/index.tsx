/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the site index route.
//
// Default-locale (EN) site index. Static route — no paths() export needed.
// Collects the EN docs and component trees and renders the home intro,
// site-map grid, and optional tag count.
//
// Data flow:
//   resolveNavSource() + getCategoryGroups() → three-entry sitemap tree
//   routeContext.homeIntros → server-rendered CompactProse (never an island)
//   collectTags() → optional tag section
//   DocLayoutWithDefaults → page with no sidebar/TOC

import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { buildNavTree } from "@/utils/docs";
import { resolveNavSource } from "./lib/_nav-source-docs";
import { getCategoryGroups } from "@/styleguide/data/registry";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { AutoLogo } from "@takazudo/zudo-doc/auto-logo";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { CompactProse } from "@takazudo/zudo-doc/home-intro";
import type { SidebarNavNode } from "@takazudo/zudo-doc/sidebar";
import type { JSX } from "preact";
import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { SiteTreeNav } from "@takazudo/zudo-doc/site-tree-nav-island";
import { routeContext } from "virtual:zudo-doc-route-context";
import { FooterWithDefaults } from "./lib/_footer-with-defaults";
import { HeaderWithDefaults } from "./lib/_header-with-defaults";
import { HeadWithDefaults } from "./lib/_head-with-defaults";
import { composeMetaTitle } from "./lib/_compose-meta-title";
import { BodyEndIslands } from "./lib/_body-end-islands";

export const frontmatter = { title: "Home" };

export default function IndexPage(): JSX.Element {
  const locale = defaultLocale;

  // Identity-stable nav source (draft-filtered, unlisted retained). navDocs is
  // pre-filtered (isNavVisible) and shared with the nav-tree fast-path.
  const { navDocs, categoryMeta } = resolveNavSource(locale, undefined);
  const docsTree = buildNavTree(navDocs, locale, categoryMeta);
  const componentCategories: SidebarNavNode[] = getCategoryGroups().map((group, categoryIndex) => ({
    slug: `category:${group.category}`,
    label: group.category,
    position: categoryIndex,
    hasPage: false,
    children: group.stories.map((story, storyIndex) => ({
      slug: story.slug,
      label: story.meta.title,
      position: storyIndex,
      href: withBase(`/components/${story.slug}`),
      hasPage: true,
      children: [],
    })),
  }));
  const tree: SidebarNavNode[] = [
    {
      slug: "overview",
      label: "Overview",
      position: 0,
      href: withBase("/docs/overview"),
      hasPage: true,
      children: docsTree,
    },
    {
      slug: "components",
      label: "Components",
      position: 1,
      href: withBase("/components"),
      hasPage: true,
      children: componentCategories,
    },
    {
      slug: "tokens",
      label: "Design Tokens",
      position: 2,
      href: withBase("/tokens"),
      hasPage: true,
      children: [],
    },
  ];

  // The prepared Markdown belongs to this SSR module, not the sitemap island.
  const intro = routeContext.homeIntros[locale] ?? null;
  const hasIntro = Boolean(intro?.nodes.length);

  // Drop category_no_page index files so the count matches the number of tag
  // pages actually built (the tag routes exclude them too).
  const tagCount = collectTags(
    navDocs.filter((d) => !d.data.category_no_page),
    (id, data) => data.slug ?? toRouteSlug(id),
  ).size;

  const ctaNav = settings.headerNav[0] ?? null;
  const overview = ctaNav ? withBase(ctaNav.path) : null;

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(settings.siteName)}
      enableClientRouter={settings.dynamicPageTransition}
      head={<HeadWithDefaults title={settings.siteName} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      contentWide={settings.home.wide}
      // Empty fragment suppresses DocLayoutWithDefaults' empty-data default
      // Sidebar island — its marker never hydrates for published-package
      // consumers (zfb#999) and zfb >= next.38 warns about it; the sidebar is
      // hidden on this page anyway (zudolab/zudo-doc#2057).
      sidebarOverride={<></>}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase("/")} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
    >
      {/* Hero: logo left, title+desc+links right, block centered */}
      <div class="zd-home-hero mb-vsp-xl">
        <div class="zd-home-inner flex flex-col items-center justify-center text-center gap-hsp-md lg:flex-row lg:text-left lg:gap-hsp-xl">
          <AutoLogo
            seed={settings.siteName}
            class="w-[320px] max-w-full aspect-[1200/630] text-fg shrink-0"
          />
          <div class="zd-home-copy min-w-0 lg:flex-1">
            <h1 class="text-heading font-bold mb-vsp-2xs break-words">{settings.siteName}</h1>
            <p class="text-muted text-small mb-vsp-sm">{settings.siteDescription}</p>
            <div class="zd-home-links flex flex-wrap items-center justify-center lg:justify-start gap-hsp-md text-small">
              {overview && (
                <>
                  <a href={overview} class="text-fg underline hover:text-accent">
                    {ctaNav.label}
                  </a>
                  <span class="text-muted">/</span>
                </>
              )}
              {settings.githubUrl && (
                <>
                  <a
                    href={settings.githubUrl as string}
                    class="inline-flex items-center gap-[0.3em] text-fg underline hover:text-accent"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" class="w-[1em] h-[1em] shrink-0">
                      <path
                        fill="currentColor"
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                      />
                    </svg>
                    GitHub
                  </a>
                  <span class="text-muted">/</span>
                </>
              )}
              {/* @Takazudo link — established in #1453 (project-specific brand link).
                  The deploy was missing this trailing item, leaving a dangling "/" separator. */}
              <a
                href="https://x.com/Takazudo"
                class="text-fg underline hover:text-accent"
                target="_blank"
                rel="noopener noreferrer"
              >
                @Takazudo
              </a>
            </div>
          </div>
        </div>
      </div>

      {hasIntro && (
        <>
          <hr class="zd-home-rule" data-home-rule="upper" />
          <div class="zd-home-intro">
            <div class="zd-home-inner">
              <CompactProse intro={intro} />
            </div>
          </div>
        </>
      )}

      <hr class="zd-home-rule" data-home-rule="lower" />
      <section class="zd-home-sitemap">
        {Island({
          when: "idle",
          children: (
            <SiteTreeNav
              tree={tree}
              initiallyCollapsedCategorySlugs={["overview", "components"]}
            />
          ),
        }) as unknown as VNode}
      </section>

      {settings.docTags && tagCount > 0 && (
        <section class="mt-vsp-xl">
          <h2 class="text-heading font-bold mb-vsp-md">
            {t("doc.allTags", locale)}
          </h2>
          <a href={withBase("/docs/tags")} class="text-accent underline hover:text-accent-hover">
            {t("doc.allTags", locale)}
          </a>
        </section>
      )}
    </DocLayoutWithDefaults>
  );
}
