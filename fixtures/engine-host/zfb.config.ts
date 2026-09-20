// zfb.config.ts — styleguide starter configuration.
//
// This minimal zudo-doc site demonstrates a host application. `withZudoSg`
// appends the engine's plugins and collections after `zudoDoc()`'s own — the
// routes plugin requires `packageOwnedRoutes: true`, which `zudoDoc()`
// defaults on.
import { defineConfig } from "@takazudo/zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { withZudoSg } from "@takazudo/zudo-sg/config";
import zudoSgConfig from "./zudo-sg.config.mjs";

export default defineConfig(
  withZudoSg(
    zudoDoc({
      siteName: "Styleguide Starter",
      base: "/styleguide/",
      port: 4397,
      // The starter ships no public/ icons; replace "auto" with a path or FaviconConfig once real icons exist.
      favicon: "auto",
      // No mermaid diagrams anywhere in this starter's one seed doc; turned
      // off rather than leaving the default on to keep the dependency set
      // minimal (see package.json).
      mermaid: false,
      strictContentBridge: true,
    }),
    zudoSgConfig,
  ),
);
