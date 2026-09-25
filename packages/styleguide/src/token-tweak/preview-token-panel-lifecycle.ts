import type { PanelConfig } from "@takazudo/zdtp";
import { loadZdtp } from "./token-panel-native-bootstrap.js";

type LifecycleWindow = Window & {
  __sgPreviewPanelLifecycle?: { observer: MutationObserver; installed: boolean };
};

/**
 * zudo-doc's native bootstrap attaches zdtp's page-load hook to after-swap.
 * zfb runs scripts and mounts new islands after that event, so zdtp can leave
 * an empty root that later toggles cannot render into. Once the first lazy
 * panel actually mounts, rebind zdtp's public lifecycle adapter to zfb's
 * post-mount page-load event. The observer never imports zdtp before a mount.
 */
export function watchPreviewTokenPanelLifecycle(getConfig: () => PanelConfig): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const target = window as LifecycleWindow;
  if (target.__sgPreviewPanelLifecycle) return;

  const prefix = getConfig().storagePrefix;
  const hasMountedPreview = () => [...document.querySelectorAll<HTMLElement>('[id$="-root"]')]
    .some((root) => root.id.startsWith(`${prefix}-`) && root.querySelector(".tokenpanel-shell"));
  const state = { observer: undefined as unknown as MutationObserver, installed: false };
  let loading = false;
  const install = async () => {
    if (state.installed || loading || !hasMountedPreview()) return;
    loading = true;
    const zdtp = await loadZdtp();
    loading = false;
    if (!zdtp || state.installed) return;
    zdtp.setLifecycleAdapter({
      onBeforeSwap(callback) {
        document.addEventListener("zfb:before-swap", callback);
        return () => document.removeEventListener("zfb:before-swap", callback);
      },
      onPageLoad(callback) {
        document.addEventListener("zfb:page-load", callback);
        return () => document.removeEventListener("zfb:page-load", callback);
      },
    });
    state.installed = true;
    state.observer.disconnect();
  };
  state.observer = new MutationObserver(() => { void install(); });
  target.__sgPreviewPanelLifecycle = state;
  state.observer.observe(document, { childList: true, subtree: true });
  void install();
}
