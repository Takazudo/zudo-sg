import { describe, expect, it } from "vitest";
import ts from "typescript";
import { javascriptImports } from "../verify-react-descriptor-host-contracts.mjs";

const resource = './islands-resource-zfb_md_wasm_highlight_glue-abc.mjs';
const literal = `const glueUrl = ${JSON.stringify(resource)};`;

describe("packed React host emitted imports", () => {
  it.each(['url => import(url)', 'url => (import(url))'])(
    "traces the WASM glue default with either bundler: %s", initializer => {
      const result = javascriptImports(ts, `${literal} function api({ importGlue: load = ${initializer} }) {}`);
      expect(result.imports).toEqual([resource]);
    },
  );

  it.each([
    'function api({ other: load = url => import(url) }) {}',
    'function api({ importGlue: load = url => import(other) }) {}',
    'function api({ importGlue: load = url => import(transform(url)) }) {}',
    'function api({ importGlue: load = (url, other) => import(url) }) {}',
    'const load = url => import(url);',
  ])("rejects opaque imports outside the exact glue binding", source => {
    expect(() => javascriptImports(ts, literal + source)).toThrow("untraceable dynamic import");
  });

  it("rejects missing or ambiguous emitted glue resources", () => {
    const source = 'function api({ importGlue: load = url => import(url) }) {}';
    expect(() => javascriptImports(ts, source)).toThrow("no unique emitted glue resource");
    expect(() => javascriptImports(ts, `${literal} const other = './islands-resource-zfb_md_wasm_parse_glue-def.mjs'; ${source}`)).toThrow("no unique emitted glue resource");
  });

  it("retains static and literal dynamic imports", () => {
    expect(javascriptImports(ts, 'import "./a.js"; export * from "./b.js"; import(`./c.js`);').imports)
      .toEqual(['./a.js', './b.js', './c.js']);
  });
});
