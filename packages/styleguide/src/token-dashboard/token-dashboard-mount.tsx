"use client";

import { getScope } from "@takazudo/zfb/zudo-react";
import type { TokenDashboardProps } from "@takazudo/zdtp/dashboard";
import { buildDashboardPreviewOverrides, type UiDesignTokensManifest } from "./ui-token-tabs.js";

export type TokenDashboardMountProps = Omit<TokenDashboardProps, "previewOverrides"> & {
  manifest: UiDesignTokensManifest;
};

function showFailure(host: HTMLElement, message: string) {
  host.replaceChildren();
  host.setAttribute("role", "alert");
  host.textContent = message;
}

export function TokenDashboardMount({ manifest, ...props }: TokenDashboardMountProps) {
  const ref = { current: null as HTMLDivElement | null };
  const scope = getScope();
  scope.onActivate(() => {
    let alive = true;
    let unmount: (() => void) | undefined;
    const host = ref.current!;
    void import("./token-dashboard-adapter.js").then(({ mountDashboard }) => {
      if (!alive) return;
      try {
        unmount = mountDashboard(host, {
          ...props,
          previewOverrides: buildDashboardPreviewOverrides(manifest),
        });
      } catch (error) {
        console.error("[zudo-sg] token dashboard failed to mount", error);
        // zdtp returns no handle when mountTokenDashboard throws, so clearing its partial DOM is all that can be undone.
        showFailure(host, "Unable to render the token dashboard. Reload to try again.");
      }
    }, (error: unknown) => {
      if (!alive) return;
      console.error("[zudo-sg] token dashboard adapter failed to load", error);
      showFailure(host, "Unable to load declared token defaults. Reload to try again.");
    });
    return () => {
      alive = false;
      unmount?.();
      host.replaceChildren();
    };
  });
  return <div data-sg-token-dashboard ref={ref} />;
}
