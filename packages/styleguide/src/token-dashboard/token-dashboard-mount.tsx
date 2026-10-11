"use client";

import { getScope } from "@takazudo/zfb/zudo-react";
import type { TokenDashboardProps } from "@takazudo/zdtp/dashboard";
import { buildDashboardPreviewOverrides, type UiDesignTokensManifest } from "./ui-token-tabs.js";

export type TokenDashboardMountProps = Omit<TokenDashboardProps, "previewOverrides"> & {
  manifest: UiDesignTokensManifest;
};

export function TokenDashboardMount({ manifest, ...props }: TokenDashboardMountProps) {
  const ref = { current: null as HTMLDivElement | null };
  const scope = getScope();
  scope.onActivate(() => {
    let alive = true;
    let unmount: (() => void) | undefined;
    const host = ref.current!;
    void import("./token-dashboard-adapter.js").then(({ mountDashboard }) => {
      if (!alive) return;
      unmount = mountDashboard(host, {
        ...props,
        previewOverrides: buildDashboardPreviewOverrides(manifest),
      });
    }).catch(() => {
      if (!alive) return;
      host.setAttribute("role", "alert");
      host.textContent = "Unable to load declared token defaults. Reload to try again.";
    });
    return () => {
      alive = false;
      unmount?.();
      host.replaceChildren();
    };
  });
  return <div data-sg-token-dashboard ref={ref} />;
}
