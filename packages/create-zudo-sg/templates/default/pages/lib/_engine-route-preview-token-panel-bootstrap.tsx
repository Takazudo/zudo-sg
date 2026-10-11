"use client";

import { getScope, signal, Show } from "@takazudo/zfb/zudo-react";
import PreviewTokenPanelBootstrap from "@takazudo/zudo-sg/token-tweak/preview-token-panel-bootstrap";

export default function EngineRoutePreviewTokenPanelBootstrap() {
  // Route detection needs the browser DOM. Keep the initial component regions
  // identical on the server and client, then mount the bootstrap on activation.
  const active = signal(false);
  getScope().onActivate(() => {
    active.value = Boolean(document.querySelector("[data-sg-engine-route]"));
  });
  return <Show when={active}>{() => <PreviewTokenPanelBootstrap />}</Show>;
}
