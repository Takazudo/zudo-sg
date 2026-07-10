"use client";

// Browser-side bootstrap for @takazudo/zfb-runtime's ClientRouter.
//
// DocLayout renders the ClientRouter meta/style tags during SSR, but the
// click-intercept registration is a browser-side module side effect. This
// island makes sure the client-router module is present in the client bundle.
import "@takazudo/zfb-runtime/client-router";

import type { JSX } from "preact";

function ClientRouterBootstrap(): JSX.Element | null {
  return null;
}

ClientRouterBootstrap.displayName = "ClientRouterBootstrap";

export default ClientRouterBootstrap;
