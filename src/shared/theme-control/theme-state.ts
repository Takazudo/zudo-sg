/**
 * Shared light/dark theme state for the demo site.
 *
 * The document root is deliberately the runtime source of truth. CSS resolves
 * the semantic tokens through `:root[data-theme]` and `light-dark()`; no
 * component-specific dark-mode classes or duplicate theme styles belong here.
 */

export const THEME_VALUES = ["light", "dark"] as const;
export type Theme = (typeof THEME_VALUES)[number];

export const DEFAULT_THEME: Theme = "light";
export const THEME_STORAGE_KEY = "zudo-sg-demo-theme";

export type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

/** Runtime validator shared by storage, root application, and the control. */
export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEME_VALUES as readonly string[]).includes(value);
}

/** Resolve an unknown value without leaking malformed state to the root. */
export function normalizeTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

function documentRoot(): HTMLElement | undefined {
  return typeof document === "undefined" ? undefined : document.documentElement;
}

function browserStorage(): ThemeStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Read a saved selection without trusting storage availability or contents.
 * Storage access is optional because SSR, privacy modes, and test environments
 * can all make it unavailable.
 */
export function readStoredTheme(storage: ThemeStorage | null | undefined = browserStorage()): Theme {
  try {
    return normalizeTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Persist only a valid selection. A failed or unavailable store is intentionally
 * non-fatal: the root still receives the selected theme for the current page.
 */
export function storeTheme(
  theme: Theme,
  storage: ThemeStorage | null | undefined = browserStorage(),
): boolean {
  if (!isTheme(theme) || !storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** Read the root's authoritative selection, with the light fallback. */
export function themeFromRoot(root: HTMLElement | null | undefined = documentRoot()): Theme {
  return normalizeTheme(root?.dataset.theme);
}

/**
 * Apply a validated selection to exactly one place: `document.documentElement`.
 * `colors.css` owns `color-scheme` and semantic color resolution from there.
 */
export function applyTheme(
  theme: unknown,
  root: HTMLElement | null | undefined = documentRoot(),
): Theme {
  const next = normalizeTheme(theme);
  if (root) root.dataset.theme = next;
  return next;
}

/** Restore the persisted selection to the root, falling back to light. */
export function applyStoredTheme(
  root: HTMLElement | null | undefined = documentRoot(),
  storage: ThemeStorage | null | undefined = browserStorage(),
): Theme {
  return applyTheme(readStoredTheme(storage), root);
}

/**
 * Inline script for the document `<head>`, before the stylesheet visibly
 * paints. It is self-contained and guards both storage and DOM edge cases.
 */
export function createThemePrepaintScript(): string {
  const values = JSON.stringify(THEME_VALUES);
  const fallback = JSON.stringify(DEFAULT_THEME);
  const key = JSON.stringify(THEME_STORAGE_KEY);

  return `(()=>{var root=document.documentElement;var fallback=${fallback};try{var value=window.localStorage.getItem(${key});root.dataset.theme=${values}.indexOf(value)!==-1?value:fallback}catch(_){root.dataset.theme=fallback}})();`;
}

/** Ready-to-emit prepaint source for an SSR layout. */
export const THEME_PREPAINT_SCRIPT = createThemePrepaintScript();
