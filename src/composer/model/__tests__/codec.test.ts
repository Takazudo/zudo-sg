import { describe, expect, it } from "vitest";
import { doc, node, FIXTURE_COMPONENT_IDS as X } from "../../__tests__/fixtures";
import { decodeCompositionDocument } from "../codec";
import { COMPOSITION_SCHEMA_V1, COMPOSITION_SCHEMA_VERSION } from "../types";
import { isStructurallyValidDocument } from "../validate";

describe("decodeCompositionDocument", () => {
  it("upgrades v1 by changing only the schema version", () => {
    const legacy = {
      ...doc([node(X.box, { label: "A" }, {}, "node-a")]),
      schemaVersion: COMPOSITION_SCHEMA_V1,
    };
    const before = JSON.parse(JSON.stringify(legacy));

    const result = decodeCompositionDocument(legacy);

    expect(result.status).toBe("decoded");
    if (result.status !== "decoded") return;
    expect(result.sourceSchemaVersion).toBe(COMPOSITION_SCHEMA_V1);
    expect(result.document).toEqual({ ...before, schemaVersion: COMPOSITION_SCHEMA_VERSION });
    expect(result.document).not.toBe(legacy);
    expect(legacy).toEqual(before);
    expect(isStructurallyValidDocument(result.document)).toBe(true);
  });

  it("keeps malformed and future values distinct from a supported older document", () => {
    expect(
      decodeCompositionDocument({ schemaVersion: COMPOSITION_SCHEMA_V1, root: "not-an-array" }).status,
    ).toBe("decoded");
    expect(decodeCompositionDocument({ schemaVersion: COMPOSITION_SCHEMA_VERSION + 1 })).toEqual({
      status: "future-schema",
      foundSchemaVersion: COMPOSITION_SCHEMA_VERSION + 1,
    });
    expect(decodeCompositionDocument({ id: "missing-version" })).toEqual({ status: "malformed" });
  });
});
