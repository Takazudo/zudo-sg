// zfb.config.ts — descriptor-host fixture (epic #879, S7).
//
// A foreign-framework consumer of `@takazudo/zudo-sg`: it registers stories
// as plain-data `StoryDescriptor`s (never a `.stories.tsx`, never `react`)
// and serves its own external preview document instead of the in-engine
// preview route. `withZudoSg` still appends the engine's plugins after
// `zudoDoc()`'s own — the routes plugin requires `packageOwnedRoutes: true`,
// which `zudoDoc()` defaults on.
import { defineConfig } from "@takazudo/zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { withZudoSg } from "@takazudo/zudo-sg/config";
import zudoSgConfig from "./zudo-sg.config.mjs";

export default defineConfig(
  withZudoSg(
    zudoDoc({
      siteName: "Descriptor Host Fixture",
      base: "/styleguide/",
      port: 4399,
      favicon: "auto",
      mermaid: false,
      strictContentBridge: true,
      dynamicPageTransition: true,
    }),
    zudoSgConfig,
  ),
);
