import type { Child } from "@takazudo/zfb/zudo-react";
import { renderSsr } from "../../test-utils/zudo-react";

/** Render static content components into a queryable DOM root. */
export function renderStatic(node: Child): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = renderSsr(node);
  return root;
}
