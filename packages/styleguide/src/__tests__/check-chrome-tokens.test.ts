// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

const script = await import(resolve(import.meta.dirname, "../../scripts/check-chrome-tokens.mjs"));

describe("check:chrome-tokens", () => {
  it("reports a bare chrome utility with its declared token replacement", () => {
    const findings = script.lintSource('const className = "hover:border-border";', "src/example.tsx");

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: 1,
          token: "hover:border-border",
          replacement: "hover:border-sg-border",
        }),
      ]),
    );
  });

  it("accepts declared chrome utilities", () => {
    const source = 'const className = "hover:border-sg-border bg-sg-surface-2";';

    expect(script.lintSource(source, "src/example.tsx")).toEqual([]);
  });
  it("rejects old bracket chrome forms", () => {
    expect(script.lintSource('const c = "text-[color:var(--sg-muted)]";', "src/example.tsx")[0]).toMatchObject({ replacement: "text-sg-muted" });
  });
});
