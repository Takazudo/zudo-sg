import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { externalCatalogKey } from "@takazudo/zudo-sg/registry/external-catalog";
import { thumbnailFromExternalCapture, validateExternalCatalogOutputs } from "@takazudo/zudo-sg/registry/external-catalog-node";
const require = createRequire(import.meta.url);
const source = await readFile("preview/Laboratory.tsx", "utf8");
const manifest = ["Default", "Alternate"].map(variant => {
  const key = externalCatalogKey("react-laboratory", variant);
  const fixture = { module: "./preview/Laboratory.tsx", exportName: "Laboratory" };
  return { slug: "react-laboratory", variant, loader: { key, ...fixture }, source: { key, code: source }, capture: { kind: "image", key, fixture, src: `/captures/${variant}.png`, width: 640, height: 420 } };
});
const descriptors = [{ id: "react-laboratory", slug: "react-laboratory", category: "React", title: "React laboratory", sourcePath: "preview/Laboratory.tsx", thumbnail: thumbnailFromExternalCapture(manifest[0].capture), variants: manifest.map(row => ({ exportName: row.variant, name: row.variant, source: row.source, controls: [{ type: "text", prop: "label", label: "Label", defaultValue: "React laboratory" }, { type: "select", prop: "failure", label: "Failure", options: ["none", "render", "import"], defaultValue: "none" }] })) }];
const outputs = { manifest, descriptors, loaders: manifest.map(row => row.loader), sources: manifest.map(row => row.source) };
validateExternalCatalogOutputs(outputs);
await mkdir("src/styleguide", { recursive: true });
await mkdir("artifacts", { recursive: true });
await mkdir("public/frame", { recursive: true });
await writeFile("artifacts/catalog.json", JSON.stringify(outputs, null, 2));
await writeFile("src/story-descriptors.ts", `import type { StoryDescriptor } from "@takazudo/zudo-sg/registry";\nexport const storyDescriptors: StoryDescriptor[] = ${JSON.stringify(descriptors, null, 2)};\nexport default storyDescriptors;\n`);
await writeFile("preview/loaders.ts", `import type { ComponentType } from "react";\nimport type { SerializableProps } from "@takazudo/zudo-sg/preview/external-runtime";\nexport const loaders: Record<string, () => Promise<ComponentType<SerializableProps>>> = {\n${manifest.map(row => `${JSON.stringify(row.loader.key)}: () => import("../${row.loader.module.slice(2).replace(/\.tsx$/, "")}").then(module => module.${row.loader.exportName}),`).join("\n")}\n};\n`);
// Monaco also vendors DOMPurify. The package override alone cannot repair that copy.
const sanitizer = {
  name: "fixture-monaco-patched-sanitizer",
  setup(builder) {
    builder.onResolve({ filter: /^\.\/dompurify\/dompurify\.js$/ }, args => {
      if (!/[\\/]monaco-editor[\\/]esm[\\/]vs[\\/]base[\\/]browser[\\/]domSanitize\.js$/.test(args.importer)) return;
      return { path: path.join(path.dirname(require.resolve("dompurify")), "purify.es.mjs") };
    });
  },
};
const result = await build({ entryPoints: { entry: "preview/entry.tsx", "json.worker": require.resolve("monaco-editor/language/json/json.worker.js"), "editor.worker": require.resolve("monaco-editor/editor/editor.worker.js") }, bundle: true, splitting: true, format: "esm", target: "es2022", outdir: "public/preview-assets", metafile: true, loader: { ".ttf": "file" }, assetNames: "assets/[name]-[hash]", plugins: [sanitizer], tsconfig: "preview/tsconfig.json" });
const inputs = Object.keys(result.metafile.inputs);
if (inputs.some(name => /monaco-editor.*\/dompurify\/dompurify\.js$/.test(name)) || !inputs.some(name => /dompurify.*\/purify\.es\.mjs$/.test(name))) throw new Error("Patched sanitizer must replace Monaco's vendored module in actual emitted graph");
await writeFile("artifacts/preview-metafile.json", JSON.stringify(result.metafile, null, 2));
await writeFile("public/frame/index.html", '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../preview-assets/entry.css"><title>React external preview</title></head><body><div id="root"></div><script type="module" src="../preview-assets/entry.js"></script></body></html>');
console.log("Generated canonical catalog and external React/worker graph");
