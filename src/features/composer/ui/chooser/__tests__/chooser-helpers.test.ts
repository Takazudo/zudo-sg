import { describe, expect, it } from "vitest";
import { VIRTUAL_ROOT_SLOT_ID } from "@/composer";
import { describeInsertionTarget, eligibleEntries, matchesQuery } from "../chooser-helpers";
import { buildCatalogById, buildManifestIndex } from "../../tree/tree-helpers";
import {
  FIXTURE_IDS,
  fixtureCatalog,
  fixtureDocument,
  fixtureNode,
  makeAbcDocument,
  resetFixtureIds,
} from "../../tree/__tests__/fixtures";

describe("eligibleEntries", () => {
  it("the virtual root accepts every catalog entry", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const manifest = buildManifestIndex(fixtureCatalog);
    const { entries, blockedReason } = eligibleEntries(document, manifest, fixtureCatalog, {
      parentId: null,
      slotId: VIRTUAL_ROOT_SLOT_ID,
      index: 1,
    });
    expect(blockedReason).toBeNull();
    expect(entries.map((e) => e.componentId).sort()).toEqual(
      fixtureCatalog.map((e) => e.componentId).sort(),
    );
  });

  it("filters by an accepts whitelist", () => {
    resetFixtureIds();
    const document = fixtureDocument([fixtureNode(FIXTURE_IDS.gallery, {}, { items: [] }, "gallery")]);
    const manifest = buildManifestIndex(fixtureCatalog);
    const { entries, blockedReason } = eligibleEntries(document, manifest, fixtureCatalog, {
      parentId: "gallery",
      slotId: "items",
      index: 0,
    });
    expect(blockedReason).toBeNull();
    expect(entries.map((e) => e.componentId)).toEqual([FIXTURE_IDS.box]);
  });

  it("blocks with a reason when a single-cardinality slot is already occupied", () => {
    resetFixtureIds();
    const document = makeAbcDocument(); // split.left already holds "A"
    const manifest = buildManifestIndex(fixtureCatalog);
    const { entries, blockedReason } = eligibleEntries(document, manifest, fixtureCatalog, {
      parentId: "split",
      slotId: "left",
      index: 1,
    });
    expect(entries).toEqual([]);
    expect(blockedReason).toMatch(/already has a component/i);
  });

  it("allows an unrestricted many-cardinality slot to accept everything", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const manifest = buildManifestIndex(fixtureCatalog);
    const { entries } = eligibleEntries(document, manifest, fixtureCatalog, {
      parentId: "split",
      slotId: "right",
      index: 2,
    });
    expect(entries.map((e) => e.componentId).sort()).toEqual(
      fixtureCatalog.map((e) => e.componentId).sort(),
    );
  });
});

describe("matchesQuery", () => {
  it("matches title/category/description case-insensitively", () => {
    const box = fixtureCatalog.find((e) => e.componentId === FIXTURE_IDS.box)!;
    expect(matchesQuery(box, "BOX")).toBe(true);
    expect(matchesQuery(box, "content")).toBe(true);
    expect(matchesQuery(box, "generic")).toBe(true);
    expect(matchesQuery(box, "nope")).toBe(false);
  });

  it("an empty query matches everything", () => {
    const box = fixtureCatalog.find((e) => e.componentId === FIXTURE_IDS.box)!;
    expect(matchesQuery(box, "   ")).toBe(true);
  });
});

describe("describeInsertionTarget", () => {
  it("describes the virtual root", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const manifest = buildManifestIndex(fixtureCatalog);
    const catalogById = buildCatalogById(fixtureCatalog);
    expect(
      describeInsertionTarget(document, manifest, catalogById, {
        parentId: null,
        slotId: VIRTUAL_ROOT_SLOT_ID,
        index: 0,
      }),
    ).toBe("Document root");
  });

  it("describes a real parent/slot as 'Title › Slot label'", () => {
    resetFixtureIds();
    const document = makeAbcDocument();
    const manifest = buildManifestIndex(fixtureCatalog);
    const catalogById = buildCatalogById(fixtureCatalog);
    expect(
      describeInsertionTarget(document, manifest, catalogById, { parentId: "split", slotId: "right", index: 2 }),
    ).toBe("Split Layout › Right");
  });
});
