/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Server-rendered catalog sidebar CONTENT: categories (in declared order) with
// their stories, plus the Overview + Design Tokens links. Active story is
// highlighted via aria-current. Pure SSR — no island needed (links are plain
// <a>; SPA nav is handled by zfb's client router).
//
// This is the value passed as `sidebarOverride` to zudo-doc's
// DocLayoutWithDefaults. The 3-region shell (the `#desktop-sidebar` <aside>,
// its width var `--zd-sidebar-w`, and the drag-resizer) is owned by DocLayout
// — this component renders only the tree that fills that region, so it has no
// `<nav class="sg-sidebar">` wrapper and no resizer handle of its own.

import type { JSX } from "preact";
import { withBase } from "@/utils/base";
import { getCategoryGroups } from "@/data/registry";

export interface SidebarNavProps {
  /** Active story slug (detail page) — highlighted in the tree. */
  activeSlug?: string;
  /** True on the /tokens route — highlights the Design Tokens link. */
  tokensActive?: boolean;
}

export function SidebarNav({
  activeSlug,
  tokensActive,
}: SidebarNavProps): JSX.Element {
  const groups = getCategoryGroups();

  return (
    <nav class="sg-sidebar-nav" aria-label="Components">
      <div class="p-hsp-sm">
        <a href={withBase("/")} class="sg-nav-link font-semibold">
          Overview
        </a>
        <a
          href={withBase("/tokens")}
          class="sg-nav-link font-semibold"
          aria-current={tokensActive ? "page" : undefined}
        >
          Design Tokens
        </a>

        {groups.map((group) => (
          <div class="mt-vsp-md">
            <p class="px-hsp-sm py-vsp-3xs text-xs font-semibold uppercase tracking-wide text-ink-mute">
              {group.category}
            </p>
            {group.stories.map((story) => (
              <a
                href={withBase(`/${story.slug}`)}
                class="sg-nav-link"
                aria-current={story.slug === activeSlug ? "page" : undefined}
              >
                {story.meta.title}
              </a>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
