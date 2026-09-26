import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@takazudo/zudo-doc/config";
import { makeUrlHelpers } from "@takazudo/zudo-doc/url-helpers";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import {
  PREVIEW_CSS_PLUGIN_NAME,
  ROUTES_PLUGIN_NAME,
  ZDTP_APPLY_PROXY_PLUGIN_NAME,
  withZudoSg,
  zudoSg,
  type ZudoSgComposeOptions,
} from "../index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

const TRIGGER_ID = "sg-preview-tokens-trigger";

function headerRightItemsOf(plugin: unknown): Array<Record<string, unknown>> {
  return (plugin as { options: { settings: { headerRightItems?: Array<Record<string, unknown>> } } })
    .options.settings.headerRightItems ?? [];
}

function triggerItemsOf(plugin: unknown): Array<Record<string, unknown>> {
  return headerRightItemsOf(plugin).filter(
    (item) => item.type === "html" && typeof item.html === "string" && item.html.includes(TRIGGER_ID),
  );
}

const OPTIONS: ZudoSgComposeOptions = {
  componentsRoots: [
    { dir: "packages/demo-ui/src", importBase: "@zudo-sg/demo-ui/src" },
    { dir: "packages/extra/src", importBase: "@zudo-sg/extra/src" },
  ],
  registryOut: "./src/styleguide/sg-registry.ts",
  categoryOrder: ["Actions", "Forms"],
  uiPackageName: "@zudo-sg/demo-ui",
  barrelIndex: "packages/demo-ui/src/index.ts",
  tokens: { cssFiles: ["a.css", "b.css"], manifestOut: "./src/config/ui-design-tokens-manifest.ts" },
  previewStyles: "./src/styles/preview-entry.css",
  catalog: { title: "Catalog" },
  zdtpApplyProxy: {
    routingFile: "./zdtp-panel-routing.json",
    writeRoot: "./packages/demo-ui/styles",
    tabsModule: "./src/config/preview-token-panel-tabs.ts",
  },
};

describe("zudoSg()", () => {
  it("omits tokensManifestModule when the config has no tokens entry", () => {
    const { tokens: _tokens, ...withoutTokens } = OPTIONS;
    const { plugins } = zudoSg(withoutTokens);
    expect(plugins[0]?.name).toBe(ROUTES_PLUGIN_NAME);
    expect(plugins[0]?.options).not.toHaveProperty("tokensManifestModule");
  });

  it("returns the three engine plugin descriptors in order, with the ADR option shapes", () => {
    const { plugins } = zudoSg(OPTIONS);
    expect(plugins).toEqual([
      {
        name: ROUTES_PLUGIN_NAME,
        options: {
          registryModule: "./src/styleguide/sg-registry.ts",
          categoryOrder: ["Actions", "Forms"],
          uiPackageName: "@zudo-sg/demo-ui",
          previewCssUrl: "/_zudo-sg/preview.css",
          catalog: { title: "Catalog" },
          tokensManifestModule: "./src/config/ui-design-tokens-manifest.ts",
          componentDocs: [
            { keyPrefix: "demo-ui/src", collection: "componentDocs" },
            { keyPrefix: "extra/src", collection: "componentDocs1" },
          ],
        },
      },
      {
        name: PREVIEW_CSS_PLUGIN_NAME,
        options: { previewStyles: "./src/styles/preview-entry.css", previewCssUrl: "/_zudo-sg/preview.css" },
      },
      {
        name: ZDTP_APPLY_PROXY_PLUGIN_NAME,
        options: {
          routingFile: "./zdtp-panel-routing.json",
          writeRoot: "./packages/demo-ui/styles",
          tabsModule: "./src/config/preview-token-panel-tabs.ts",
        },
      },
    ]);
    expect(plugins.map((p) => p.name)).toEqual([
      "@takazudo/zudo-sg/plugins/routes",
      "@takazudo/zudo-sg/plugins/preview-css",
      "@takazudo/zudo-sg/plugins/zdtp-apply-proxy",
    ]);
  });

  it("threads a custom previewCssUrl and routes into both consumers", () => {
    const { plugins } = zudoSg({ ...OPTIONS, previewCssUrl: "/x/preview.css", routes: { tokens: "/design" } });
    expect(plugins[0]?.options).toMatchObject({ previewCssUrl: "/x/preview.css", routes: { tokens: "/design" } });
    expect(plugins[1]?.options).toEqual({
      previewStyles: "./src/styles/preview-entry.css",
      previewCssUrl: "/x/preview.css",
    });
  });

  it("lists the zdtp plugin with empty (disabled) options when zdtpApplyProxy is omitted", () => {
    const { zdtpApplyProxy: _omit, ...rest } = OPTIONS;
    expect(zudoSg(rest).plugins[2]).toEqual({ name: ZDTP_APPLY_PROXY_PLUGIN_NAME, options: {} });
  });

  it("accepts a tabs-only zdtpApplyProxy — routingFile/writeRoot omitted together (#815)", () => {
    const tabsOnlyOptions: ZudoSgComposeOptions = {
      ...OPTIONS,
      zdtpApplyProxy: { tabsModule: "./src/config/preview-token-panel-tabs.ts" },
    };
    expect(zudoSg(tabsOnlyOptions).plugins[2]).toEqual({
      name: ZDTP_APPLY_PROXY_PLUGIN_NAME,
      options: { tabsModule: "./src/config/preview-token-panel-tabs.ts" },
    });
  });

  it("registers one componentDocs collection per components root", () => {
    expect(zudoSg(OPTIONS).collections).toEqual([
      { name: "componentDocs", path: "packages/demo-ui/src", include: ["**/*.mdx"] },
      { name: "componentDocs1", path: "packages/extra/src", include: ["**/*.mdx"] },
    ]);
  });

  it("is JSON-serializable data (bare-specifier descriptors, no functions)", () => {
    const fragment = zudoSg(OPTIONS);
    expect(JSON.parse(JSON.stringify(fragment))).toEqual(fragment);
  });
});

describe("zudoSg() registry modes", () => {
  const { componentsRoots: _roots, registryOut: _out, ...BASE } = OPTIONS;

  it("descriptor mode passes registryMode + descriptorModule and registers no component-doc collections", () => {
    const fragment = zudoSg({ ...BASE, registry: { mode: "descriptor", module: "./src/sg/descriptors.ts" } });
    expect(fragment.plugins[0]?.options).toEqual({
      registryMode: "descriptor",
      descriptorModule: "./src/sg/descriptors.ts",
      categoryOrder: ["Actions", "Forms"],
      uiPackageName: "@zudo-sg/demo-ui",
      previewCssUrl: "/_zudo-sg/preview.css",
      catalog: { title: "Catalog" },
      tokensManifestModule: "./src/config/ui-design-tokens-manifest.ts",
    });
    expect(fragment.collections).toEqual([]);
  });

  it("descriptor mode ignores componentsRoots and registryOut when a host still lists them", () => {
    const fragment = zudoSg({ ...OPTIONS, registry: { mode: "descriptor", module: "./src/sg/descriptors.ts" } });
    expect(fragment.plugins[0]?.options).not.toHaveProperty("registryModule");
    expect(fragment.plugins[0]?.options).not.toHaveProperty("componentDocs");
    expect(fragment.collections).toEqual([]);
  });

  it("an explicit module mode composes exactly like the default", () => {
    expect(zudoSg({ ...OPTIONS, registry: { mode: "module" } })).toEqual(zudoSg(OPTIONS));
  });

  it("fails when descriptor mode has no module", () => {
    expect(() =>
      zudoSg({ ...BASE, registry: { mode: "descriptor" } } as unknown as ZudoSgComposeOptions),
    ).toThrow(/option "registry.module" is required with registry.mode "descriptor"/);
  });

  it.each([
    [{ mode: "module", module: "./src/sg/descriptors.ts" }, /option "registry.module" is only valid with registry.mode "descriptor"/],
    [{ mode: "stories" }, /option "registry.mode" must be "module" or "descriptor"/],
    [{ mode: "descriptor", module: "./d.ts", registryOut: "./r.ts" }, /option "registry.registryOut" is not supported/],
    ["descriptor", /option "registry" must be/],
  ])("rejects contradictory registry option %j", (registry, message) => {
    expect(() => zudoSg({ ...OPTIONS, registry } as unknown as ZudoSgComposeOptions)).toThrow(message);
  });
});

describe("withZudoSg()", () => {
  const preset = {
    collections: [{ name: "docs", path: "src/content/docs", schema: {} }],
    plugins: [
      { name: "@takazudo/zudo-doc/plugins/routes", options: { settings: {} } },
      { name: "@takazudo/zudo-doc/plugins/search-index" },
    ],
    markdown: { features: {} },
    trailingSlash: false,
  };

  it("keeps the preset's plugins and collections and appends the engine's AFTER them", () => {
    const merged = withZudoSg(preset, OPTIONS);
    expect(merged.plugins.map((p) => p.name)).toEqual([
      "@takazudo/zudo-doc/plugins/routes",
      "@takazudo/zudo-doc/plugins/search-index",
      "@takazudo/zudo-sg/plugins/routes",
      "@takazudo/zudo-sg/plugins/preview-css",
      "@takazudo/zudo-sg/plugins/zdtp-apply-proxy",
    ]);
    expect(merged.collections.map((c) => c.name)).toEqual(["docs", "componentDocs", "componentDocs1"]);
    expect(merged.markdown).toBe(preset.markdown);
    expect(merged.trailingSlash).toBe(false);
    // The preset fragment itself is not mutated.
    expect(preset.plugins).toHaveLength(2);
  });

  it("gives a minimal host navigation for the engine-owned routes and search", () => {
    const minimalPreset = {
      plugins: [
        {
          name: "@takazudo/zudo-doc/plugins/routes",
          options: {
            settings: {
              siteName: "Minimal host",
              headerNav: [],
              headerRightItems: [{ type: "component", component: "theme-toggle" }],
            },
          },
        },
      ],
      collections: [],
    };

    const merged = withZudoSg(minimalPreset, {
      ...OPTIONS,
      routes: { componentsIndex: "/library", tokens: "/design-tokens" },
    });
    const routesPlugin = merged.plugins[0] as (typeof minimalPreset.plugins)[number];

    expect(routesPlugin.options.settings.headerNav).toEqual([
      { label: "Components", path: "/library", categoryMatch: "components", versioned: false },
      { label: "Design Tokens", path: "/design-tokens", versioned: false },
    ]);
    expect(routesPlugin.options.settings.headerRightItems).toEqual([
      { type: "component", component: "theme-toggle" },
      { type: "component", component: "search" },
      { type: "html", html: expect.stringContaining(TRIGGER_ID) },
    ]);
    expect(minimalPreset.plugins[0]?.options.settings.headerNav).toEqual([]);
    expect(minimalPreset.plugins[0]?.options.settings.headerRightItems).toHaveLength(1);
  });

  it("keeps default engine links global on localized and versioned pages", () => {
    const settings = { ...DEFAULT_SETTINGS, base: "/styleguide/", defaultLocaleOnlyPrefixes: ["/host-only/"] };
    const composed = withZudoSg({
      plugins: [{ name: "@takazudo/zudo-doc/plugins/routes", options: { settings } }],
    }, { ...OPTIONS, routes: { componentsIndex: "/library", tokens: "/design-tokens" } });
    const merged = (composed.plugins[0] as { options: { settings: typeof settings } }).options.settings;
    const urls = makeUrlHelpers(merged, {
      defaultLocale: "en", locales: ["en", "ja"], getLocaleLabel: (locale) => locale,
    });
    for (const item of merged.headerNav) {
      expect(urls.navHref(item.path, "ja", "v1", item.versioned)).toBe(`/styleguide${item.path}`);
      expect(urls.navHref(item.path, "ja", undefined, item.versioned)).toBe(`/styleguide${item.path}`);
    }
    expect(urls.navHref("/host-only/page", "ja", undefined)).toBe("/styleguide/host-only/page");
    expect(urls.navHref("/library-not-engine", "ja", undefined)).toBe("/styleguide/ja/library-not-engine");
    expect(settings.defaultLocaleOnlyPrefixes).toEqual(["/host-only/"]);
  });

  it("preserves host-owned chrome when the host supplies navigation", () => {
    const hostNav = [{ label: "Architecture", path: "/architecture", categoryMatch: "architecture" }];
    const hostRightItems = [{ type: "component", component: "theme-toggle" }];
    const configuredPreset = {
      plugins: [
        {
          name: "@takazudo/zudo-doc/plugins/routes",
          options: { settings: { headerNav: hostNav, headerRightItems: hostRightItems } },
        },
      ],
      collections: [],
    };

    const merged = withZudoSg(configuredPreset, OPTIONS);
    const routesPlugin = merged.plugins[0] as (typeof configuredPreset.plugins)[number];

    expect(routesPlugin.options.settings.headerNav).toBe(hostNav);
    // Only the trigger is appended; the host's own right-hand items are kept.
    expect(routesPlugin.options.settings.headerRightItems).toEqual([
      { type: "component", component: "theme-toggle" },
      { type: "html", html: expect.stringContaining(TRIGGER_ID) },
    ]);
    expect(configuredPreset.plugins[0]?.options.settings.headerRightItems).toBe(hostRightItems);
    expect(hostRightItems).toHaveLength(1);
  });

  it("allows a minimal host to opt out of styleguide chrome defaults", () => {
    const merged = withZudoSg(preset, { ...OPTIONS, chromeDefaults: false });
    const settings = (merged.plugins[0] as { options: { settings: Record<string, unknown> } }).options.settings;
    expect(settings).not.toHaveProperty("headerNav");
    // The trigger pass is independent of chromeDefaults.
    expect(triggerItemsOf(merged.plugins[0])).toHaveLength(1);
    expect(preset.plugins[0]?.options?.settings).toEqual({});
  });
});

describe("withZudoSg() header token trigger", () => {
  const configuredHost = () => ({
    plugins: [
      {
        name: "@takazudo/zudo-doc/plugins/routes",
        options: {
          settings: {
            headerNav: [
              { label: "Docs", path: "/docs", categoryMatch: "docs" },
              { label: "Architecture", path: "/architecture", categoryMatch: "architecture" },
              { label: "Components", path: "/components", categoryMatch: "components" },
              { label: "Design Tokens", path: "/tokens" },
            ],
            headerRightItems: [{ type: "component", component: "theme-toggle" }],
          },
        },
      },
    ],
    collections: [],
  });

  // The regression guard for the `withStyleguideChromeDefaults` early-return:
  // a host with its own headerNav must still receive the trigger.
  it("injects the trigger even when the host supplies a populated headerNav", () => {
    const merged = withZudoSg(configuredHost(), OPTIONS);
    expect(triggerItemsOf(merged.plugins[0])).toHaveLength(1);
  });

  it("lands after the search item chromeDefaults appends for a bare scaffold", () => {
    const bare = {
      plugins: [
        { name: "@takazudo/zudo-doc/plugins/routes", options: { settings: { headerNav: [], headerRightItems: [] } } },
      ],
      collections: [],
    };
    const items = headerRightItemsOf(withZudoSg(bare, OPTIONS).plugins[0]);
    expect(items).toEqual([
      { type: "component", component: "search" },
      { type: "html", html: expect.stringContaining(TRIGGER_ID) },
    ]);
  });

  it("still injects the trigger when chromeDefaults is off", () => {
    const merged = withZudoSg(configuredHost(), { ...OPTIONS, chromeDefaults: false });
    expect(triggerItemsOf(merged.plugins[0])).toHaveLength(1);
  });

  it("injects nothing when headerTokenTrigger is false", () => {
    const merged = withZudoSg(configuredHost(), { ...OPTIONS, headerTokenTrigger: false });
    expect(triggerItemsOf(merged.plugins[0])).toHaveLength(0);
    expect(headerRightItemsOf(merged.plugins[0])).toEqual([{ type: "component", component: "theme-toggle" }]);
  });

  it("is idempotent across a second withZudoSg() pass over the same fragment", () => {
    const once = withZudoSg(configuredHost(), OPTIONS);
    const twice = withZudoSg(once, OPTIONS);
    expect(triggerItemsOf(twice.plugins[0])).toHaveLength(1);
    expect(twice.plugins[0]).toBe(once.plugins[0]);
  });

  it("ships hidden markup plus an idempotent inline sync script", () => {
    const html = triggerItemsOf(withZudoSg(configuredHost(), OPTIONS).plugins[0])[0]?.html as string;

    expect(html).toContain(`<button id="${TRIGGER_ID}" type="button" hidden `);
    expect(html).toContain(
      'class="flex items-center justify-center text-muted transition-colors hover:text-fg cursor-pointer"',
    );
    expect(html).toContain('aria-label="Open component tokens panel"');
    expect(html).toContain('title="Component tokens"');
    expect(html).toContain("onclick=\"window.dispatchEvent(new CustomEvent('toggle-preview-token-panel'))\"");
    expect(html).toContain('<circle cx="9" cy="6" r="2.4" fill="currentColor" stroke="none"></circle>');

    expect(html).toContain("window.__sgPreviewTokensTriggerInstalled");
    expect(html).toContain("window.__sgPreviewTokenPanelCapture");
    expect(html).toContain('document.querySelector("[data-sg-engine-route]")');
    expect(html).toContain(`document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)},sync)`);
    expect(html).toContain("sync();");
    expect(html).toContain('if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync);');
  });

  it("the inline script reveals the button only while the engine-route marker is present", async () => {
    const { Window } = await import("happy-dom");
    const html = triggerItemsOf(withZudoSg(configuredHost(), OPTIONS).plugins[0])[0]?.html as string;
    const script = html.slice(html.indexOf("<script>") + "<script>".length, html.lastIndexOf("</script>"));

    const win = new Window();
    const doc = win.document;
    doc.body.innerHTML = html.slice(0, html.indexOf("<script>"));
    const btn = doc.getElementById(TRIGGER_ID) as unknown as HTMLButtonElement;

    const run = new Function("window", "document", "CustomEvent", script);
    run(win, doc, win.CustomEvent);

    expect(btn.hidden).toBe(true);
    expect((win as unknown as Record<string, unknown>).__sgPreviewTokensTriggerInstalled).toBe(true);

    const marker = doc.createElement("div");
    marker.setAttribute("data-sg-engine-route", "");
    doc.body.appendChild(marker);
    doc.dispatchEvent(new win.CustomEvent(AFTER_NAVIGATE_EVENT));
    expect(btn.hidden).toBe(false);

    marker.remove();
    doc.dispatchEvent(new win.CustomEvent(AFTER_NAVIGATE_EVENT));
    expect(btn.hidden).toBe(true);
  });

  it("installs exactly one after-navigate listener when the blob runs twice", async () => {
    const { Window } = await import("happy-dom");
    const html = triggerItemsOf(withZudoSg(configuredHost(), OPTIONS).plugins[0])[0]?.html as string;
    const script = html.slice(html.indexOf("<script>") + "<script>".length, html.lastIndexOf("</script>"));

    const win = new Window();
    const doc = win.document;
    doc.body.innerHTML = html.slice(0, html.indexOf("<script>"));

    let added = 0;
    let captures = 0;
    const originalAdd = doc.addEventListener.bind(doc);
    doc.addEventListener = ((type: string, ...rest: unknown[]) => {
      if (type === AFTER_NAVIGATE_EVENT) added += 1;
      return (originalAdd as (...args: unknown[]) => unknown)(type, ...rest);
    }) as typeof doc.addEventListener;

    const originalWindowAdd = win.addEventListener.bind(win);
    win.addEventListener = ((type: string, ...rest: unknown[]) => {
      if (type === "toggle-preview-token-panel") captures += 1;
      return (originalWindowAdd as (...args: unknown[]) => unknown)(type, ...rest);
    }) as typeof win.addEventListener;

    const run = new Function("window", "document", "CustomEvent", script);
    run(win, doc, win.CustomEvent);
    run(win, doc, win.CustomEvent);

    expect(added).toBe(1);
    expect(captures).toBe(1);
  });
});

describe("zudoSg() externalPreview + route opt-out", () => {
  it("forwards externalPreview verbatim to the routes plugin", () => {
    const { plugins } = zudoSg({ ...OPTIONS, externalPreview: { url: "/preview/frame", trailingSlash: "never" } });
    expect(plugins[0]?.options).toMatchObject({ externalPreview: { url: "/preview/frame", trailingSlash: "never" } });
  });

  it("forwards routes.componentsPreview: false / routes.tokens: false verbatim", () => {
    const { plugins } = zudoSg({ ...OPTIONS, routes: { componentsPreview: false, tokens: false } });
    expect(plugins[0]?.options).toMatchObject({ routes: { componentsPreview: false, tokens: false } });
  });

  it("descriptor mode forwards externalPreview alongside registryMode/descriptorModule", () => {
    const { componentsRoots: _roots, registryOut: _out, ...BASE } = OPTIONS;
    const fragment = zudoSg({
      ...BASE,
      registry: { mode: "descriptor", module: "./src/sg/descriptors.ts" },
      externalPreview: { url: "/preview/frame" },
    });
    expect(fragment.plugins[0]?.options).toMatchObject({
      registryMode: "descriptor",
      descriptorModule: "./src/sg/descriptors.ts",
      externalPreview: { url: "/preview/frame" },
    });
  });
});

describe("withZudoSg() Design Tokens nav link follows tokens-route visibility", () => {
  const bareHost = () => ({
    plugins: [{ name: "@takazudo/zudo-doc/plugins/routes", options: { settings: { headerNav: [], headerRightItems: [] } } }],
    collections: [],
  });

  function headerNavOf(merged: ReturnType<typeof withZudoSg>): Array<Record<string, unknown>> {
    return (merged.plugins[0] as { options: { settings: { headerNav: Array<Record<string, unknown>> } } }).options.settings
      .headerNav;
  }

  function localePrefixesOf(merged: ReturnType<typeof withZudoSg>): string[] {
    return (merged.plugins[0] as { options: { settings: { defaultLocaleOnlyPrefixes: string[] } } }).options.settings
      .defaultLocaleOnlyPrefixes;
  }

  it("keeps the Design Tokens link when tokens is enabled (module mode default)", () => {
    const merged = withZudoSg(bareHost(), OPTIONS);
    expect(headerNavOf(merged).map((item) => item.label)).toEqual(["Components", "Design Tokens"]);
    expect(localePrefixesOf(merged)).toContain("/tokens/");
  });

  it("drops the Design Tokens link when routes.tokens: false", () => {
    const merged = withZudoSg(bareHost(), { ...OPTIONS, routes: { tokens: false } });
    expect(headerNavOf(merged).map((item) => item.label)).toEqual(["Components"]);
    expect(localePrefixesOf(merged)).not.toContain("/tokens/");
  });

  it("drops the Design Tokens link in descriptor mode with no token manifest (implied disable)", () => {
    const { componentsRoots: _roots, registryOut: _out, tokens: _tokens, ...BASE } = OPTIONS;
    const merged = withZudoSg(bareHost(), {
      ...BASE,
      registry: { mode: "descriptor", module: "./src/sg/descriptors.ts" },
      externalPreview: { url: "/preview/frame" },
    });
    expect(headerNavOf(merged).map((item) => item.label)).toEqual(["Components"]);
    expect(localePrefixesOf(merged)).not.toContain("/tokens/");
  });

  it("keeps the Design Tokens link in descriptor mode when a token manifest is configured", () => {
    const { componentsRoots: _roots, registryOut: _out, ...BASE } = OPTIONS;
    const merged = withZudoSg(bareHost(), {
      ...BASE,
      registry: { mode: "descriptor", module: "./src/sg/descriptors.ts" },
      externalPreview: { url: "/preview/frame" },
    });
    // BASE keeps OPTIONS.tokens (manifestOut set) — the shared helper must agree with the plugin here.
    expect(headerNavOf(merged).map((item) => item.label)).toEqual(["Components", "Design Tokens"]);
  });

  it("an explicit routes.tokens pattern overrides the descriptor-mode implied disable", () => {
    const { componentsRoots: _roots, registryOut: _out, tokens: _tokens, ...BASE } = OPTIONS;
    const merged = withZudoSg(bareHost(), {
      ...BASE,
      registry: { mode: "descriptor", module: "./src/sg/descriptors.ts" },
      externalPreview: { url: "/preview/frame" },
      routes: { tokens: "/design-tokens" },
    });
    expect(headerNavOf(merged).map((item) => item.label)).toEqual(["Components", "Design Tokens"]);
    expect(headerNavOf(merged).find((item) => item.label === "Design Tokens")?.path).toBe("/design-tokens");
  });
});

describe("config module purity", () => {
  it("has no node: imports (zfb evaluates configs node-free)", () => {
    const source = readFileSync(resolve(HERE, "../index.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']node:/);
    expect(source).not.toMatch(/import\s*\(\s*["']node:/);
  });
});
