import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleDocument } from "@/composer";
import { doc, node } from "@/composer/__tests__/fixtures";
import {
  COMPOSER_DOCUMENT_STORAGE_KEY,
  initializeComposerStorage,
  loadComposerDocument,
  resetComposerStorage,
  saveComposerDocument,
} from "../storage";

const KEY = COMPOSER_DOCUMENT_STORAGE_KEY;

beforeEach(() => {
  localStorage.clear();
});

describe("loadComposerDocument / saveComposerDocument", () => {
  it("round-trips a document that was already saved (status: ok)", () => {
    const sample = createSampleDocument();
    const mine = doc([node("x.box", { label: "Mine" }, {}, "mine-1")], "Mine");
    localStorage.setItem(KEY, JSON.stringify(mine));

    const outcome = loadComposerDocument(sample, KEY);
    expect(outcome.status).toBe("ok");
    expect(outcome.document).toEqual(mine);
  });

  it("reports a fresh sample when nothing is stored", () => {
    const sample = createSampleDocument();
    const outcome = loadComposerDocument(sample, KEY);
    expect(outcome.status).toBe("fresh");
    expect(outcome.document).toEqual(sample);
  });

  it("recovers to the sample for malformed JSON", () => {
    localStorage.setItem(KEY, "{not json");
    const sample = createSampleDocument();
    const outcome = loadComposerDocument(sample, KEY);
    expect(outcome.status).toBe("recovered");
    expect(outcome.document).toEqual(sample);
  });

  it("quarantines a future schema version without exposing raw storage as usable", () => {
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 999, id: "x", name: "x", root: [] }));
    const sample = createSampleDocument();
    const outcome = loadComposerDocument(sample, KEY);
    expect(outcome.status).toBe("quarantined");
    if (outcome.status === "quarantined") {
      expect(outcome.foundSchemaVersion).toBe(999);
      expect(outcome.document).toEqual(sample);
    }
  });

  it("saveComposerDocument reports ok:true on a successful write", () => {
    const result = saveComposerDocument(createSampleDocument(), KEY);
    expect(result).toEqual({ ok: true });
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("saveComposerDocument never throws and reports ok:false when storage is blocked", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    const result = saveComposerDocument(createSampleDocument(), KEY);
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    spy.mockRestore();
  });

  it("loadComposerDocument never throws when getItem is blocked (treated as nothing stored)", () => {
    const spy = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    const outcome = loadComposerDocument(createSampleDocument(), KEY);
    expect(outcome.status).toBe("fresh");
    spy.mockRestore();
  });
});

describe("resetComposerStorage", () => {
  it("overwrites storage with a fresh sample copy, even over quarantined raw data", () => {
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 999, id: "x", name: "x", root: [] }));
    const sample = createSampleDocument();
    const { document, write } = resetComposerStorage(sample, KEY);
    expect(document).toEqual(sample);
    expect(write.ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(sample);
  });

  it("reports a blocked write honestly without throwing", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { write } = resetComposerStorage(createSampleDocument(), KEY);
    expect(write.ok).toBe(false);
    spy.mockRestore();
  });
});

describe("initializeComposerStorage", () => {
  it("writes back a fresh sample so a reload sees status 'ok' next time", () => {
    const sample = createSampleDocument();
    const first = initializeComposerStorage(sample, KEY);
    expect(first.outcome.status).toBe("fresh");
    expect(first.write?.ok).toBe(true);

    const second = initializeComposerStorage(sample, KEY);
    expect(second.outcome.status).toBe("ok");
    expect(second.write).toBeNull();
  });

  it("writes back a recovered sample after malformed storage", () => {
    localStorage.setItem(KEY, "{broken");
    const result = initializeComposerStorage(createSampleDocument(), KEY);
    expect(result.outcome.status).toBe("recovered");
    expect(result.write?.ok).toBe(true);
  });

  it("never writes back a quarantined future schema — raw storage stays untouched", () => {
    const rawFuture = JSON.stringify({ schemaVersion: 999, id: "future", name: "Future", root: [] });
    localStorage.setItem(KEY, rawFuture);
    const result = initializeComposerStorage(createSampleDocument(), KEY);
    expect(result.outcome.status).toBe("quarantined");
    expect(result.write).toBeNull();
    expect(localStorage.getItem(KEY)).toBe(rawFuture);
  });

  it("blocked storage still resolves an in-memory outcome and reports the write failure honestly", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const result = initializeComposerStorage(createSampleDocument(), KEY);
    expect(result.outcome.status).toBe("fresh");
    expect(result.write?.ok).toBe(false);
    spy.mockRestore();
  });
});
