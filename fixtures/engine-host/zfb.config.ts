// zfb.config.ts — engine-host fixture (#665).
//
// The `create-zudo-doc`-shaped minimal zudo-doc site this repo's
// docs/adr/styleguide-engine.md (#665) uses as the foreign-install proof: a
// packed `@takazudo/zudo-sg` tarball, installed OUTSIDE this workspace (a
// fresh `pnpm install` in a temp copy, realpath under `node_modules`), built
// under a non-root `base` ("/styleguide/"). `withZudoSg` appends the engine's
// plugins/collections after `zudoDoc()`'s own (ADR decision 9) — the routes
// plugin requires `packageOwnedRoutes: true`, which `zudoDoc()` defaults on.
import { defineConfig } from "@takazudo/zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { withZudoSg } from "@takazudo/zudo-sg/config";
import zudoSgConfig from "./zudo-sg.config.mjs";

export default defineConfig(
  withZudoSg(
    zudoDoc({
      siteName: "Engine Host Fixture",
      base: "/styleguide/",
      port: 4397,
      // No mermaid diagrams anywhere in this fixture's one seed doc; turned
      // off rather than leaving the default on to keep the dependency set
      // minimal (see package.json).
      mermaid: false,
      strictContentBridge: true,
    }),
    zudoSgConfig,
  ),
);
