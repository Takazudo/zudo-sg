// Ambient module for the "virtual:zdtp-apply-config" specifier registered by
// plugins/zdtp-apply-proxy-plugin.mjs's `setup` hook via `addVirtualModule`.
// TypeScript has no other way to resolve a synthetic bundler-only module
// specifier — this declaration exists purely so
// src/config/preview-token-panel-config.ts type-checks. Both exports resolve
// to `undefined` outside `zfb dev` (see the plugin for why).
declare module "virtual:zdtp-apply-config" {
  import type { ApplyRoutingMap } from "@takazudo/zdtp/server";

  export const applyEndpoint: string | undefined;
  export const applyRouting: ApplyRoutingMap | undefined;
}
