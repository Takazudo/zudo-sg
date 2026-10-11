import { defineConfig } from "@takazudo/zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
const preset = zudoDoc({ siteName: "Spike", packageOwnedRoutes: true, chromeBindingsModule: "./src/chrome-bindings.tsx", docHistory: false, dynamicPageTransition: false });
export default defineConfig({ ...preset, plugins: [...(preset.plugins ?? []), { name: "zfb4-spike-routes" }] });
