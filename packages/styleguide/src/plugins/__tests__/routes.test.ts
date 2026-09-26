import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import routesPlugin, {
  CONTEXT_MODULE_ID,
  PLUGIN_NAME,
  REGISTRY_MODULE_ID,
  ROUTE_ENTRYPOINTS,
  TOKENS_MODULE_ID,
  buildTokensModuleSource,
  ZUDO_DOC_ROUTES_PLUGIN_NAME,
  assertZudoDocRoutesPlugin,
  buildContextModuleSource,
  buildRegistryModuleSource,
  createRoutesPlugin,
  deriveRouteInjections,
  resolvePackageRoot,
  resolveRoutesPluginOptions,
} from "../routes.js";
import { toForwardSlash } from "../../host-paths.js";
import { createRegistry } from "../../registry/index.js";
import { DEFAULT_PREVIEW_CSS_URL } from "../../sg-context.js";
import { componentHref, DEFAULT_SG_ROUTES } from "../../sg-routes.js";

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const REGISTRY = "./src/styleguide/sg-registry.ts";
const DESCRIPTORS = "./src/styleguide/story-descriptors.ts";
const ZUDO_DOC_DESCRIPTOR = { name: ZUDO_DOC_ROUTES_PLUGIN_NAME, options: { settings: {} } };

let sandbox: string;
let projectRoot: string;
let packageRoot: string;

function touch(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "export {};\n");
}

beforeAll(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), "zudo-sg-routes-plugin-")));
  projectRoot = join(sandbox, "host");
  touch(join(projectRoot, REGISTRY));
  touch(join(projectRoot, DESCRIPTORS));
  touch(join(sandbox, "outside/descriptors.ts"));
  mkdirSync(join(projectRoot, "src/styleguide/dir-not-file"), { recursive: true });

  // Installed-shape package: realpath under node_modules/.pnpm/….
  packageRoot = toForwardSlash(
    join(projectRoot, "node_modules/.pnpm/@takazudo+zudo-sg@0.1.0/node_modules/@takazudo/zudo-sg"),
  );
  for (const file of Object.values(ROUTE_ENTRYPOINTS)) touch(join(packageRoot, "routes-src", file));
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

interface Registration {
  virtualModules: Map<string, () => string | Promise<string>>;
  routes: Array<{ pattern: string; entrypoint: string }>;
}

function runSetup(
  options: Record<string, unknown>,
  { plugins = [ZUDO_DOC_DESCRIPTOR], base, root = packageRoot }: { plugins?: unknown[]; base?: string; root?: string } = {},
): Registration {
  const reg: Registration = { virtualModules: new Map(), routes: [] };
  const ctx = {
    command: "build",
    projectRoot,
    config: { plugins, ...(base === undefined ? {} : { base }) },
    options,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    addAlias() {},
    addClientEntry() {},
    addVirtualModule(specifier: string, loader: () => string | Promise<string>) {
      reg.virtualModules.set(specifier, loader);
    },
    injectRoute(pattern: string, entrypoint: string) {
      reg.routes.push({ pattern, entrypoint });
    },
  };
  const plugin = createRoutesPlugin({ packageRoot: () => root });
  plugin.setup?.(ctx as unknown as Parameters<NonNullable<typeof routesPlugin.setup>>[0]);
  return reg;
}

async function loadContext(reg: Registration): Promise<unknown> {
  const source = await reg.virtualModules.get(CONTEXT_MODULE_ID)!();
  const match = /^export const sgContext = (.*);\n$/s.exec(source);
  expect(match).not.toBeNull();
  return JSON.parse(match![1]!);
}

describe("resolveRoutesPluginOptions", () => {
  it("fills defaults and resolves registryModule to a forward-slash absolute path", () => {
    expect(resolveRoutesPluginOptions(projectRoot, { registryModule: REGISTRY })).toEqual({
      registry: { mode: "module", registryModule: toForwardSlash(join(projectRoot, REGISTRY)) },
      routes: { ...DEFAULT_SG_ROUTES },
      categoryOrder: [],
      uiPackageName: null,
      previewCssUrl: DEFAULT_PREVIEW_CSS_URL,
      catalog: { title: "Component catalog", intro: null },
      tokensManifestModule: null,
      componentDocs: [],
    });
  });

  it("resolves an optional tokensManifestModule through the host-path contract", () => {
    touch(join(projectRoot, "src/config/tokens-manifest.ts"));
    expect(
      resolveRoutesPluginOptions(projectRoot, { registryModule: REGISTRY, tokensManifestModule: "./src/config/tokens-manifest.ts" })
        .tokensManifestModule,
    ).toBe(toForwardSlash(join(projectRoot, "src/config/tokens-manifest.ts")));
    expect(() =>
      resolveRoutesPluginOptions(projectRoot, { registryModule: REGISTRY, tokensManifestModule: "./nope.ts" }),
    ).toThrow(/option "tokensManifestModule" = "\.\/nope\.ts" resolved to/);
  });

  it("keeps host values and merges partial route patterns over the defaults", () => {
    const resolved = resolveRoutesPluginOptions(projectRoot, {
      registryModule: REGISTRY,
      routes: { componentsSlug: "/ui/[slug]", tokens: "/design/tokens" },
      categoryOrder: ["Actions", "Forms"],
      uiPackageName: "@zudo-sg/demo-ui",
      previewCssUrl: "/assets/sg-preview.css",
      catalog: { title: "UI kit", intro: "All the parts." },
      componentDocs: [
        { keyPrefix: "ui/src", collection: "componentDocs" },
        { keyPrefix: "ui", collection: "componentDocs1" },
      ],
    });
    expect(resolved.routes).toEqual({
      componentsIndex: "/components",
      componentsSlug: "/ui/[slug]",
      componentsPreview: "/components/preview",
      tokens: "/design/tokens",
    });
    expect(resolved.categoryOrder).toEqual(["Actions", "Forms"]);
    expect(resolved.uiPackageName).toBe("@zudo-sg/demo-ui");
    expect(resolved.previewCssUrl).toBe("/assets/sg-preview.css");
    expect(resolved.catalog).toEqual({ title: "UI kit", intro: "All the parts." });
    expect(resolved.componentDocs).toEqual([
      { keyPrefix: "ui/src", collection: "componentDocs" },
      { keyPrefix: "ui", collection: "componentDocs1" },
    ]);
  });

  it("fails with the exact host-path message when registryModule is not a file (ADR decision 10)", () => {
    const abs = toForwardSlash(join(projectRoot, "src/styleguide/missing.ts"));
    const root = toForwardSlash(projectRoot);
    expect(() =>
      resolveRoutesPluginOptions(projectRoot, { registryModule: "./src/styleguide/missing.ts" }),
    ).toThrow(
      new Error(
        `[zudo-sg] option "registryModule" = "./src/styleguide/missing.ts" resolved to ${abs} (relative to projectRoot ${root}), which is not a file`,
      ),
    );
    expect(() =>
      resolveRoutesPluginOptions(projectRoot, { registryModule: "./src/styleguide/dir-not-file" }),
    ).toThrow(/which is not a file$/);
  });

  it("fails with the exact required message when registryModule is absent", () => {
    expect(() => resolveRoutesPluginOptions(projectRoot, {})).toThrow(
      new Error(
        `[zudo-sg] option "registryModule" is required (project-root-relative path, e.g. "./src/styleguide/sg-registry.ts")`,
      ),
    );
  });

  it("keeps emitted detail paths distinct from the configured preview route", () => {
    const { routes } = resolveRoutesPluginOptions(projectRoot, {
      registryModule: REGISTRY,
      routes: { componentsSlug: "/catalog/[slug]/detail/", componentsPreview: "/catalog/preview/detail" },
    });
    const registry = createRegistry({
      "./preview.stories.tsx": {
        default: { title: "Preview", category: "Examples", description: "", usage: "" },
        Default: { name: "Default", render: () => null },
      },
    }, { routes });
    expect(registry.getAllSlugs()).toEqual(["preview-2"]);
    expect(componentHref(routes, registry.getAllSlugs()[0]!)).toBe("/catalog/preview-2/detail/");
    expect(componentHref(routes, registry.getAllSlugs()[0]!).replace(/\/+$/, ""))
      .not.toBe(routes.componentsPreview.replace(/\/+$/, ""));
  });

  it.each([
    [{ routez: {} }, /unknown option "routez"/],
    [{ registryModule: 42 }, /option "registryModule" must be a string/],
    [{ routes: { catalog: "/x" } }, /option "routes.catalog" is not a known route/],
    [{ routes: { tokens: "tokens" } }, /option "routes.tokens" = "tokens" must be a root-absolute path/],
    [{ routes: { componentsSlug: "/components/:slug" } }, /must contain the "\[slug\]" segment/],
    [{ routes: { componentsSlug: "/components/[slug]/[slug]" } }, /exactly one "\[slug\]" placeholder/],
    [{ routes: { tokens: "/components" } }, /"routes.componentsIndex" and "routes.tokens" both resolve to "\/components"/],
    [{ categoryOrder: "Actions" }, /option "categoryOrder" must be an array of strings/],
    [{ uiPackageName: "" }, /option "uiPackageName" must be a non-empty string/],
    [{ previewCssUrl: "preview.css" }, /option "previewCssUrl" = "preview.css" must be a root-absolute path/],
    [{ catalog: { heading: "x" } }, /option "catalog.heading" is not supported/],
    [{ componentDocs: { keyPrefix: "ui" } }, /option "componentDocs" must be an array/],
    [{ componentDocs: ["ui"] }, /option "componentDocs\[0\]" must be an object/],
    [{ componentDocs: [{ keyPrefix: "ui" }] }, /"componentDocs\[0\]" requires non-empty "keyPrefix" and "collection"/],
    [{ componentDocs: [{ keyPrefix: "ui", collection: "c", dir: "ui" }] }, /"componentDocs\[0\].dir" is not supported/],
  ])("rejects invalid options %j", (extra, message) => {
    expect(() => resolveRoutesPluginOptions(projectRoot, { registryModule: REGISTRY, ...extra })).toThrow(message);
  });
});

describe("resolveRoutesPluginOptions — descriptor mode", () => {
  it("resolves descriptorModule and needs no registryModule", () => {
    expect(
      resolveRoutesPluginOptions(projectRoot, { registryMode: "descriptor", descriptorModule: DESCRIPTORS }).registry,
    ).toEqual({ mode: "descriptor", descriptorModule: toForwardSlash(join(projectRoot, DESCRIPTORS)) });
  });

  it("accepts an explicit module mode", () => {
    expect(resolveRoutesPluginOptions(projectRoot, { registryMode: "module", registryModule: REGISTRY }).registry.mode).toBe(
      "module",
    );
  });

  it("fails when descriptor mode has no descriptorModule", () => {
    expect(() => resolveRoutesPluginOptions(projectRoot, { registryMode: "descriptor" })).toThrow(
      new Error(
        `[zudo-sg] option "descriptorModule" is required (project-root-relative path, e.g. "./src/styleguide/story-descriptors.ts")`,
      ),
    );
  });

  it("fails with the option name when descriptorModule resolves outside the project root", () => {
    const outside = toForwardSlash(join(sandbox, "outside/descriptors.ts"));
    expect(() =>
      resolveRoutesPluginOptions(projectRoot, { registryMode: "descriptor", descriptorModule: "../outside/descriptors.ts" }),
    ).toThrow(
      new Error(
        `[zudo-sg] option "descriptorModule" = "../outside/descriptors.ts" resolved to ${outside}, which is outside projectRoot ${toForwardSlash(projectRoot)}`,
      ),
    );
    expect(() =>
      resolveRoutesPluginOptions(projectRoot, { registryMode: "descriptor", descriptorModule: outside }),
    ).toThrow(/option "descriptorModule" = .* which is outside projectRoot/);
  });

  it("fails when descriptorModule is not a file", () => {
    expect(() =>
      resolveRoutesPluginOptions(projectRoot, { registryMode: "descriptor", descriptorModule: "./nope.ts" }),
    ).toThrow(/option "descriptorModule" = "\.\/nope\.ts" resolved to .* which is not a file$/);
  });

  it.each([
    [{ registryMode: "descriptors", descriptorModule: DESCRIPTORS }, /option "registryMode" must be "module" or "descriptor"/],
    [{ registryModule: REGISTRY, descriptorModule: DESCRIPTORS }, /option "descriptorModule" is only valid with registryMode: "descriptor"/],
    [{ registryMode: "module", registryModule: REGISTRY, descriptorModule: DESCRIPTORS }, /option "descriptorModule" is only valid/],
    [{ registryMode: "descriptor", descriptorModule: DESCRIPTORS, registryModule: REGISTRY }, /option "registryModule" is only valid with registryMode: "module"/],
    [
      { registryMode: "descriptor", descriptorModule: DESCRIPTORS, componentDocs: [{ keyPrefix: "ui", collection: "c" }] },
      /option "componentDocs" is only valid with registryMode: "module"/,
    ],
    [{ registryMode: "descriptor", descriptorModule: 42 }, /option "descriptorModule" must be a string/],
  ])("rejects contradictory or invalid registry options %j", (options, message) => {
    expect(() => resolveRoutesPluginOptions(projectRoot, options)).toThrow(message);
  });
});

describe("deriveRouteInjections", () => {
  it("maps the default patterns to routes-src entrypoints", () => {
    expect(deriveRouteInjections({ ...DEFAULT_SG_ROUTES }, "/pkg")).toEqual([
      { key: "componentsIndex", pattern: "/components", entrypoint: "/pkg/routes-src/components-index.tsx" },
      { key: "componentsSlug", pattern: "/components/[slug]", entrypoint: "/pkg/routes-src/components-slug.tsx" },
      { key: "componentsPreview", pattern: "/components/preview", entrypoint: "/pkg/routes-src/components-preview.tsx" },
      { key: "tokens", pattern: "/tokens", entrypoint: "/pkg/routes-src/tokens.tsx" },
    ]);
  });

  it("keeps entrypoints fixed when patterns are customised", () => {
    const routes = { componentsIndex: "/ui", componentsSlug: "/ui/[slug]", componentsPreview: "/ui-preview", tokens: "/ui/tokens" };
    expect(deriveRouteInjections(routes, "/pkg").map(({ pattern, entrypoint }) => [pattern, entrypoint])).toEqual([
      ["/ui", "/pkg/routes-src/components-index.tsx"],
      ["/ui/[slug]", "/pkg/routes-src/components-slug.tsx"],
      ["/ui-preview", "/pkg/routes-src/components-preview.tsx"],
      ["/ui/tokens", "/pkg/routes-src/tokens.tsx"],
    ]);
  });
});

describe("assertZudoDocRoutesPlugin", () => {
  it("passes when the zudo-doc routes descriptor is listed", () => {
    expect(() => assertZudoDocRoutesPlugin({ plugins: [{ name: "x" }, ZUDO_DOC_DESCRIPTOR] })).not.toThrow();
  });

  it.each([[{}], [{ plugins: [] }], [{ plugins: [{ name: "@takazudo/zudo-doc/plugins/doc-history" }] }]])(
    "throws when the descriptor is missing (%j)",
    (config) => {
      expect(() => assertZudoDocRoutesPlugin(config)).toThrow(
        `[zudo-sg] ${PLUGIN_NAME} requires the "${ZUDO_DOC_ROUTES_PLUGIN_NAME}" plugin in the zfb config`,
      );
    },
  );
});

describe("virtual module sources", () => {
  it("module mode re-exports the host registry through a forward-slash absolute specifier", () => {
    expect(
      buildRegistryModuleSource({ mode: "module", registryModule: "C:\\host\\src\\styleguide\\sg-registry.ts" }),
    ).toBe(
      'export { storyModules, storyExportOrder } from "C:/host/src/styleguide/sg-registry.ts";\n' +
        "export const storyDescriptors = [];\n",
    );
  });

  it("descriptor mode imports only the descriptor module and stubs the StoryModule exports", () => {
    const source = buildRegistryModuleSource({ mode: "descriptor", descriptorModule: "C:\\host\\sg\\descriptors.ts" });
    expect(source).toBe(
      'import * as descriptorModule from "C:/host/sg/descriptors.ts";\n' +
        "export const storyModules = {};\n" +
        "export const storyExportOrder = {};\n" +
        'export const storyDescriptors = "storyDescriptors" in descriptorModule ? descriptorModule.storyDescriptors : descriptorModule.default;\n',
    );
    const imports = source.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual(['import * as descriptorModule from "C:/host/sg/descriptors.ts";']);
    expect(source).not.toMatch(/stories\.tsx|sg-registry/);
  });

  it.each([
    ["module", { mode: "module", registryModule: "/h/r.ts" }],
    ["descriptor", { mode: "descriptor", descriptorModule: "/h/d.ts" }],
  ] as const)("%s mode exports storyModules, storyExportOrder and storyDescriptors", (_mode, source) => {
    const text = buildRegistryModuleSource(source);
    for (const name of ["storyModules", "storyExportOrder", "storyDescriptors"]) {
      expect(text).toMatch(new RegExp(`export (const ${name} =|\\{[^}]*\\b${name}\\b[^}]*\\})`));
    }
  });

  it("descriptor mode reads the named export first, then the default export", async () => {
    // Evaluates the emitted body against stand-in module namespaces.
    const body = buildRegistryModuleSource({ mode: "descriptor", descriptorModule: "/h/d.ts" })
      .replace(/^import .*\n/, "")
      .replace(/export const /g, "exports.");
    const evaluate = (descriptorModule: Record<string, unknown>) => {
      const exports: Record<string, unknown> = {};
      new Function("descriptorModule", "exports", body)(descriptorModule, exports);
      return exports;
    };
    expect(evaluate({ storyDescriptors: ["named"], default: ["default"] }).storyDescriptors).toEqual(["named"]);
    expect(evaluate({ default: ["default"] }).storyDescriptors).toEqual(["default"]);
    expect(evaluate({})).toMatchObject({ storyModules: {}, storyExportOrder: {} });
  });

  it("emits the context as a JSON literal", () => {
    const source = buildContextModuleSource({
      base: "/",
      routes: { ...DEFAULT_SG_ROUTES },
      registryMode: "module",
      categoryOrder: [],
      uiPackageName: null,
      previewCssUrl: DEFAULT_PREVIEW_CSS_URL,
      catalog: { title: "t", intro: null },
      componentDocs: [],
    });
    expect(source.startsWith("export const sgContext = {")).toBe(true);
  });
});

describe("buildTokensModuleSource", () => {
  it("exports a null manifest when no tokensManifestModule is configured", () => {
    expect(buildTokensModuleSource(null)).toBe("export const tokensManifest = null;\n");
  });

  it("assembles the UiDesignTokensManifest from the generated manifest's named exports", () => {
    expect(buildTokensModuleSource("/host/src/config/m.ts")).toBe(
      'import * as manifest from "/host/src/config/m.ts";\n' +
        'export const tokensManifest = { paletteColors: manifest.UI_PALETTE_COLORS, colorTokens: manifest.UI_COLOR_TOKENS, spacingTokens: manifest.UI_SPACING_TOKENS, fontTokens: manifest.UI_FONT_TOKENS, sizeTokens: manifest.UI_SIZE_TOKENS, groups: "UI_TOKEN_GROUPS" in manifest ? manifest.UI_TOKEN_GROUPS : undefined };\n',
    );
  });
});

describe("routes plugin setup", () => {
  it("registers both virtual modules and injects the four routes from the package realpath", async () => {
    const reg = runSetup(
      {
        registryModule: REGISTRY,
        routes: { componentsIndex: "/ui" },
        categoryOrder: ["Actions"],
        uiPackageName: "@zudo-sg/demo-ui",
        componentDocs: [{ keyPrefix: "ui", collection: "componentDocs" }],
      },
      { base: "/styleguide/" },
    );

    expect([...reg.virtualModules.keys()]).toEqual([CONTEXT_MODULE_ID, REGISTRY_MODULE_ID, TOKENS_MODULE_ID]);
    expect(await reg.virtualModules.get(TOKENS_MODULE_ID)!()).toBe("export const tokensManifest = null;\n");
    expect(await loadContext(reg)).toEqual({
      base: "/styleguide/",
      routes: { ...DEFAULT_SG_ROUTES, componentsIndex: "/ui" },
      registryMode: "module",
      categoryOrder: ["Actions"],
      uiPackageName: "@zudo-sg/demo-ui",
      previewCssUrl: "/_zudo-sg/preview.css",
      catalog: { title: "Component catalog", intro: null },
      componentDocs: [{ keyPrefix: "ui", collection: "componentDocs" }],
    });
    expect(await reg.virtualModules.get(REGISTRY_MODULE_ID)!()).toBe(
      `export { storyModules, storyExportOrder } from ${JSON.stringify(toForwardSlash(join(projectRoot, REGISTRY)))};\n` +
        "export const storyDescriptors = [];\n",
    );
    expect(reg.routes).toEqual([
      { pattern: "/ui", entrypoint: `${packageRoot}/routes-src/components-index.tsx` },
      { pattern: "/components/[slug]", entrypoint: `${packageRoot}/routes-src/components-slug.tsx` },
      { pattern: "/components/preview", entrypoint: `${packageRoot}/routes-src/components-preview.tsx` },
      { pattern: "/tokens", entrypoint: `${packageRoot}/routes-src/tokens.tsx` },
    ]);
  });

  it("descriptor mode registers the descriptor re-export and flags the context", async () => {
    const reg = runSetup({ registryMode: "descriptor", descriptorModule: DESCRIPTORS });
    expect((await loadContext(reg)) as { registryMode: string }).toMatchObject({ registryMode: "descriptor", componentDocs: [] });
    const source = await reg.virtualModules.get(REGISTRY_MODULE_ID)!();
    expect(source).toContain(`import * as descriptorModule from ${JSON.stringify(toForwardSlash(join(projectRoot, DESCRIPTORS)))};`);
    expect(reg.routes).toHaveLength(4);
  });

  it('defaults base to "/" when the zfb config has none', async () => {
    const reg = runSetup({ registryModule: REGISTRY });
    expect((await loadContext(reg)) as { base: string }).toMatchObject({ base: "/" });
  });

  it("throws before registering anything when the zudo-doc routes descriptor is missing", () => {
    expect(() => runSetup({ registryModule: REGISTRY }, { plugins: [] })).toThrow(ZUDO_DOC_ROUTES_PLUGIN_NAME);
  });

  it("throws at setup when the host registry file is missing", () => {
    expect(() => runSetup({ registryModule: "./nope.ts" })).toThrow(/option "registryModule" = "\.\/nope\.ts" resolved to/);
  });

  it("throws when routes-src has not been built", () => {
    const empty = toForwardSlash(join(sandbox, "unbuilt-package"));
    expect(() => runSetup({ registryModule: REGISTRY }, { root: empty })).toThrow(
      `[zudo-sg] route entrypoint ${empty}/routes-src/components-index.tsx is missing`,
    );
  });
});

describe("resolvePackageRoot", () => {
  it("resolves this package's own realpath through its package.json self-reference", () => {
    expect(resolvePackageRoot()).toBe(toForwardSlash(realpathSync(PACKAGE_DIR)));
  });

  it("backs the default export, named after its descriptor", () => {
    expect(routesPlugin.name).toBe(PLUGIN_NAME);
  });
});
