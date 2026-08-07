import type { PanelConfig } from "@takazudo/zdtp";

type PrehydrateScript = HTMLScriptElement & {
  __zdtpPrehydrateListener?: EventListener;
};

/**
 * Drain the first toggle captured by the SSR script before this island mounted.
 * State lives on the script element, not in a window-global queue, so the two
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
export function installOwnerConsoleHelpers(getConfig: () => PanelConfig): void {
  if (typeof window === "undefined") return;
  const config = getConfig();
  const target = window as unknown as Record<string, Record<string, unknown> | undefined>;
  target[config.consoleNamespace] = {
    ...target[config.consoleNamespace],
    enableAutoload: async () => {
      const zdtp = await import("@takazudo/zdtp");
      zdtp.configurePanel(getConfig());
      zdtp.enableAutoload(getConfig());
    },
    disableAutoload: async () => {
      const zdtp = await import("@takazudo/zdtp");
      zdtp.disableAutoload(getConfig());
    },
  };
}
