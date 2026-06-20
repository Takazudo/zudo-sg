/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Server-rendered catalog sidebar: categories (in declared order) with their
// stories, plus the Tokens link. Active story is highlighted via aria-current.
// Pure SSR — no island needed (links are plain <a>; SPA nav is handled by the
// host's client router).

import type { JSX } from "preact";
import { withBase } from "@/utils/base";
import { getCategoryGroups } from "../data/registry";

export interface SidebarNavProps {
  /** Active story slug (detail page) — highlighted in the tree. */
  activeSlug?: string;
  /** True on the /sg/tokens route — highlights the Tokens link. */
  tokensActive?: boolean;
}

export function SidebarNav({
  activeSlug,
  tokensActive,
}: SidebarNavProps): JSX.Element {
  const groups = getCategoryGroups();

  return (
    <nav class="sg-sidebar" id="sg-sidebar" aria-label="Components">
      <div class="p-hsp-sm">
        <a
          href={withBase("/sg")}
          class="sg-nav-link font-semibold"
        >
          Overview
        </a>
        <a
          href={withBase("/sg/tokens")}
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
                href={withBase(`/sg/${story.slug}`)}
                class="sg-nav-link"
                aria-current={story.slug === activeSlug ? "page" : undefined}
              >
                {story.meta.title}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div class="sg-resizer" data-sg-resizer="sidebar" aria-hidden="true" />
    </nav>
  );
}
