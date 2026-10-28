// D1: the engine owns this opaque dashboard boundary. zdtp >= 0.9 mounts through the host's zudo-react runtime and throws on a non-empty host.
import { mountTokenDashboard, type TokenDashboardProps } from "@takazudo/zdtp/dashboard/client";

export function mountDashboard(host: HTMLElement, props: TokenDashboardProps): () => void {
  const handle = mountTokenDashboard(host, props);
  return () => handle.dispose();
}
