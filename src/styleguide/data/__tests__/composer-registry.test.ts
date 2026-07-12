import { describe, expect, it } from "vitest";
import { h } from "preact";
import { defineComposer } from "@zudo-sg/ui";
import type { ComposerMeta, StoryModule } from "@zudo-sg/ui";
import {
  buildComposerRegistry,
  composerEntries,
  composerManifest,
  getComposerEntry,
  getComposerManifestEntry,
  isJsonSafe,
  toManifestEntry,
  validateComposerDefinitions,
  type ComposerEntry,
} from "../composer-registry";

const Dummy = (props: Record<string, unknown>) => h("div", null, String(props.label ?? ""));

/** A minimal, valid definition; overrides let each test perturb one facet. */
function makeDef(overrides: Partial<ComposerMeta> = {}): ComposerMeta {
  const base = defineComposer({
    componentId: "ui.dummy",
    version: 1,
    component: Dummy,
    source: {
      module: "@zudo-sg/ui/src/dummy/dummy",
      exportKind: "named",
      exportName: "Dummy",
    },
    defaults: { label: "Hi", tone: "a" },
    fields: [
      { kind: "text", prop: "label", label: "Label" },
      { kind: "select", prop: "tone", label: "Tone", options: ["a", "b"] },
    ],
    slots: [{ id: "body", prop: "children", label: "Body", cardinality: "many" }],
  });
  return { ...base, ...overrides };
}

/** Wraps a meta in a synthetic opted-in story module. */
function moduleFor(composer: ComposerMeta, title = "Dummy"): StoryModule {
  return {
    default: {
      title,
      category: "Layout",
      description: "d",
      usage: "u",
      composer,
    },
  } as unknown as StoryModule;
}

describe("validateComposerDefinitions", () => {
  it("accepts a well-formed definition", () => {
    expect(validateComposerDefinitions([makeDef()])).toEqual([]);
  });

  it("rejects a duplicate component id", () => {
    const errors = validateComposerDefinitions([makeDef(), makeDef()]);
    expect(errors.some((e) => /duplicate componentId/i.test(e))).toBe(true);
  });

  it("rejects a duplicate source import shared by two definitions", () => {
    const a = makeDef({ componentId: "ui.a" });
    const b = makeDef({ componentId: "ui.b" }); // same source module + export
    const errors = validateComposerDefinitions([a, b]);
    expect(errors.some((e) => /duplicate source import/i.test(e))).toBe(true);
  });

  it("rejects duplicate slot ids within a definition", () => {
    const def = makeDef({
      slots: [
        { id: "dup", prop: "children", label: "One", cardinality: "many" },
        { id: "dup", prop: "intro", label: "Two", cardinality: "single" },
      ],
    });
    expect(validateComposerDefinitions([def]).some((e) => /duplicate slot id/i.test(e))).toBe(true);
  });

  it("rejects a prop used as both a scalar field and a structural slot", () => {
    const def = makeDef({
      fields: [{ kind: "text", prop: "children", label: "Text" }],
      slots: [{ id: "body", prop: "children", label: "Body", cardinality: "many" }],
    });
    const errors = validateComposerDefinitions([def]);
    expect(errors.some((e) => /both a scalar field and a structural slot/i.test(e))).toBe(true);
  });

  it("rejects a function default (non-JSON)", () => {
    const def = makeDef({ defaults: { label: (() => "x") as unknown as string } });
    expect(validateComposerDefinitions([def]).some((e) => /not JSON-safe/i.test(e))).toBe(true);
  });

  it("rejects a VNode default (non-JSON)", () => {
    const def = makeDef({ defaults: { label: h("span", null, "x") as unknown as string } });
    expect(validateComposerDefinitions([def]).some((e) => /not JSON-safe/i.test(e))).toBe(true);
  });

  it("rejects a select default that is not one of the options", () => {
    const def = makeDef({ defaults: { label: "Hi", tone: "zzz" } });
    const errors = validateComposerDefinitions([def]);
    expect(errors.some((e) => /not one of the select options/i.test(e))).toBe(true);
  });

  it("rejects a boolean default that is not a boolean", () => {
    const def = makeDef({
      fields: [{ kind: "boolean", prop: "flag", label: "Flag" }],
      defaults: { flag: "yes" as unknown as boolean },
    });
    expect(validateComposerDefinitions([def]).some((e) => /must be a boolean/i.test(e))).toBe(true);
  });

  it("rejects more than one inline-editable field", () => {
    const def = makeDef({
      fields: [
        { kind: "text", prop: "a", label: "A", inlineEdit: {} },
        { kind: "text", prop: "b", label: "B", inlineEdit: {} },
      ],
      defaults: {},
      slots: [],
    });
    const errors = validateComposerDefinitions([def]);
    expect(errors.some((e) => /at most one inline-editable field/i.test(e))).toBe(true);
  });

  it("rejects an inline-editor adapter targeting a non-inline-editable field", () => {
    const def = makeDef({
      fields: [{ kind: "text", prop: "label", label: "Label" }],
      defaults: { label: "Hi" },
      slots: [],
      adapters: { inlineEditor: { field: "label", resolveElement: (r) => r } },
    });
    const errors = validateComposerDefinitions([def]);
    expect(errors.some((e) => /not an inline-editable text field/i.test(e))).toBe(true);
  });
});

describe("isJsonSafe", () => {
  it("accepts JSON primitives, arrays, and plain objects", () => {
    expect(isJsonSafe({ a: 1, b: "x", c: [true, null, { d: 2 }] })).toBe(true);
  });
  it("rejects functions, undefined, VNodes, and non-finite numbers", () => {
    expect(isJsonSafe(() => 1)).toBe(false);
    expect(isJsonSafe(undefined)).toBe(false);
    expect(isJsonSafe(h("span", null, "x"))).toBe(false);
    expect(isJsonSafe(Number.NaN)).toBe(false);
    expect(isJsonSafe({ nested: () => 1 })).toBe(false);
  });
  it("accepts a shared reference (DAG) but rejects a true cycle", () => {
    const shared = { k: "v" };
    expect(isJsonSafe({ a: shared, b: shared })).toBe(true);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isJsonSafe(cyclic)).toBe(false);
  });
});

describe("buildComposerRegistry (derived from story modules)", () => {
  it("exposes only metas that explicitly opted in via meta.composer", () => {
    const optedIn = moduleFor(makeDef({ componentId: "ui.opted" }), "Opted");
    const notOptedIn = {
      default: { title: "Plain", category: "Layout", description: "d", usage: "u" },
    } as unknown as StoryModule;

    const entries = buildComposerRegistry({
      "./ui/src/opted/opted.stories.tsx": optedIn,
      "./ui/src/plain/plain.stories.tsx": notOptedIn,
    });

    expect(entries.map((e) => e.componentId)).toEqual(["ui.opted"]);
  });

  it("sources display title/category/description from the StoryMeta, not the definition", () => {
    const mod = moduleFor(makeDef({ componentId: "ui.opted" }), "Fancy Title");
    const [entry] = buildComposerRegistry({ "./ui/src/x/x.stories.tsx": mod });
    expect(entry.title).toBe("Fancy Title");
    expect(entry.category).toBe("Layout");
    expect(entry.description).toBe("d");
  });

  it("throws when an opted-in definition is invalid", () => {
    const bad = moduleFor(makeDef({ defaults: { label: (() => 1) as unknown as string } }));
    expect(() => buildComposerRegistry({ "./ui/src/x/x.stories.tsx": bad })).toThrow(
      /Invalid Composer definition/i,
    );
  });
});

describe("serializable manifest projection", () => {
  const entry: ComposerEntry = {
    componentId: "ui.dummy",
    version: 1,
    title: "Dummy",
    category: "Layout",
    description: "d",
    path: "./ui/src/dummy/dummy.stories.tsx",
    definition: makeDef({
      adapters: { render: () => h("div", null), inlineEditor: undefined },
    }),
  };

  it("keeps the trusted component + adapters on the runtime entry", () => {
    expect(typeof entry.definition.component).toBe("function");
    expect(typeof entry.definition.adapters?.render).toBe("function");
  });

  it("strips the component function and adapters from the manifest entry", () => {
    const manifest = toManifestEntry(entry);
    expect("component" in manifest).toBe(false);
    expect("adapters" in manifest).toBe(false);
  });

  it("produces a manifest entry that round-trips through JSON with no data loss", () => {
    const manifest = toManifestEntry(entry);
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
  });
});

describe("live registry (no cohort opted in yet — issue #244 out of scope)", () => {
  it("composerEntries is empty until the real cohort opts in (issue #246)", () => {
    expect(composerEntries).toEqual([]);
    expect(composerManifest).toEqual([]);
  });

  it("does not surface Story.render() in the Composer contract", () => {
    // A ComposerEntry exposes `definition` (component + metadata), never a
    // Story or its render(). Guard the shape so a regression is caught.
    for (const e of composerEntries) {
      expect(e).not.toHaveProperty("render");
      expect(e).not.toHaveProperty?.("story");
    }
    expect(getComposerEntry("nope")).toBeUndefined();
    expect(getComposerManifestEntry("nope")).toBeUndefined();
  });
});
