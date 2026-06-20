/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The styleguide header's mobile sidebar drawer (hamburger + backdrop +
// slide-in <aside>), rendered in the header below the `lg` breakpoint where
// DocLayout hides the desktop sidebar. Without it, mobile users lose all access
// to the nav tree — so it is required for the chrome to "read as native".
//
// Mirrors the docs site's `pages/lib/_header-with-defaults.tsx`: the vendored
// `SidebarToggle` (which itself hosts the vendored `SidebarTree`) is wrapped in
// `<Island when="visible">`, fed the SAME `navNodes` array the desktop sidebar
// consumes. The data props ride the SSR → hydrate boundary directly on the
// SidebarToggle island marker (zfb drops function values during prop
// serialisation, so SidebarTree is hosted as a prop, not as island children).
//
// when="visible": all SidebarToggle children are `lg:hidden`, so on desktop the
// island wrapper has zero rendered size and IntersectionObserver never fires
// hydration; on mobile it hydrates normally.

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import SidebarToggle from "@/chrome/native/sidebar-toggle";
import { navNodes } from "@/data/nav-nodes";
import { settings } from "@/config/settings";

export interface MobileSidebarProps {
  /** Active story slug, forwarded to the tree for the active highlight. */
  currentSlug?: string;
}

export function MobileSidebar({ currentSlug }: MobileSidebarProps): VNode {
  const themeDefaultMode = settings.colorMode
    ? settings.colorMode.defaultMode
    : undefined;

  return Island({
    when: "visible",
    children: (
      <SidebarToggle
        nodes={navNodes}
        currentSlug={currentSlug}
        themeDefaultMode={themeDefaultMode}
      />
    ),
  }) as unknown as VNode;
}
