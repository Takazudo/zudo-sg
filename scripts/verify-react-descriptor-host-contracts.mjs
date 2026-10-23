// Contract checks run against the freshly installed foreign consumer, never repository fixtures.
import { readFile, writeFile, realpath, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(`React descriptor host: ${message}`);
}
const readJson = async filename => JSON.parse(await readFile(filename, "utf8"));
const jsonBytes = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

async function validateBuildInput(hostDir, shouldPass, label) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/validate.mjs"], { cwd: hostDir, env: process.env });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
  assert(shouldPass ? result.code === 0 : result.code === 1,
    `${label}: prebuild validator exited ${result.code}; ${result.stdout}${result.stderr}`);
  if (!shouldPass) assert(/\[zudo-sg\].*(?:external catalog|descriptor)/i.test(result.stderr), `${label}: failed without a catalog diagnostic; ${result.stderr}`);
  return { label, exitCode: result.code, diagnostic: shouldPass ? "accepted" : result.stderr.split("\n").find(line => /Error:/.test(line)) };
}

// Preserve bytes, not reserialized objects, even when a validation subprocess fails.
async function withMutations(changes, run) {
  const originals = await Promise.all(changes.map(async ([filename]) => [filename, await readFile(filename)]));
  try {
    for (const [filename, bytes] of changes) {
      if (bytes === null) await rm(filename);
      else await writeFile(filename, bytes);
    }
    return await run();
  } finally {
    for (const [filename, bytes] of originals) await writeFile(filename, bytes);
  }
}

export function javascriptImports(ts, source) {
  const imports = [];
  const literals = new Set();
  let wasmGlueImport = false;
  const file = ts.createSourceFile("emitted.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isIdentifier(node)) literals.add(node.text);
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        imports.push(node.arguments[0].text);
      } else {
        // zfb-md-wasm imports its emitted glue URL with a recovery-generation query.
        // Follow the concrete resource literal below; reject other opaque imports.
        // esbuild parenthesizes the import expression; Rolldown emits it directly.
        let body = node;
        while (body.parent && ts.isParenthesizedExpression(body.parent)) body = body.parent;
        const arrow = body.parent;
        const binding = arrow && ts.isArrowFunction(arrow) && arrow.body === body && arrow.parent;
        const name = binding && ts.isBindingElement(binding) && binding.propertyName;
        const parameter = arrow && ts.isArrowFunction(arrow) && arrow.parameters.length === 1 && arrow.parameters[0].name;
        assert(name && ts.isIdentifier(name) && name.text === "importGlue"
          && parameter && ts.isIdentifier(parameter)
          && node.arguments.length === 1 && ts.isIdentifier(node.arguments[0])
          && node.arguments[0].text === parameter.text,
        "host bundle contains an untraceable dynamic import");
        wasmGlueImport = true;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (wasmGlueImport) {
    const resources = [...literals].filter(value => /^\.\/islands-resource-zfb_md_wasm_.*glue.*\.mjs(?:\?url)?$/.test(value));
    assert(resources.length === 1, "WASM dynamic import has no unique emitted glue resource");
    imports.push(resources[0]);
  }
  return { imports, literals };
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find(value => value !== undefined);
}

async function generatedCatalog(hostDir, catalog, require) {
  const ts = require("typescript");
  async function initializer(filename, name) {
    const source = await readFile(path.join(hostDir, filename), "utf8");
    const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let value;
    function visit(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) value = node.initializer;
      ts.forEachChild(node, visit);
    }
    visit(file);
    assert(value, `${filename} does not export generated ${name}`);
    return { file, value };
  }
  const descriptors = await initializer("src/story-descriptors.ts", "storyDescriptors");
  assert(JSON.stringify(JSON.parse(descriptors.value.getText(descriptors.file))) === JSON.stringify(catalog.descriptors), "actual descriptor module differs from catalog metadata");
  const loaders = await initializer("preview/loaders.ts", "loaders");
  assert(ts.isObjectLiteralExpression(loaders.value), "actual generated loaders must be an object");
  const keys = [];
  for (const property of loaders.value.properties) {
    assert(ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.name), "actual loader has an unsupported key");
    const key = property.name.text;
    keys.push(key);
    const expected = catalog.loaders.find(loader => loader.key === key);
    assert(expected, `actual loader contains an extra key: ${key}`);
    const imports = javascriptImports(ts, property.initializer.getText(loaders.file)).imports;
    assert(imports.length === 1, `actual loader ${key} does not have one dynamic import`);
    const importedPath = path.resolve(hostDir, "preview", imports[0]);
    const promisedPath = path.resolve(hostDir, expected.module).replace(/\.tsx?$/, "");
    assert(importedPath.replace(/\.tsx?$/, "") === promisedPath, `actual loader ${key} imports a different fixture`);
    let selectedExport = false;
    function visit(node) {
      if (ts.isPropertyAccessExpression(node) && node.name.text === expected.exportName) selectedExport = true;
      ts.forEachChild(node, visit);
    }
    visit(property.initializer);
    assert(selectedExport, `actual loader ${key} selects a different export`);
  }
  const expectedKeys = catalog.loaders.map(loader => loader.key).sort();
  assert(JSON.stringify(keys.sort()) === JSON.stringify(expectedKeys), "actual loader keys differ from catalog metadata");
}

async function emittedGraphs(hostDir, base, require) {
  const ts = require("typescript");
  const dist = path.join(hostDir, "dist");
  const pageUrl = new URL(`${base}components/react-laboratory/`, "https://fixture.invalid");
  const html = await readFile(path.join(dist, "components/react-laboratory/index.html"), "utf8");
  const queue = [];
  for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const source = attribute(tag[0], "src");
    const preload = attribute(tag[0], "rel") === "modulepreload" ? attribute(tag[0], "href") : undefined;
    if (source || preload) queue.push(new URL(source || preload, pageUrl));
  }
  assert(queue.length > 0, "built host HTML has no JavaScript roots");
  const files = new Set();
  const markers = ["react.transitional.element", "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE", "__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE"];
  while (queue.length) {
    const url = queue.pop();
    assert(url.origin === pageUrl.origin && url.pathname.startsWith(base), `host graph escapes its base: ${url}`);
    const relative = decodeURIComponent(url.pathname.slice(base.length));
    assert(!relative.split("/").includes("..") && !relative.includes("preview-assets/"), `host imports external preview assets: ${url}`);
    const filename = path.join(dist, relative);
    if (files.has(filename)) continue;
    files.add(filename);
    const { imports, literals } = javascriptImports(ts, await readFile(filename, "utf8"));
    assert(!markers.some(marker => literals.has(marker)), `React renderer leaked into host module ${relative}`);
    for (const specifier of imports) {
      assert(specifier.startsWith(".") || specifier.startsWith("/"), `host has unresolved bare import ${specifier}`);
      queue.push(new URL(specifier, url));
    }
  }
  const metafile = await readJson(path.join(hostDir, "artifacts/preview-metafile.json"));
  const inputs = Object.keys(metafile.inputs).map(filename => filename.replaceAll("\\", "/"));
  const versions = [];
  for (const name of ["react", "react-dom"]) {
    const version = (await readJson(path.join(hostDir, "node_modules", name, "package.json"))).version;
    versions.push(version);
    assert(/^19\./.test(version), `external ${name} is not React 19: ${version}`);
    assert(inputs.some(filename => filename.includes(`/node_modules/${name}/`) || filename.startsWith(`node_modules/${name}/`)), `external preview graph omits ${name}`);
  }
  assert(versions[0] === versions[1], "external React and ReactDOM versions differ");
  assert(inputs.some(filename => /react-dom\/.*react-dom-client/.test(filename)), "external graph lacks the actual ReactDOM client renderer");
  assert(inputs.some(filename => /monaco-editor\/.*json\.worker/.test(filename)), "external graph lacks the real Monaco JSON worker");
  const outputs = Object.keys(metafile.outputs);
  for (const filename of outputs) {
    assert(filename.startsWith("public/preview-assets/"), `unexpected external bundle output ${filename}`);
    const emitted = path.join(dist, base.slice(1), filename.slice("public/".length));
    assert((await stat(emitted)).isFile(), `external bundle asset was not emitted: ${emitted}`);
    const original = path.join(hostDir, filename);
    assert(hash(await readFile(original)) === hash(await readFile(emitted)), `emitted external asset differs from its preview build: ${filename}`);
  }
  for (const suffix of ["entry.js", "json.worker.js", "editor.worker.js", ".ttf"]) {
    assert(outputs.some(filename => filename.endsWith(suffix)), `external graph has no ${suffix} output`);
  }
  return { hostModules: [...files].map(filename => path.relative(dist, filename)).sort(), previewInputs: inputs, previewOutputs: outputs };
}

/** Called once after each real root/non-root zfb build, before its browser proof. */
export async function assertReactDescriptorHostContracts({ hostDir, base, captures }) {
  hostDir = await realpath(hostDir);
  const checkout = await realpath(fileURLToPath(new URL("../", import.meta.url)));
  assert(hostDir !== checkout && !hostDir.startsWith(`${checkout}${path.sep}`), "mutation checks require a foreign host outside the checkout");
  assert(base === "/" || base === "/styleguide/", `unsupported fixture base ${base}`);
  assert((await readJson(path.join(hostDir, "package.json"))).name === "zudo-sg-react-descriptor-host-fixture", "mutation target is not the foreign React fixture");
  const require = createRequire(path.join(hostDir, "package.json"));
  const typescriptPath = await realpath(require.resolve("typescript"));
  assert(typescriptPath.startsWith(`${hostDir}${path.sep}node_modules${path.sep}`), "graph parser escaped the foreign installed dependencies");
  const typescriptPackageDir = path.dirname(await realpath(path.join(hostDir, "node_modules", "typescript", "package.json")));
  assert(typescriptPath.startsWith(`${typescriptPackageDir}${path.sep}`), "graph parser is not the installed typescript package");
  const typescriptManifest = await readJson(path.join(typescriptPackageDir, "package.json"));
  const declaredTypescript = (await readJson(path.join(hostDir, "package.json"))).devDependencies.typescript;
  const typescriptAlias = /^npm:(@[^/]+\/[^@]+|[^@]+)@(\d+\.\d+\.\d+)$/.exec(declaredTypescript);
  assert(typescriptAlias, "foreign typescript dependency must be an exact npm alias");
  assert(typescriptManifest.name === typescriptAlias[1] && typescriptManifest.version === typescriptAlias[2],
    `graph parser is ${typescriptManifest.name}@${typescriptManifest.version}, not ${typescriptAlias[1]}@${typescriptAlias[2]}`);
  assert(typeof require("typescript").createSourceFile === "function", "installed typescript alias does not export the compiler API");
  const apiPath = await realpath(require.resolve("@takazudo/zudo-sg/registry/external-catalog-node"));
  assert(apiPath.startsWith(`${hostDir}${path.sep}node_modules${path.sep}`), "catalog validation escaped the foreign installed package");
  const api = await import(pathToFileURL(apiPath));
  const catalogPath = path.join(hostDir, "artifacts/catalog.json");
  const capturesPath = path.join(hostDir, "artifacts/captures.json");
  const catalog = await readJson(catalogPath);
  assert(JSON.stringify(await readJson(capturesPath)) === JSON.stringify(captures), "provided captures differ from actual build receipts");
  api.validateExternalCatalogOutputs(catalog);
  for (const assetRoot of ["public", path.join("dist", base.slice(1))]) {
    api.validateExternalCatalogAssets({ manifest: catalog.manifest, projectRoot: hostDir, assetRoot: path.join(hostDir, assetRoot), captures });
  }
  await generatedCatalog(hostDir, catalog, require);
  const graph = await emittedGraphs(hostDir, base, require);
  const checks = [await validateBuildInput(hostDir, true, "unmodified build input")];
  async function catalogCase(label, mutate, shouldPass = false, receipts = captures) {
    const changed = structuredClone(catalog);
    mutate(changed);
    checks.push(await withMutations([[catalogPath, jsonBytes(changed)], [capturesPath, jsonBytes(receipts)]], () => validateBuildInput(hostDir, shouldPass, label)));
  }
  const image = catalog.manifest.find(row => row.capture.kind === "image");
  assert(image && captures.length > 0, "fixture has no promised real capture");
  const imagePath = path.join(hostDir, "public", image.capture.src.slice(1));
  checks.push(await withMutations([[imagePath, null]], () => validateBuildInput(hostDir, false, "missing promised capture")));
  checks.push(await withMutations([[imagePath, Buffer.from("corrupt PNG")]], () => validateBuildInput(hostDir, false, "corrupt promised PNG")));
  await catalogCase("missing capture receipt", () => {}, false, captures.slice(1));
  const mismatchedReceipts = structuredClone(captures);
  mismatchedReceipts[0].sourceSha256 = "0".repeat(64);
  await catalogCase("mismatched capture receipt", () => {}, false, mismatchedReceipts);
  await catalogCase("failed promised capture", value => { value.manifest[0].capture = { kind: "failed", key: value.manifest[0].loader.key, note: "deliberate capture failure" }; });
  await catalogCase("mismatched loader key", value => { value.loaders[0].key = JSON.stringify(["wrong", "Default"]); });
  await catalogCase("extra loader key", value => { value.loaders.push({ ...value.loaders[0], key: JSON.stringify(["extra", "Default"]) }); });
  await catalogCase("mismatched displayed source key", value => { value.sources[0].key = JSON.stringify(["wrong", "Default"]); });
  await catalogCase("extra displayed source key", value => { value.sources.push({ ...value.sources[0], key: JSON.stringify(["extra", "Default"]) }); });
  await catalogCase("mismatched descriptor key", value => { value.descriptors[0].variants[0].exportName = "wrong"; });
  const placeholderKey = catalog.manifest[0].loader.key;
  await catalogCase("explicit placeholder remains valid", value => {
    value.manifest[0].capture = { kind: "placeholder", key: placeholderKey, note: "intentional fixture placeholder" };
    value.descriptors[0].thumbnail = api.thumbnailFromExternalCapture(value.manifest[0].capture);
  }, true, captures.filter(receipt => receipt.key !== placeholderKey));
  checks.push(await validateBuildInput(hostDir, true, "restored build input"));
  const evidence = { base, ...graph, checks };
  await writeFile(path.join(hostDir, `artifacts/contracts-${base === "/" ? "root" : "nonroot"}.json`), jsonBytes(evidence));
  console.log(`React renderer separation and ${checks.length} prebuild contract checks passed at ${base}`);
  return evidence;
}
