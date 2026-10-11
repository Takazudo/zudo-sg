// #915 / #954: `@codemirror/language`'s highlighter reads Lezer `NodeProp`s whose
// identity is module-local, so a second `@lezer/common` (or a second
// language/state instance) in the graph breaks highlighting or extensions.
// Pin this repo's resolved graph to one instance per identity-sensitive package.
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CodeMirror/Lezer module identity", () => {
  const from = (specifier: string, base: string): string =>
    realpathSync(createRequire(base).resolve(specifier));
  const engine = createRequire(import.meta.url).resolve("../editor-setup.ts");

  const language = from("@codemirror/language", engine);
  const langCss = from("@codemirror/lang-css", engine);
  const langJs = from("@codemirror/lang-javascript", engine);
  const lezerCss = from("@lezer/css", langCss);
  const lezerJs = from("@lezer/javascript", langJs);
  // Every package here declares @lezer/common as its own dependency.
  const commonConsumers = [
    language,
    langCss,
    langJs,
    from("@codemirror/commands", engine),
    from("@codemirror/autocomplete", langCss),
    from("@lezer/highlight", engine),
    from("@lezer/lr", language),
    lezerCss,
    lezerJs,
  ];

  it.each([
    ["@lezer/common", commonConsumers],
    ["@lezer/highlight", [engine, language, lezerCss, lezerJs]],
    ["@codemirror/language", [engine, langCss, langJs, from("@codemirror/commands", engine)]],
    ["@codemirror/state", [engine, language, langCss, langJs, from("@codemirror/view", engine)]],
  ])("resolves a single %s instance", (specifier, bases) => {
    expect(new Set(bases.map((base) => from(specifier, base))).size).toBe(1);
  });
});
