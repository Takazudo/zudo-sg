import { describe, expect, it } from "vitest";

import { scanInfoStringFences } from "../fence-scan";

describe("scanInfoStringFences", () => {
  it("returns the language and body of a backtick fence", () => {
    expect(scanInfoStringFences("```ts\nconst a = 1;\n```\n")).toEqual([
      { language: "ts", code: "const a = 1;" },
    ]);
  });

  it("takes only the first word of the info string", () => {
    expect(scanInfoStringFences('```js title="app.js" {1-2}\nlet a;\n```\n')).toEqual([
      { language: "js", code: "let a;" },
    ]);
  });

  it("supports tilde fences, whose info string may contain backticks", () => {
    expect(scanInfoStringFences("~~~py\nx = 1\n~~~\n")).toEqual([
      { language: "py", code: "x = 1" },
    ]);
  });

  it("ignores a backtick-fence opener whose info string contains a backtick", () => {
    expect(scanInfoStringFences("```js `inline`\nnot a fence\n```\n")).toEqual([]);
  });

  it("skips fences with no info string", () => {
    expect(scanInfoStringFences("```\nplain\n```\n")).toEqual([]);
  });

  it("keeps document order across mixed fences", () => {
    const source = "```js\na\n```\n\ntext\n\n```\nplain\n```\n\n~~~css\nb\n~~~\n";
    expect(scanInfoStringFences(source).map((fence) => fence.language)).toEqual(["js", "css"]);
  });

  it("does not treat a fence-looking line inside a fence body as an opener", () => {
    const source = "````md\n```js\nnested\n```\n````\n";
    expect(scanInfoStringFences(source)).toEqual([
      { language: "md", code: "```js\nnested\n```" },
    ]);
  });

  it("strips the opening fence's indentation from the body", () => {
    expect(scanInfoStringFences("   ```ts\n   const a = 1;\n   ```\n")).toEqual([
      { language: "ts", code: "const a = 1;" },
    ]);
  });

  it("runs an unclosed fence to the end of the document", () => {
    expect(scanInfoStringFences("```ts\nconst a = 1;\n")).toEqual([
      { language: "ts", code: "const a = 1;\n" },
    ]);
  });

  it("requires the closing run to be at least as long as the opening run", () => {
    expect(scanInfoStringFences("````ts\n```\nstill inside\n````\n")).toEqual([
      { language: "ts", code: "```\nstill inside" },
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(scanInfoStringFences("```ts\r\nconst a = 1;\r\n```\r\n")).toEqual([
      { language: "ts", code: "const a = 1;" },
    ]);
  });

  it("handles lone CR line endings", () => {
    expect(scanInfoStringFences("```ts\rconst a = 1;\r```\r")).toEqual([
      { language: "ts", code: "const a = 1;" },
    ]);
  });

  it("does not see fences nested in a container block", () => {
    // Documented limitation — the caller's count guard degrades on the
    // resulting mismatch rather than mislabelling code.
    expect(scanInfoStringFences("> ```js\n> let a;\n> ```\n")).toEqual([]);
  });
});
