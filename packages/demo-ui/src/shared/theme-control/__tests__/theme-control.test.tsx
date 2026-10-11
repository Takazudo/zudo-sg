import { disposeAll, fire, renderIsland, flushAll, getByRole, queryAllByRole, renderSsr } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "../theme-control";
import {
  applyStoredTheme,
  applyTheme,
  createThemePrepaintScript,
  DEFAULT_THEME,
  isTheme,
  readStoredTheme,
  storeTheme,
  THEME_STORAGE_KEY,
} from "../theme-state";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const throwingStorage = {
  getItem(): never {
    throw new Error("storage unavailable");
  },
  setItem(): never {
    throw new Error("storage unavailable");
  },
};

afterEach(() => {
  disposeAll();
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

describe("theme state", () => {
  it("accepts only light and dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("applies valid root state and normalizes malformed root state to light", () => {
    const root = document.documentElement;
    expect(applyTheme("dark", root)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(applyTheme("system", root)).toBe(DEFAULT_THEME);
    expect(root.dataset.theme).toBe(DEFAULT_THEME);
  });

  it("reads and writes only valid saved selections", () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, "dark");
    expect(readStoredTheme(storage)).toBe("dark");
    expect(storeTheme("light", storage)).toBe(true);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(storeTheme("system" as never, storage)).toBe(false);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
    storage.setItem(THEME_STORAGE_KEY, "system");
    expect(readStoredTheme(storage)).toBe(DEFAULT_THEME);
  });

  it("falls back to light when storage is missing or throws", () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
    expect(readStoredTheme(throwingStorage)).toBe(DEFAULT_THEME);
    expect(storeTheme("dark", throwingStorage)).toBe(false);
    expect(() => applyStoredTheme(document.documentElement, throwingStorage)).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME);
  });

  it("emits an exception-safe prepaint script that restores only a valid stored value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    new Function(createThemePrepaintScript())();
    expect(document.documentElement.dataset.theme).toBe("dark");

    window.localStorage.setItem(THEME_STORAGE_KEY, "invalid");
    new Function(createThemePrepaintScript())();
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME);
  });
});

describe("ThemeControl", () => {
  it("uses a native button with the next-action name, pressed state, and semantic focus treatment", () => {
    document.documentElement.dataset.theme = "light";
    const { container } = renderIsland(ThemeControl, {});
    const button = getByRole(container, "button", { name: "Switch to dark theme" });

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.classList.contains("min-h-[44px]")).toBe(true);
    expect(button.classList.contains("min-w-[44px]")).toBe(true);
    expect(button.classList.contains("focus-visible:outline-focus")).toBe(true);
    expect(button.querySelector("[aria-hidden=true]")).not.toBeNull();
  });

  it("flips root state and persists the selected value without navigation", async () => {
    document.documentElement.dataset.theme = "light";
    const { container } = renderIsland(ThemeControl, {});
    fire(getByRole(container, "button", { name: "Switch to dark theme" }), "click");
    await flushAll();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(getByRole(container, "button", { name: "Switch to light theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("activates from the keyboard", async () => {
    document.documentElement.dataset.theme = "light";
    const { container } = renderIsland(ThemeControl, {});
    fire(getByRole(container, "button"), "keydown", { key: "Enter" });
    await flushAll();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(getByRole(container, "button", { name: "Switch to light theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps separately mounted controls synchronized through the root attribute", async () => {
    document.documentElement.dataset.theme = "light";
    const { container } = renderIsland(function Fixture() {
      return (
        <>
          <ThemeControl />
          <ThemeControl />
        </>
      );
    }, {});
    const [first, second] = queryAllByRole(container, "button");

    fire(first!, "click");
    await flushAll();
    await vi.waitFor(async () => {
      await flushAll();
      expect(second).toHaveAttribute("aria-pressed", "true");
      expect(second).toHaveAccessibleName("Switch to light theme");
    });
  });

  it("syncs controls when an external root update changes the theme", async () => {
    document.documentElement.dataset.theme = "light";
    const { container } = renderIsland(ThemeControl, {});
    const control = getByRole(container, "button");

    document.documentElement.dataset.theme = "dark";
    await vi.waitFor(async () => {
      await flushAll();
      expect(control).toHaveAttribute("aria-pressed", "true");
      expect(control).toHaveAccessibleName("Switch to light theme");
    });
  });

  it("hydrates the stable SSR fallback before syncing a prepainted dark root", async () => {
    document.documentElement.dataset.theme = "dark";
    const html = renderSsr(<ThemeControl />);
    expect(html).toContain('aria-pressed="false"');
    const fixture = renderIsland(ThemeControl, {});
    await fixture.flush();
    expect(getByRole(fixture.container, "button", { name: "Switch to light theme" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(fixture.diagnostics).toEqual([]);
  });

  it("disconnects its observer and removes activation handlers on disposal", async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const onThemeChange = vi.fn();
    try {
      const fixture = renderIsland(function Fixture() {
        return <ThemeControl onThemeChange={onThemeChange} />;
      }, {});
      const button = getByRole(fixture.container, "button");
      fixture.dispose();
      expect(disconnect).toHaveBeenCalledOnce();
      fire(button, "click");
      fire(button, "keydown", { key: "Enter" });
      document.documentElement.dataset.theme = "dark";
      await flushAll();
      expect(onThemeChange).not.toHaveBeenCalled();
    } finally {
      disconnect.mockRestore();
    }
  });

  it("handles Space once and ignores repeated or unrelated keys", async () => {
    const onThemeChange = vi.fn();
    const { container } = renderIsland(function Fixture() {
        return <ThemeControl onThemeChange={onThemeChange} />;
      }, {});
    const button = getByRole(container, "button");
    fire(button, "keydown", { key: " ", repeat: true });
    fire(button, "keydown", { key: "Escape" });
    expect(onThemeChange).not.toHaveBeenCalled();
    fire(button, "keydown", { key: " " });
    await flushAll();
    expect(onThemeChange).toHaveBeenCalledExactlyOnceWith("dark");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

});
