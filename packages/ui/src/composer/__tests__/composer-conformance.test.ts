import { describe, expect, it } from "vitest";
import {
  ContractValidationError,
  componentPackManifestSchema,
  validateRuntimeParity,
  type ContractIssueCode,
} from "@zudo-composer/component-contract";
import {
  componentPack,
  componentPackManifest,
  componentRuntimeRegistry,
} from "../../composer-pack";
import * as publicUi from "../../index";

type MutableRecord = Record<string, unknown>;

function manifest(): MutableRecord {
  return structuredClone(componentPackManifest) as unknown as MutableRecord;
}

function components(value: MutableRecord): MutableRecord[] {
  return value.components as MutableRecord[];
}

function component(value: MutableRecord, id = "ui.callout"): MutableRecord {
  const found = components(value).find((entry) => entry.id === id);
  if (!found) throw new Error(`fixture component ${id} missing`);
  return found;
}

function expectCode(run: () => unknown, code: ContractIssueCode): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ContractValidationError);
    expect((error as ContractValidationError).issues[0]?.code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe("real provider pack conformance", () => {
  it("normalizes and JSON-round-trips all 12 serializable definitions", () => {
    expect(componentPackManifest.components).toHaveLength(12);
    for (const entry of componentPackManifest.components) {
      expect(entry.defaults).toBeDefined();
      expect(entry.fields).toBeDefined();
      expect(entry.slots).toBeDefined();
      expect(entry).not.toHaveProperty("component");
      expect(entry).not.toHaveProperty("adapters");
    }
    expect(componentPackManifestSchema.parse(JSON.parse(JSON.stringify(componentPackManifest))))
      .toEqual(componentPackManifest);
  });

  it.each([
    ["duplicate id", "DUPLICATE_COMPONENT_ID", (value: MutableRecord) => components(value).push(structuredClone(components(value)[0]))],
    ["duplicate field", "DUPLICATE_FIELD_PROP", (value: MutableRecord) => { const fields = component(value).fields as unknown[]; fields.push(structuredClone(fields[0])); }],
    ["duplicate slot", "DUPLICATE_SLOT_ID", (value: MutableRecord) => { const slots = component(value).slots as unknown[]; slots.push(structuredClone(slots[0])); }],
    ["duplicate source", "DUPLICATE_SOURCE", (value: MutableRecord) => { const copy = structuredClone(components(value)[0]); copy.id = "ui.copy"; components(value).push(copy); }],
  ] as const)("rejects %s", (_label, code, mutate) => {
    const value = manifest();
    mutate(value);
    expectCode(() => componentPackManifestSchema.parse(value), code);
  });

  it("rejects invalid defaults, field/slot collisions, reserved keys, and accepts", () => {
    const invalidValue = manifest();
    (component(invalidValue).defaults as MutableRecord).tone = "unknown";
    expectCode(() => componentPackManifestSchema.parse(invalidValue), "INVALID_FIELD_DOMAIN");

    const collision = manifest();
    (component(collision).slots as MutableRecord[])[0]!.prop = "tone";
    expectCode(() => componentPackManifestSchema.parse(collision), "FIELD_SLOT_PROP_COLLISION");

    const reserved = manifest();
    (component(reserved).fields as MutableRecord[])[0]!.prop = "dangerouslySetInnerHTML";
    expectCode(() => componentPackManifestSchema.parse(reserved), "RESERVED_KEY");

    const accepts = manifest();
    (component(accepts, "ui.auto-grid").slots as MutableRecord[])[0]!.accepts = ["ui.missing"];
    expectCode(() => componentPackManifestSchema.parse(accepts), "UNRESOLVED_ACCEPTS");
  });

  it.each(["./private", "/private", "https://example.test/ui", "@zudo-sg/ui/src/internal"])(
    "rejects non-public source module %s",
    (module) => {
      const value = manifest();
      (component(value).source as MutableRecord).module = module;
      expectCode(() => componentPackManifestSchema.parse(value), "INVALID_PUBLIC_IMPORT");
    },
  );

  it.each(["default export", "foo-bar", "2Component", "foo.bar"])(
    "rejects invalid public export identifier %s",
    (exportName) => {
      const value = manifest();
      (component(value).source as MutableRecord).exportName = exportName;
      expectCode(() => componentPackManifestSchema.parse(value), "INVALID_PUBLIC_EXPORT");
    },
  );

  it("keeps manifest, runtime, public exports, and inline adapters in exact parity", () => {
    expect(validateRuntimeParity(componentPackManifest, componentRuntimeRegistry)).toEqual(componentPack);
    for (const entry of componentPackManifest.components) {
      const runtime = componentRuntimeRegistry.components[entry.id];
      expect(runtime?.schemaVersion).toBe(entry.schemaVersion);
      expect(runtime?.component).toBe(publicUi[entry.source.exportName as keyof typeof publicUi]);
      const inline = entry.fields.find((field) => field.editor.kind === "text" && field.inlineEdit);
      if (inline) {
        expect(runtime?.adapters?.inlineEditor?.field).toBe(inline.prop);
        expect(typeof runtime?.adapters?.inlineEditor?.resolveElement).toBe("function");
      } else {
        expect(runtime?.adapters?.inlineEditor).toBeUndefined();
      }
    }
  });

  it("diagnoses missing, extra, version-drifted, and mismatched inline runtimes", () => {
    const missing = { ...componentRuntimeRegistry.components };
    delete missing[componentPackManifest.components[0]!.id];
    expectCode(
      () => validateRuntimeParity(componentPackManifest, { ...componentRuntimeRegistry, components: missing }),
      "MISSING_RUNTIME_ENTRY",
    );

    expectCode(
      () => validateRuntimeParity(componentPackManifest, {
        ...componentRuntimeRegistry,
        components: { ...componentRuntimeRegistry.components, "ui.extra": { schemaVersion: 1, component: () => null } },
      }),
      "RUNTIME_MANIFEST_MISMATCH",
    );

    const prose = componentRuntimeRegistry.components["ui.prose-md"]!;
    expectCode(
      () => validateRuntimeParity(componentPackManifest, {
        ...componentRuntimeRegistry,
        components: { ...componentRuntimeRegistry.components, "ui.prose-md": { ...prose, schemaVersion: 2 } },
      }),
      "RUNTIME_COMPONENT_VERSION_MISMATCH",
    );

    expectCode(
      () => validateRuntimeParity(componentPackManifest, {
        ...componentRuntimeRegistry,
        components: { ...componentRuntimeRegistry.components, "ui.prose-md": { ...prose, adapters: undefined } },
      }),
      "INLINE_EDITOR_MISMATCH",
    );
  });
});
