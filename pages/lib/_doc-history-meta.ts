import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ZfbPlugin } from "@takazudo/zfb/plugins";
import type { ChromeHostBindings } from "@takazudo/zudo-doc/factory-context";

// Node-side plugin only: zfb's embedded page renderer cannot call node:fs.
// The chrome bindings import the generated data module through this alias.
const moduleSpecifier = "virtual:zudo-sg-doc-history-meta";
const generatedModulePath = ".zfb/doc-history-meta.mjs";

export function loadDocHistoryMeta(
  projectRoot: string,
): NonNullable<ChromeHostBindings["docHistoryMeta"]> {
  const metadataPath = resolve(projectRoot, ".zfb/doc-history-meta.json");
  return existsSync(metadataPath)
    ? JSON.parse(readFileSync(metadataPath, "utf8"))
    : {};
}

export default {
  name: "doc-history-meta",
  setup(ctx) {
    // Virtual-module loaders run eagerly during setup, before doc-history's
    // preBuild writes fresh metadata. An alias defers the file read until the
    // page bundle is built, after every preBuild hook has finished.
    ctx.addAlias(moduleSpecifier, generatedModulePath);
  },
  preBuild(ctx) {
    // Registered after the preset plugins so doc-history generates JSON first.
    const metadata = JSON.stringify(loadDocHistoryMeta(ctx.projectRoot));
    const outputPath = resolve(ctx.projectRoot, generatedModulePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    // Parse a quoted JSON string rather than interpreting metadata as JS. This
    // also preserves literal keys such as __proto__ as ordinary data keys.
    writeFileSync(
      outputPath,
      `export const docHistoryMeta = JSON.parse(${JSON.stringify(metadata)});\n`,
      "utf8",
    );
  },
} satisfies ZfbPlugin;
