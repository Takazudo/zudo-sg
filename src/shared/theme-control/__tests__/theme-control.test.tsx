import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
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
  cleanup();
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
    render(<ThemeControl />);
    const button = screen.getByRole("button", { name: "Switch to dark theme" });

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.className).toContain("min-h-[44px]");
    expect(button.className).toContain("min-w-[44px]");
    expect(button.className).toContain("focus-visible:outline-focus");
    expect(button.querySelector("[aria-hidden=true]")).not.toBeNull();
  });

  it("flips root state and persists the selected value without navigation", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeControl />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("activates from the keyboard", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeControl />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps separately mounted controls synchronized through the root attribute", async () => {
    document.documentElement.dataset.theme = "light";
    render(
      <>
        <ThemeControl />
        <ThemeControl />
      </>,
    );
    const [first, second] = screen.getAllByRole("button");

    fireEvent.click(first!);
    await waitFor(() => {
      expect(second).toHaveAttribute("aria-pressed", "true");
      expect(second).toHaveAccessibleName("Switch to light theme");
    });
  });

  it("syncs controls when an external root update changes the theme", async () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeControl />);
    const control = screen.getByRole("button");

    document.documentElement.dataset.theme = "dark";
    await waitFor(() => {
      expect(control).toHaveAttribute("aria-pressed", "true");
      expect(control).toHaveAccessibleName("Switch to light theme");
    });
  });
});
