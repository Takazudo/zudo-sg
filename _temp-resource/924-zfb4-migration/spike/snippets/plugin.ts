import { fileURLToPath } from "node:url";
export default { name: "zfb4-spike-routes", setup(ctx) { ctx.injectRoute("/foo", fileURLToPath(new URL("./routes-src/foo.tsx", import.meta.url))); } };
