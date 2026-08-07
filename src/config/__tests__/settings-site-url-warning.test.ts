/**
 * Guard (#194): root settings warn at module load when siteUrl is falsy,
 * since a missing siteUrl silently drops OGP absolute image URLs and
 * canonical link tags from build output.
 *
 * This exercises the real production configuration rather than a stand-in:
 *   - root settings.ts: siteUrl is "" today → the warning must fire.
 *   - doc/zfb.config.ts: the inline zudoDoc config supplies an absolute
 *     siteUrl and therefore needs no separate settings-module warning guard.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Root settings.ts runs its warning check once at module-evaluation time,
  // so a fresh module instance is needed to observe it deterministically.
  vi.resetModules();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("siteUrl configuration", () => {
  it("fires when siteUrl is empty (root settings.ts)", async () => {
    const { settings } = await import("../settings");

    expect(settings.siteUrl).toBe("");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/siteUrl/i);
  });

  it("declares the doc workspace siteUrl inside zudoDoc config", () => {
    const configSource = readFileSync(
      resolve(process.cwd(), "doc/zfb.config.ts"),
      "utf8",
    );
    const sourceFile = ts.createSourceFile(
      "doc/zfb.config.ts",
      configSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const siteUrls: string[] = [];

    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "zudoDoc" &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        for (const property of node.arguments[0].properties) {
          if (
            ts.isPropertyAssignment(property) &&
            property.name.getText(sourceFile) === "siteUrl" &&
            ts.isStringLiteral(property.initializer)
          ) {
            siteUrls.push(property.initializer.text);
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    expect(siteUrls).toEqual(["https://zudo-sg-doc.takazudomodular.com"]);
  });
});
