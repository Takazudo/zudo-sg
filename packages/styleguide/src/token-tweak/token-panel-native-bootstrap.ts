import type { PanelConfig } from "@takazudo/zdtp";

type PrehydrateScript = HTMLScriptElement & {
  __zdtpPrehydrateListener?: EventListener;
};

type ZdtpModule = typeof import("@takazudo/zdtp");

/**
 * Loads the required `@takazudo/zdtp` peer lazily. A failed import resolves
 * `null` with a console warning so owner console helpers never surface an
 * unhandled rejection.
 */
export async function loadZdtp(
  importer: () => Promise<ZdtpModule> = () => import("@takazudo/zdtp"),
): Promise<ZdtpModule | null> {
  try {
    return await importer();
  } catch (error) {
    console.warn(
      "[zudo-sg] @takazudo/zdtp is not available; the preview token panel is disabled.",
      error,
    );
    return null;
  }
}

/**
 * Drain the first toggle captured by the SSR script before this island mounted.
 * State lives on the script element, not in a window-global queue, so two
 * panel instances cannot overwrite each other's bootstrap channel.
 */
export function drainPrehydrationToggle(scriptId: string, toggleEvent: string): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const script = document.getElementById(scriptId) as PrehydrateScript | null;
  const listener = script?.__zdtpPrehydrateListener;
  if (!script || !listener) return;

  window.removeEventListener(toggleEvent, listener);
  window.removeEventListener("toggle-design-token-panel", listener);
  delete script.__zdtpPrehydrateListener;

  const pending = Number(script.dataset.pending ?? "0");
  delete script.dataset.pending;
  if (Number.isFinite(pending) && pending % 2 === 1) {
    window.dispatchEvent(new CustomEvent(toggleEvent));
  }
}

/** Preserve the owner-autoload console helpers without eagerly importing zdtp. */
export function installOwnerConsoleHelpers(
  getConfig: () => PanelConfig,
  importer?: () => Promise<ZdtpModule>,
): void {
  if (typeof window === "undefined") return;
  const config = getConfig();
  const target = window as unknown as Record<string, Record<string, unknown> | undefined>;
  target[config.consoleNamespace] = {
    ...target[config.consoleNamespace],
    enableAutoload: async () => {
      const zdtp = await loadZdtp(importer);
      if (!zdtp) return;
      zdtp.configurePanel(getConfig());
      zdtp.enableAutoload(getConfig());
    },
    disableAutoload: async () => {
      const zdtp = await loadZdtp(importer);
      if (!zdtp) return;
      zdtp.disableAutoload(getConfig());
    },
  };
}
