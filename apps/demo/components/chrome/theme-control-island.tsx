"use client";

import { ThemeControl } from "@zudo-sg/ui/src/shared/theme-control/theme-control.tsx";

/**
 * Scanner-visible client wrapper around the shared Preact-hook control.
 * DefaultLayout's `<Island ssrFallback={null}>` owns the server skip boundary;
 * this component is what zfb registers and mounts after load.
 */
export function ThemeControlIsland() {
  return <ThemeControl />;
}
