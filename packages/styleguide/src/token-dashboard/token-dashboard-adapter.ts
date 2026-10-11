// D1: the engine owns this opaque Preact renderer boundary.
import { h, render } from "preact";
import { TokenDashboard, type TokenDashboardProps } from "@takazudo/zdtp/dashboard";

export function mountDashboard(host: HTMLElement, props: TokenDashboardProps): () => void {
  render(h(TokenDashboard, props), host);
  return () => render(null, host);
}
