/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The styleguide's desktop sidebar CONTENT (passed as `sidebarOverride` to
// DocLayoutWithDefaults): the native interactive tree, hydrated as a Preact
// island.
//
// This replaces the old plain-link `<SidebarNav>`. It mirrors the docs site's
// `pages/lib/_sidebar-with-defaults.tsx`: the vendored `SidebarTree` is wrapped
// DIRECTLY in `<Island when="load">` (NOT through an intermediate shell with a
// function prop). zfb's `Island.captureSerializableProps` runs `JSON.stringify`
// on the wrapped component's own props, which silently DROPS function values —
// so the hydration target must own its plain-data props (nodes, currentSlug)
// directly. All props here are plain data (arrays of objects + strings), so they
// survive the SSR → hydrate boundary in the Island marker's `data-props`.
//
// The 3-region shell (the `#desktop-sidebar` <aside>, its `--zd-sidebar-w`
// width var, the drag-resizer) is owned by DocLayout — this renders only the
// tree that fills that region.

import type { JSX } from "preact";
import { Island } from "@takazudo/zfb";
import SidebarTree from "@/chrome/native/sidebar-tree";
import { navNodes } from "@/data/nav-nodes";
import { settings } from "@/config/settings";

export interface SidebarProps {
  /** Active story slug, version of the tree's `currentSlug` highlight. */
  currentSlug?: string;
}

export function Sidebar({ currentSlug }: SidebarProps): JSX.Element {
  // themeDefaultMode is forwarded so the vendored tree's mobile-only footer
  // ThemeToggle (lg:hidden) initialises to the configured mode; on desktop the
  // footer is hidden so it is inert there.
  const themeDefaultMode = settings.colorMode
    ? settings.colorMode.defaultMode
    : undefined;

  return Island({
    when: "load",
    children: (
      <SidebarTree
        nodes={navNodes}
        currentSlug={currentSlug}
        themeDefaultMode={themeDefaultMode}
      />
    ),
  }) as unknown as JSX.Element;
}
