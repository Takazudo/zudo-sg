import type { PanelConfig } from "@takazudo/zdtp";
import { loadZdtp } from "./token-panel-native-bootstrap.js";

type RepairWindow = Window & { __sgPreviewPanelRepair?: () => Promise<void> };

/** Recover only a preview instance whose zdtp root survived a soft nav empty. */
export function installPreviewTokenPanelRepair(getConfig: () => PanelConfig): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const target = window as RepairWindow;
  if (target.__sgPreviewPanelRepair) return;

  let inFlight: Promise<void> | undefined;
  target.__sgPreviewPanelRepair = () => {
    if (inFlight) return inFlight;
    const baseConfig = getConfig();
    const basePrefix = baseConfig.storagePrefix;
    const emptyRoots = [...document.querySelectorAll<HTMLElement>('[id$="-root"]')]
      .filter((root) => root.isConnected && root.childElementCount === 0)
      .filter((root) => root.id === `${basePrefix}-root` || root.id.startsWith(`${basePrefix}--`));
    if (emptyRoots.length === 0) return Promise.resolve();

    inFlight = (async () => {
      const zdtp = await loadZdtp();
      if (!zdtp) return;
      for (const root of emptyRoots) {
        if (!root.isConnected || root.childElementCount !== 0) continue;
        const prefix = root.id.slice(0, -"-root".length);
        const config = prefix === basePrefix ? baseConfig : { ...baseConfig, storagePrefix: prefix };
        // Idempotent same-prefix configuration returns the existing handle.
        // Obtain it before touching the DOM so a conflict leaves the root intact.
        const handle = zdtp.configurePanel(config);
        const wasOpen = (() => {
          try { return localStorage.getItem(`${prefix}-open`) === "1"; } catch { return false; }
        })();
        root.remove();
        if (wasOpen) handle.open();
      }
    })().catch((error) => {
      console.error("[zudo-sg] preview token panel could not recover after navigation.", error);
    }).finally(() => { inFlight = undefined; });
    return inFlight;
  };
}
