import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureManifest, makeAbcDocument } from "../../../__tests__/fixtures";
import {
  CompositionPersistenceError,
  type CompositionRecord,
} from "../../../library";
import { generateJsx } from "../../../source/generate-jsx";
import { createManifest } from "../../../model/types";
import { createSampleDocument } from "../../../sample/sample-document";
import { composerManifest } from "@/styleguide/data/composer-registry";

const { DEV_CONFIG } = vi.hoisted(() => ({
  DEV_CONFIG: {
    endpoint: "/dev-only-endpoint",
    capability: "dev-secret",
    capabilityHeader: "x-test-capability",
    maxBodyBytes: 2_097_152,
  },
}));

vi.mock("virtual:composer-file-provider-config", () => ({
  fileProviderConfig: DEV_CONFIG,
}));

import { createFileProviderCompositionStore } from "../store";

const T1 = "2026-01-02T03:04:05.000Z";

function record(id = "alpha"): CompositionRecord {
  const document = makeAbcDocument();
  document.id = id;
  return { id, createdAt: T1, updatedAt: T1, document };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
});

describe("browser file-provider adapter", () => {
  it("generates put JSX byte-for-byte with the production generator", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: null }));
    const store = createFileProviderCompositionStore({ manifest: fixtureManifest, fetch: fetchMock });
    const value = record();

    await store!.put(value);

    const [endpoint, init] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe(DEV_CONFIG.endpoint);
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "same-origin" });
    expect(new Headers(init?.headers).get(DEV_CONFIG.capabilityHeader)).toBe(DEV_CONFIG.capability);
    const body = JSON.parse(String(init?.body));
    expect(body.operation).toBe("put");
    expect(body).not.toHaveProperty("path");
    expect(body).not.toHaveProperty("filename");
    expect(body.jsx).toBe(generateJsx(value.document, fixtureManifest).code);
  });

  it("defaults to the real production composerManifest without copying it", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: null }));
    const document = createSampleDocument();
    document.id = "sample-real";
    const value: CompositionRecord = {
      id: document.id,
      createdAt: T1,
      updatedAt: T1,
      document,
    };
    const direct = generateJsx(document, createManifest(composerManifest));
    expect(direct.ok).toBe(true);

    const store = createFileProviderCompositionStore({ fetch: fetchMock });
    await store!.put(value);

    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body.jsx).toBe(direct.code);
  });

  it("generates requested list/get repair bytes then waits for repaired success", async () => {
    const value = record();
    const summary = {
      id: value.id, name: value.document.name,
      createdAt: value.createdAt, updatedAt: value.updatedAt, nodeCount: 4,
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        ok: false,
        error: { code: "jsx-required", operation: "list", message: "repair" },
        record: value,
      }, 409))
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: [summary] }));
    const store = createFileProviderCompositionStore({ manifest: fixtureManifest, fetch: fetchMock });

    await expect(store!.list()).resolves.toEqual([summary]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    const second = JSON.parse(String(fetchMock.mock.calls[1]![1]?.body));
    expect(first.jsxById).toEqual({});
    expect(second.jsxById.alpha).toBe(generateJsx(value.document, fixtureManifest).code);
  });

  it("surfaces generation diagnostics without claiming save or repair success", async () => {
    const value = record();
    value.document.root[0]!.componentId = "unknown.component";
    const store = createFileProviderCompositionStore({ manifest: fixtureManifest, fetch: fetchMock });

    await expect(store!.put(value)).rejects.toMatchObject({
      name: "CompositionPersistenceError",
      operation: "put",
      code: "validation",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(jsonResponse({
      ok: false,
      error: { code: "jsx-required", operation: "get", message: "repair" },
      record: value,
    }, 409));
    await expect(store!.get("alpha")).rejects.toBeInstanceOf(CompositionPersistenceError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps transport and sanitized server failures to the shared error contract", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    const store = createFileProviderCompositionStore({ manifest: fixtureManifest, fetch: fetchMock });
    await expect(store!.clear()).rejects.toMatchObject({
      operation: "clear", code: "unavailable", retryable: true,
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: false,
      error: { code: "blocked", operation: "delete", message: "Inspect the compositions directory." },
    }, 409));
    await expect(store!.delete("alpha")).rejects.toMatchObject({
      operation: "delete", code: "blocked", retryable: false,
    });
  });

  it("rejects malformed JSON protocol errors through the shared error contract", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false }));
    const store = createFileProviderCompositionStore({ manifest: fixtureManifest, fetch: fetchMock });

    await expect(store!.clear()).rejects.toMatchObject({
      name: "CompositionPersistenceError",
      operation: "clear",
      code: "unknown",
    });
  });

  it("returns the shared get/delete/clear result shapes", async () => {
    const value = record();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: { status: "loaded", record: value } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: null }));
    const store = createFileProviderCompositionStore({ manifest: fixtureManifest, fetch: fetchMock });

    await expect(store!.get("alpha")).resolves.toEqual({ status: "loaded", record: value });
    await expect(store!.delete("alpha")).resolves.toBe(true);
    await expect(store!.clear()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).operation))
      .toEqual(["get", "delete", "clear"]);
  });
});
