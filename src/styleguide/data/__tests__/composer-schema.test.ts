import { describe, expect, it } from "vitest";
import { composerFieldSchema } from "../composer-schema";

// The `text` field kind's `inlineEdit.mode` marker (#372): keys the
// explicit-save markdown-source editing path (epic #368) as a parallel path
// alongside the existing auto-commit "plain" default (#257 / #288).
describe("composerFieldSchema — text.inlineEdit.mode (#372)", () => {
  const base = { kind: "text" as const, prop: "children", label: "Text" };

  it("accepts inlineEdit with no mode (defaults to plain at the type level)", () => {
    const result = composerFieldSchema.safeParse({ ...base, inlineEdit: {} });
    expect(result.success).toBe(true);
  });

  it('accepts mode: "plain"', () => {
    const result = composerFieldSchema.safeParse({ ...base, inlineEdit: { mode: "plain" } });
    expect(result.success).toBe(true);
  });

  it('accepts mode: "markdown-source"', () => {
    const result = composerFieldSchema.safeParse({
      ...base,
      inlineEdit: { mode: "markdown-source" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown mode value", () => {
    const result = composerFieldSchema.safeParse({
      ...base,
      inlineEdit: { mode: "rich-text" },
    });
    expect(result.success).toBe(false);
  });

  it("still rejects unexpected keys on inlineEdit (strict)", () => {
    const result = composerFieldSchema.safeParse({
      ...base,
      inlineEdit: { mode: "markdown-source", bogus: true },
    });
    expect(result.success).toBe(false);
  });
});
