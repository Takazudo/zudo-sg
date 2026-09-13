import { useEffect, useState } from "preact/hooks";
import { cx } from "../../lib/cx";
import {
  applyTheme,
  nextTheme,
  storeTheme,
  themeFromRoot,
  type Theme,
} from "./theme-state";

export type ThemeControlProps = {
  /** Optional consumer layout hook; visual colors remain semantic tokens. */
  class?: string;
  /** Notifies a host after the root selection has changed. */
  onThemeChange?: (theme: Theme) => void;
};

const CONTROL_CLASS =
  "inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center " +
  "rounded-md border border-border bg-surface text-fg transition-colors hover:bg-surface-2 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * A compact native button that flips the root theme and attempts to persist it.
 * It intentionally owns no dark-mode styles: the root attribute drives the
 * semantic token system in `styles/colors.css`.
 */
export function ThemeControl({ class: className, onThemeChange }: ThemeControlProps) {
  const [theme, setTheme] = useState<Theme>(() => themeFromRoot());

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(themeFromRoot(root));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const selectNextTheme = () => {
    // Always calculate from the root rather than this instance's last render.
    // Desktop and mobile controls hydrate separately, so another control can
    // change the root before this one observes the mutation.
    const next = nextTheme(themeFromRoot());
    applyTheme(next);
    storeTheme(next);
    setTheme(next);
    onThemeChange?.(next);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // Native buttons already expose the right role and focus behavior. Handling
    // the activation keys explicitly also makes the toggle deterministic in
    // embedded hosts that suppress the browser's synthesized click event.
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!event.repeat) selectNextTheme();
  };

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      class={cx(CONTROL_CLASS, className)}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={selectNextTheme}
      onKeyDown={onKeyDown}
    >
      <span aria-hidden="true">{isDark ? "☾" : "☀"}</span>
    </button>
  );
}
