// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

const script = await import(resolve(import.meta.dirname, "../../scripts/check-chrome-tokens.mjs"));

describe("check:chrome-tokens", () => {
  it("reports a bare chrome utility with its bracket replacement", () => {
    const findings = script.lintSource('const className = "hover:border-border";', "src/example.tsx");

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: 1,
          token: "hover:border-border",
          replacement: "hover:border-[color:var(--sg-border)]",
        }),
      ]),
    );
  });

  it("accepts the bracket arbitrary-value form", () => {
    const source = 'const className = "hover:border-[color:var(--sg-border)] bg-[var(--sg-surface)]";';

    expect(script.lintSource(source, "src/example.tsx")).toEqual([]);
  });
});
