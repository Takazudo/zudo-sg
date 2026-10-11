import { Island } from "@takazudo/zfb";
import { ThemeControl } from "@zudo-sg/demo-ui/src/shared/theme-control/theme-control.tsx";

/** Server boundary around demo-ui's uniquely registered client island. */
export function ThemeControlIsland() {
  return (
    <Island when="load" ssrFallback={null}>
      <ThemeControl />
    </Island>
  );
}
