// Shared roving-tabindex keyboard behaviour for a horizontal `role="tablist"`
// (WAI-ARIA APG "tabs" pattern, automatic activation). Extracted from
// `preview/detail-workbench.tsx`'s original `onTabKeyDown` (#899/#900) so
// `DetailWorkbench` and `code-panel/code-panel.tsx` share one implementation
// instead of drifting copies.

/**
 * Resolves the tab index a tablist keydown moves focus to. ArrowRight/
 * ArrowLeft wrap around the ends; Home/End jump to them. Returns `undefined`
 * for any other key, so callers can let the event bubble untouched.
 */
export function nextTablistIndex(
  key: string,
  index: number,
  length: number,
): number | undefined {
  if (length <= 0) return undefined;
  if (key === "ArrowRight") return (index + 1) % length;
  if (key === "ArrowLeft") return (index - 1 + length) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return undefined;
}

/**
 * Shared keydown handler for a roving-tabindex tablist: moves focus to the
 * target tab AND activates it in the same keystroke (APG "automatic
 * activation"). `activate` selects the tab at the resolved index; `focusTab`
 * moves DOM focus there — callers differ in how they look up their tab
 * elements, so both are left to the caller.
 */
export function handleTablistKeyDown(
  e: KeyboardEvent,
  index: number,
  length: number,
  activate: (index: number) => void,
  focusTab: (index: number) => void,
): void {
  const next = nextTablistIndex(e.key, index, length);
  if (next === undefined) return;
  e.preventDefault();
  activate(next);
  focusTab(next);
}
