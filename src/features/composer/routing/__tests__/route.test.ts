import { describe, expect, it } from "vitest";

import {
  composerDocumentPath,
  formatComposerRoute,
  parseComposerRoute,
} from "../route";

const knownProvider = (id: string): boolean => id === "indexeddb" || id === "files";

describe("Composer static hash routes", () => {
  it("formats and parses the root library route", () => {
    expect(composerDocumentPath()).toBe("/composer/");
    expect(formatComposerRoute({ kind: "index" })).toBe("/composer/#/");
    expect(
      parseComposerRoute(
        { pathname: "/composer/", hash: "#/" },
        { isKnownProvider: knownProvider },
      ),
    ).toEqual({ status: "matched", route: { kind: "index" } });
  });

  it.each([
    [{ basePath: "/zudo-sg/" } as const, "/zudo-sg/composer/#/"],
    [{ basePath: "team/zudo-sg" } as const, "/team/zudo-sg/composer/#/"],
    [
      { basePath: "/zudo-sg/", trailingSlash: "never" } as const,
      "/zudo-sg/composer#/",
    ],
    [{ basePath: "/", trailingSlash: "never" } as const, "/composer#/"],
  ])("honors configured base and trailing-slash policy", (config, expected) => {
    const url = formatComposerRoute({ kind: "index" }, config);
    expect(url).toBe(expected);
    const hashAt = url.indexOf("#");
    expect(
      parseComposerRoute(
        { pathname: url.slice(0, hashAt), hash: url.slice(hashAt) },
        { ...config, isKnownProvider: knownProvider },
      ),
    ).toEqual({ status: "matched", route: { kind: "index" } });
  });

  it("round-trips provider-qualified encoded record ids", () => {
    const route = {
      kind: "detail",
      providerId: "files",
      recordId: "folder/name # 日本語",
    } as const;
    const url = formatComposerRoute(route, { basePath: "/docs/" });
    expect(url).toBe(
      "/docs/composer/#/composition/files/folder%2Fname%20%23%20%E6%97%A5%E6%9C%AC%E8%AA%9E",
    );
    expect(
      parseComposerRoute(
        { pathname: "/docs/composer/", hash: url.slice(url.indexOf("#")) },
        { basePath: "/docs/", isKnownProvider: knownProvider },
      ),
    ).toEqual({ status: "matched", route });
  });

  it.each([
    [
      { pathname: "/wrong/composer/", hash: "#/" },
      "wrong-document-path",
      "Expected the Composer document",
    ],
    [
      { pathname: "/composer/", hash: "#/something-else" },
      "unsupported-hash-route",
      "does not match",
    ],
    [
      { pathname: "/composer/", hash: "#/composition/cloud/record" },
      "unknown-provider",
      "cloud",
    ],
    [
      { pathname: "/composer/", hash: "#/composition/files/" },
      "empty-record-id",
      "cannot be empty",
    ],
    [
      { pathname: "/composer/", hash: "#/composition/files/%E0%A4%A" },
      "malformed-record-id-encoding",
      "percent encoding",
    ],
  ])("returns an actionable not-found for invalid URLs", (location, code, message) => {
    const result = parseComposerRoute(location, { isKnownProvider: knownProvider });
    expect(result.status).toBe("not-found");
    if (result.status === "not-found") {
      expect(result.error.code).toBe(code);
      expect(result.error.message).toContain(message);
      expect(result.error).toMatchObject(location);
    }
  });

  it("is deterministic for direct loads and refreshes", () => {
    const location = {
      pathname: "/composer/",
      hash: "#/composition/indexeddb/direct-load",
    };
    const config = { isKnownProvider: knownProvider };
    expect(parseComposerRoute(location, config)).toEqual(parseComposerRoute(location, config));
  });
});
