// Ambient types for the zfb virtual module registered by
// `@takazudo/zudo-sg/plugins/zdtp-apply-proxy` (src/plugins/zdtp-apply-proxy.ts).
// `applyEndpoint` / `applyRouting` are `undefined` outside `zfb dev`; `tabs` is
// `undefined` when the plugin has no `tabsModule` option.
declare module "virtual:zudo-sg-preview-token-panel" {
  import type { TabConfig } from "@takazudo/zdtp";
  import type { ApplyRoutingMap } from "@takazudo/zdtp/server";

  export const tabs: readonly TabConfig[] | undefined;
  export const applyEndpoint: string | undefined;
  export const applyRouting: ApplyRoutingMap | undefined;
}
