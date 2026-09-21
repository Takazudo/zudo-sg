// @vitest-environment happy-dom
// The preview panel's native lazy-bootstrap contract:
// hydration enters zudo-doc's bootstrap once without importing zdtp, drains
// the SSR pre-hydration toggle on its own channel, keeps owner console helpers
// lazy, and handles a failed zdtp import without an unhandled rejection.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertValidPanelConfig } from "@takazudo/zdtp/testing";

const mocks = vi.hoisted(() => ({
  nativeBootstrap: vi.fn(),
  configurePanel: vi.fn(),
  enableAutoload: vi.fn(),
  disableAutoload: vi.fn(),
  tabs: undefined as unknown,
}));

vi.mock("@takazudo/zudo-doc/design-token-panel-bootstrap", () => ({
  bootstrapDesignTokenPanel: mocks.nativeBootstrap,
}));
vi.mock("@takazudo/zdtp", () => ({
  configurePanel: mocks.configurePanel,
  enableAutoload: mocks.enableAutoload,
  disableAutoload: mocks.disableAutoload,
}));
vi.mock("virtual:zudo-sg-preview-token-panel", () => ({
  get tabs() {
    return mocks.tabs;
  },
  applyEndpoint: "/__zdtp/apply",
  applyRouting: { palette: "colors.css" },
}));

const TABS = [
  {
    id: "spacing",
    label: "Spacing",
    tiers: [
      {
        id: "hsp",
        label: "Horizontal",
        items: [
          {
            id: "hsp-md",
            cssVar: "--spacing-hsp-md",
            label: "md",
            default: "1rem",
            type: { kind: "length", unit: "rem", step: 0.125 },
          },
        ],
      },
    ],
  },
];

type ConsoleHelpers = { enableAutoload(): Promise<void>; disableAutoload(): Promise<void> };
type PrehydrateScript = HTMLScriptElement & { __zdtpPrehydrateListener?: EventListener };

async function hydrate(): Promise<void> {
  const module = await import("../preview-token-panel-bootstrap.js");
  module.default();
}

beforeEach(() => {
  vi.resetModules();
  mocks.nativeBootstrap.mockReset();
  mocks.configurePanel.mockReset();
  mocks.enableAutoload.mockReset();
  mocks.disableAutoload.mockReset();
  mocks.tabs = TABS;
  document.body.replaceChildren();
  delete (window as unknown as Record<string, unknown>).sgPreview;
});

afterEach(() => vi.restoreAllMocks());

describe("PreviewTokenPanelBootstrap island", () => {
  it("registers one native lazy bootstrap with the virtual module's data and does not import zdtp", async () => {
    await hydrate();
    await hydrate();

    expect(mocks.nativeBootstrap).toHaveBeenCalledTimes(1);
    const builder = mocks.nativeBootstrap.mock.calls[0]?.[0] as () => Record<string, unknown>;
    const config = builder();
    expect(config).toMatchObject({
      storagePrefix: "sg-preview-tweak",
      consoleNamespace: "sgPreview",
      toggleEvent: "toggle-preview-token-panel",
      tabs: TABS,
      applyEndpoint: "/__zdtp/apply",
      applyRouting: { palette: "colors.css" },
    });
    expect(builder()).toBe(config);
    expect(() => assertValidPanelConfig(config as never)).not.toThrow();
    expect(mocks.configurePanel).not.toHaveBeenCalled();
  });

  it("renders nothing and bootstraps nothing when the host configured no tabsModule", async () => {
    mocks.tabs = undefined;
    await hydrate();
    expect(mocks.nativeBootstrap).not.toHaveBeenCalled();
    expect((window as unknown as Record<string, unknown>).sgPreview).toBeUndefined();
  });

  it("replays an odd pre-hydration click on only the preview channel", async () => {
    const script = document.createElement("script") as PrehydrateScript;
    script.id = "zdtp-preview-prehydrate";
    script.dataset.pending = "1";
    script.__zdtpPrehydrateListener = vi.fn();
    document.body.append(script);
    const own = vi.fn();
    const other = vi.fn();
    window.addEventListener("toggle-preview-token-panel", own);
    window.addEventListener("toggle-sg-doc-tweak", other);

    await hydrate();

    expect(own).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(script.__zdtpPrehydrateListener).toBeUndefined();
    window.removeEventListener("toggle-preview-token-panel", own);
    window.removeEventListener("toggle-sg-doc-tweak", other);
  });

  it("keeps owner-autoload helpers lazy and instance-scoped", async () => {
    await hydrate();
    const helpers = (window as unknown as Record<string, ConsoleHelpers>).sgPreview!;

    await helpers.enableAutoload();
    expect(mocks.configurePanel).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: "sg-preview-tweak" }),
    );
    expect(mocks.enableAutoload).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: "sg-preview-tweak" }),
    );

    await helpers.disableAutoload();
    expect(mocks.disableAutoload).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: "sg-preview-tweak" }),
    );
  });
});

describe("@takazudo/zdtp import failure guards (owner console helpers)", () => {
  it("resolves instead of rejecting and warns when zdtp cannot be imported", async () => {
    const { installOwnerConsoleHelpers, loadZdtp } = await import("../token-panel-native-bootstrap.js");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = () => Promise.reject(new Error("Cannot find package '@takazudo/zdtp'"));

    await expect(loadZdtp(missing)).resolves.toBeNull();

    installOwnerConsoleHelpers(
      () => ({ consoleNamespace: "sgPreview", storagePrefix: "sg-preview-tweak" }) as never,
      missing,
    );
    const helpers = (window as unknown as Record<string, ConsoleHelpers>).sgPreview!;
    await expect(helpers.enableAutoload()).resolves.toBeUndefined();
    await expect(helpers.disableAutoload()).resolves.toBeUndefined();
    expect(mocks.configurePanel).not.toHaveBeenCalled();
    expect(mocks.enableAutoload).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
