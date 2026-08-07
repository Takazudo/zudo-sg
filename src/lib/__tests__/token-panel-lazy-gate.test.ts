/**
 * Local integration contract around zudo-doc 5.2's native lazy bootstrap.
 * Upstream owns import retry, persisted-state probing, current-channel
 * replacement, and in-flight deduplication; these tests ensure both local
 * instances enter that bootstrap without pulling zdtp during hydration and
 * retain their project-owned pre-hydration/console seams.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  nativeBootstrap: vi.fn(),
  configurePanel: vi.fn(),
  enableAutoload: vi.fn(),
  disableAutoload: vi.fn(),
}));

vi.mock("@takazudo/zudo-doc/design-token-panel-bootstrap", () => ({
  bootstrapDesignTokenPanel: mocks.nativeBootstrap,
}));
vi.mock("@takazudo/zdtp", () => ({
  configurePanel: mocks.configurePanel,
  enableAutoload: mocks.enableAutoload,
  disableAutoload: mocks.disableAutoload,
}));
vi.mock("@/config/design-token-panel-config", () => ({
  buildDesignTokenPanelConfig: (mode: "light" | "dark") => ({
    storagePrefix: "sg-doc-tweak",
    consoleNamespace: "sgDoc",
    modalClassPrefix: "sg-doc-modal",
    schemaId: "doc/v1",
    exportFilenameBase: "doc",
    toggleEvent: "toggle-sg-doc-tweak",
    tabs: [],
    mode,
  }),
}));
vi.mock("@/config/preview-token-panel-config", () => ({
  previewTokenPanelConfig: {
    storagePrefix: "sg-preview-tweak",
    consoleNamespace: "sgPreview",
    modalClassPrefix: "sg-preview-modal",
    schemaId: "preview/v1",
    exportFilenameBase: "preview",
    toggleEvent: "toggle-preview-token-panel",
    tabs: [],
  },
}));

interface Harness {
  component: string;
  namespace: "sgDoc" | "sgPreview";
  scriptId: string;
  toggleEvent: string;
  storagePrefix: string;
}

const harnesses: Harness[] = [
  {
    component: "@/components/design-token-panel-bootstrap",
    namespace: "sgDoc",
    scriptId: "zdtp-doc-prehydrate",
    toggleEvent: "toggle-sg-doc-tweak",
    storagePrefix: "sg-doc-tweak",
  },
  {
    component: "@/components/preview-token-panel-bootstrap",
    namespace: "sgPreview",
    scriptId: "zdtp-preview-prehydrate",
    toggleEvent: "toggle-preview-token-panel",
    storagePrefix: "sg-preview-tweak",
  },
];

type ConsoleHelpers = {
  enableAutoload(): Promise<void>;
  disableAutoload(): Promise<void>;
};

describe.each(harnesses)("native token-panel bootstrap — $namespace", (harness) => {
  beforeEach(() => {
    vi.resetModules();
    mocks.nativeBootstrap.mockReset();
    mocks.configurePanel.mockReset();
    mocks.enableAutoload.mockReset();
    mocks.disableAutoload.mockReset();
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.replaceChildren();
    delete (window as unknown as Record<string, unknown>)[harness.namespace];
  });

  afterEach(() => vi.restoreAllMocks());

  async function hydrate(): Promise<void> {
    const module = await import(/* @vite-ignore */ harness.component) as { default(): void };
    module.default();
  }

  it("registers one native lazy bootstrap and does not import zdtp at hydration", async () => {
    await hydrate();
    await hydrate();

    expect(mocks.nativeBootstrap).toHaveBeenCalledTimes(1);
    const builder = mocks.nativeBootstrap.mock.calls[0]?.[0] as () => { storagePrefix: string };
    expect(builder().storagePrefix).toBe(harness.storagePrefix);
    expect(mocks.configurePanel).not.toHaveBeenCalled();
  });

  it("replays an odd pre-hydration click on only its instance channel", async () => {
    const script = document.createElement("script") as HTMLScriptElement & {
      __zdtpPrehydrateListener?: EventListener;
    };
    script.id = harness.scriptId;
    script.dataset.pending = "1";
    script.__zdtpPrehydrateListener = vi.fn();
    document.body.append(script);
    const own = vi.fn();
    const other = vi.fn();
    const otherEvent =
      harness.toggleEvent === "toggle-sg-doc-tweak"
        ? "toggle-preview-token-panel"
        : "toggle-sg-doc-tweak";
    window.addEventListener(harness.toggleEvent, own);
    window.addEventListener(otherEvent, other);

    await hydrate();

    expect(own).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    window.removeEventListener(harness.toggleEvent, own);
    window.removeEventListener(otherEvent, other);
  });

  it("drains a fresh soft-navigation capture without registering twice", async () => {
    await hydrate();
    const script = document.createElement("script") as HTMLScriptElement & {
      __zdtpPrehydrateListener?: EventListener;
    };
    script.id = harness.scriptId;
    script.dataset.pending = "1";
    script.__zdtpPrehydrateListener = vi.fn();
    document.body.append(script);
    const replayed = vi.fn();
    window.addEventListener(harness.toggleEvent, replayed, { once: true });

    await hydrate();

    expect(mocks.nativeBootstrap).toHaveBeenCalledTimes(1);
    expect(replayed).toHaveBeenCalledTimes(1);
    expect(script.__zdtpPrehydrateListener).toBeUndefined();
  });

  it("keeps owner-autoload helpers lazy and instance-scoped", async () => {
    await hydrate();
    const helpers = (window as unknown as Record<string, ConsoleHelpers>)[harness.namespace];

    await helpers.enableAutoload();
    expect(mocks.configurePanel).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: harness.storagePrefix }),
    );
    expect(mocks.enableAutoload).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: harness.storagePrefix }),
    );

    await helpers.disableAutoload();
    expect(mocks.disableAutoload).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: harness.storagePrefix }),
    );
  });
});
