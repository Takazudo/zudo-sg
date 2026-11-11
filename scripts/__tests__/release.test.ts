// Behavioral tests for the release orchestration helpers and the workflow
// contracts that call them. Registry and GitHub are fake fetch handlers, so no
// test touches the network or the real repository's tags.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PACKAGES,
  ReleaseError,
  checkTagRef,
  createGithubClient,
  extractReleaseNotes,
  finalizeRelease,
  nextStage,
  parseTag,
  planFinalization,
  publishDecision,
  registryState,
  resolveGithubToken,
  resolvePackage,
  resolveSuperseded,
  selectCiRuns,
} from "../release/release-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const engine = PACKAGES.engine;
const initializer = PACKAGES["create-zudo-sg"];
const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);

type Route = (url: string, init?: RequestInit) => { status: number; body?: unknown } | Error;

function fakeFetch(route: Route) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const impl = async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const result = route(url, init);
    if (result instanceof Error) throw result;
    return new Response(result.body === undefined ? null : JSON.stringify(result.body), {
      status: result.status,
    });
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

function attestation({
  ref,
  commit,
  path,
  repository = "https://github.com/Takazudo/zudo-sg",
}: Record<string, string>) {
  const payload = {
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: { ref, repository, path } },
        resolvedDependencies: [{ digest: { gitCommit: commit } }],
      },
    },
  };
  return {
    attestations: [
      {
        predicateType: "https://github.com/npm/attestation/tree/main/specs/publish/v0.1",
        bundle: {},
      },
      {
        predicateType: "https://slsa.dev/provenance/v1",
        bundle: {
          dsseEnvelope: { payload: Buffer.from(JSON.stringify(payload)).toString("base64") },
        },
      },
    ],
  };
}

function registry({ versions, attest }: { versions?: string[]; attest?: unknown }): Route {
  return (url) => {
    if (url.includes("/-/npm/v1/attestations/"))
      return attest ? { status: 200, body: attest } : { status: 404 };
    if (!versions) return { status: 404, body: { error: "Not found" } };
    return {
      status: 200,
      body: { versions: Object.fromEntries(versions.map((v) => [v, { version: v }])) },
    };
  };
}

describe("wrong package or tag", () => {
  it("maps tags to exactly one package namespace", () => {
    expect(parseTag("v1.2.3")?.pkg.key).toBe("engine");
    expect(parseTag("create-zudo-sg-v0.2.14")?.pkg.key).toBe("create-zudo-sg");
    expect(parseTag("v1.2.3-beta.1")).toBeNull();
    expect(parseTag("create-zudo-sg-1.2.3")).toBeNull();
    expect(parseTag("v01.2.3")).toBeNull();
  });

  it("rejects the other package's tag, a prerelease, and a manifest mismatch", () => {
    expect(
      checkTagRef({
        pkg: engine,
        refType: "tag",
        refName: "create-zudo-sg-v0.9.2",
        manifestVersion: "0.9.2",
      })[0],
    ).toMatch(/belongs to create-zudo-sg/);
    expect(
      checkTagRef({
        pkg: initializer,
        refType: "tag",
        refName: "v0.2.14",
        manifestVersion: "0.2.14",
      })[0],
    ).toMatch(/belongs to @takazudo\/zudo-sg/);
    expect(
      checkTagRef({
        pkg: engine,
        refType: "tag",
        refName: "v1.0.0-rc.1",
        manifestVersion: "1.0.0",
      })[0],
    ).toMatch(/not an exact stable release tag/);
    expect(
      checkTagRef({ pkg: engine, refType: "tag", refName: "v0.9.3", manifestVersion: "0.9.2" })[0],
    ).toMatch(/does not match/);
    expect(
      checkTagRef({ pkg: engine, refType: "tag", refName: "v0.9.2", manifestVersion: "0.9.2" }),
    ).toEqual([]);
  });

  it("rejects unknown package names", () => {
    expect(() => resolvePackage("demo-ui")).toThrow(ReleaseError);
    expect(resolvePackage("initializer").key).toBe("create-zudo-sg");
  });
});

describe("branch publication refusal", () => {
  it("never publishes from a branch ref", () => {
    expect(
      checkTagRef({ pkg: engine, refType: "branch", refName: "main", manifestVersion: "0.9.2" })[0],
    ).toMatch(/refusing to publish from branch ref 'main'/);
  });

  it("keeps the inline dispatch guards ahead of checkout in both publishers", () => {
    for (const file of ["publish-zudo-sg.yml", "publish-create-zudo-sg.yml"]) {
      const text = readFileSync(join(ROOT, ".github/workflows", file), "utf8");
      const guard = text.indexOf('if [ "$GITHUB_REF_TYPE" != "tag" ]');
      expect(guard).toBeGreaterThan(0);
      expect(guard).toBeLessThan(text.indexOf("actions/checkout@"));
      expect(text).toContain("release.mjs guard-tag");
      expect(text).toContain("release.mjs verify-candidate");
    }
  });

  it("refuses coordinator dispatches from anything but main", () => {
    const text = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    expect(text).toContain("if: github.ref != 'refs/heads/main'");
  });
});

describe("tokenless publishing", () => {
  for (const file of ["publish-zudo-sg.yml", "publish-create-zudo-sg.yml"]) {
    it(`${file} has no npm token path and scopes id-token to the publish job`, () => {
      const text = readFileSync(join(ROOT, ".github/workflows", file), "utf8");
      expect(text).not.toMatch(/secrets\.NPM_TOKEN|NODE_AUTH_TOKEN:|registry-url:/);
      expect(text).toMatch(/^permissions: \{\}$/m);
      expect(text.match(/id-token: write/g)).toHaveLength(1);
      expect(text).toMatch(/publish .*--provenance/);
      const finalize = text.slice(text.indexOf("\n  finalize:"));
      expect(finalize).toContain("contents: write");
      expect(finalize).not.toContain("id-token");
    });
  }
});

describe("dry run", () => {
  it("leaves every mutating coordinator job behind !inputs.dry_run with a read-only verify job", () => {
    const text = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    const job = (name: string, next?: string) =>
      text.slice(text.indexOf(`\n  ${name}:`), next ? text.indexOf(`\n  ${next}:`) : undefined);
    const verify = job("verify", "tag");
    expect(verify).not.toMatch(/: write/);
    expect(job("tag", "dispatch")).toContain("if: ${{ !inputs.dry_run }}");
    expect(job("dispatch")).toContain("if: ${{ !inputs.dry_run }}");
    expect(text).toMatch(/dry_run:[\s\S]*?default: true/);
  });

  it("does not create a Release when finalization is a dry run", async () => {
    const github = {
      tagSha: async () => SHA,
      releases: async () => [],
      request: async () => {
        throw new Error("dry run must not write");
      },
    };
    const { impl } = fakeFetch(registry({ versions: ["1.0.0"] }));
    const result = await finalizeRelease({
      pkg: engine,
      version: "1.0.0",
      sha: SHA,
      notes: "n\n",
      github,
      fetch: impl,
      dryRun: true,
    });
    expect(result).toMatchObject({ action: "create", dryRun: true });
  });
});

describe("exact CI selection", () => {
  const run = (over: Record<string, unknown>) => ({
    id: 1,
    head_sha: SHA,
    event: "push",
    head_branch: "main",
    path: ".github/workflows/main-deploy.yml",
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
    created_at: "2026-11-12T00:00:00Z",
    ...over,
  });

  it("ignores other commits, tag/branch runs and pull requests", () => {
    const ci = selectCiRuns(
      [
        run({ head_sha: OTHER, conclusion: "success" }),
        run({
          head_branch: "v1.0.0",
          path: ".github/workflows/publish-zudo-sg.yml",
          conclusion: "failure",
        }),
        run({ event: "pull_request", conclusion: "failure" }),
      ],
      { sha: SHA },
    );
    expect(ci.ok).toBe(false);
    expect(ci.missing).toEqual([".github/workflows/main-deploy.yml"]);
    expect(ci.failing).toEqual([]);
  });

  it("uses the newest attempt per workflow and reports failures and pending runs", () => {
    expect(
      selectCiRuns([run({ id: 1, conclusion: "failure" }), run({ id: 1, run_attempt: 2 })], {
        sha: SHA,
      }).ok,
    ).toBe(true);
    const failing = selectCiRuns(
      [
        run({ conclusion: "success" }),
        run({ id: 2, path: ".github/workflows/x.yml", conclusion: "cancelled" }),
      ],
      { sha: SHA },
    );
    expect(failing.failing.map((r) => r.path)).toEqual([".github/workflows/x.yml"]);
    expect(
      selectCiRuns([run({ status: "in_progress", conclusion: null })], { sha: SHA }).pending,
    ).toHaveLength(1);
  });
});

describe("existing version", () => {
  const good = attestation({
    ref: "refs/tags/v0.9.2",
    commit: SHA,
    path: ".github/workflows/publish-zudo-sg.yml",
  });

  it("publishes a confirmed-absent version", async () => {
    const { impl } = fakeFetch(registry({ versions: ["0.9.1"] }));
    expect(
      (await publishDecision({ pkg: engine, version: "0.9.2", sha: SHA, fetch: impl })).publish,
    ).toBe(true);
    const { impl: missing } = fakeFetch(registry({}));
    expect(
      (await publishDecision({ pkg: engine, version: "0.1.0", sha: SHA, fetch: missing })).publish,
    ).toBe(true);
  });

  it("skips publication when provenance matches the tag and commit", async () => {
    const { impl } = fakeFetch(registry({ versions: ["0.9.2"], attest: good }));
    const decision = await publishDecision({
      pkg: engine,
      version: "0.9.2",
      sha: SHA,
      fetch: impl,
    });
    expect(decision.publish).toBe(false);
  });

  it("stops when the existing version came from another commit, workflow or has no provenance", async () => {
    const wrongCommit = fakeFetch(registry({ versions: ["0.9.2"], attest: good })).impl;
    await expect(
      publishDecision({ pkg: engine, version: "0.9.2", sha: OTHER, fetch: wrongCommit }),
    ).rejects.toMatchObject({
      code: "identity-mismatch",
    });
    const wrongWorkflow = fakeFetch(
      registry({
        versions: ["0.9.2"],
        attest: attestation({
          ref: "refs/tags/v0.9.2",
          commit: SHA,
          path: ".github/workflows/other.yml",
        }),
      }),
    ).impl;
    await expect(
      publishDecision({ pkg: engine, version: "0.9.2", sha: SHA, fetch: wrongWorkflow }),
    ).rejects.toMatchObject({
      code: "identity-mismatch",
    });
    const none = fakeFetch(registry({ versions: ["0.9.2"] })).impl;
    await expect(
      publishDecision({ pkg: engine, version: "0.9.2", sha: SHA, fetch: none }),
    ).rejects.toMatchObject({
      code: "identity-unverifiable",
    });
  });
});

describe("registry uncertainty", () => {
  it.each([
    ["network error", () => new Error("ECONNRESET")],
    ["server error", () => ({ status: 503 })],
    ["auth error", () => ({ status: 401 })],
    ["unreadable body", () => ({ status: 200, body: "nope" })],
  ])("treats a %s as uncertain, never as unpublished", async (_label, route) => {
    const { impl } = fakeFetch(route as Route);
    expect((await registryState({ name: engine.name, version: "1.0.0", fetch: impl })).state).toBe(
      "uncertain",
    );
    await expect(
      publishDecision({ pkg: engine, version: "1.0.0", sha: SHA, fetch: impl }),
    ).rejects.toMatchObject({
      code: "registry-uncertain",
    });
  });

  it("encodes scoped names and stops resuming on uncertainty", async () => {
    const { impl, calls } = fakeFetch(registry({}));
    await registryState({ name: engine.name, version: "1.0.0", fetch: impl });
    expect(calls[0].url).toBe("https://registry.npmjs.org/@takazudo%2fzudo-sg");
    expect(nextStage({ version: "1.0.0", registry: "uncertain" } as never).stage).toBe("stop");
  });
});

describe("missing auth", () => {
  it("fails before any GitHub request without a credential", () => {
    expect(() => resolveGithubToken({ env: {}, ghAuthToken: () => "" })).toThrow(
      /no GitHub credential/,
    );
    expect(() => createGithubClient({ token: "" })).toThrow(ReleaseError);
    expect(resolveGithubToken({ env: { GH_TOKEN: "t" } })).toBe("t");
  });

  it("reports a rejected GitHub credential as an auth error", async () => {
    const { impl } = fakeFetch(() => ({ status: 403 }));
    const client = createGithubClient({ token: "t", fetch: impl });
    await expect(client.ciRuns(SHA)).rejects.toMatchObject({ code: "github-auth" });
  });
});

describe("finalization resume", () => {
  const notes = "### Changed\n\n- thing\n";
  const github = (releases: unknown[], tagSha: string | null = SHA) => {
    const posts: unknown[] = [];
    return {
      posts,
      tagSha: async () => tagSha,
      releases: async () => releases,
      request: async (_m: string, _p: string, body: unknown) => {
        posts.push(body);
        return { status: 201, data: { html_url: "https://example.test/r" } };
      },
    };
  };
  const published = fakeFetch(registry({ versions: ["0.2.15"] })).impl;

  it("creates a missing Release from the existing notes source", async () => {
    const gh = github([]);
    const result = await finalizeRelease({
      pkg: initializer,
      version: "0.2.15",
      sha: SHA,
      notes,
      github: gh,
      fetch: published,
    });
    expect(result.action).toBe("created");
    expect(gh.posts).toEqual([
      {
        tag_name: "create-zudo-sg-v0.2.15",
        name: "create-zudo-sg 0.2.15",
        body: notes,
        draft: false,
        prerelease: false,
      },
    ]);
  });

  it("keeps a matching Release and never overwrites a differing one", async () => {
    const same = github([
      { tag_name: "create-zudo-sg-v0.2.15", name: "create-zudo-sg 0.2.15", body: `\n${notes}` },
    ]);
    expect(
      await finalizeRelease({
        pkg: initializer,
        version: "0.2.15",
        sha: SHA,
        notes,
        github: same,
        fetch: published,
      }),
    ).toMatchObject({
      action: "keep",
      matches: true,
    });
    const edited = github([
      { tag_name: "create-zudo-sg-v0.2.15", name: "create-zudo-sg 0.2.15", body: "hand-written" },
    ]);
    expect(
      await finalizeRelease({
        pkg: initializer,
        version: "0.2.15",
        sha: SHA,
        notes,
        github: edited,
        fetch: published,
      }),
    ).toMatchObject({
      action: "keep",
      matches: false,
    });
    expect(same.posts).toEqual([]);
    expect(edited.posts).toEqual([]);
  });

  it("stops on draft/prerelease conflicts, unpublished versions and moved tags", async () => {
    const draft = github([{ tag_name: "create-zudo-sg-v0.2.15", draft: true }]);
    await expect(
      finalizeRelease({
        pkg: initializer,
        version: "0.2.15",
        sha: SHA,
        notes,
        github: draft,
        fetch: published,
      }),
    ).rejects.toMatchObject({
      code: "release-conflict",
    });
    const absent = fakeFetch(registry({ versions: [] })).impl;
    await expect(
      finalizeRelease({
        pkg: initializer,
        version: "0.2.15",
        sha: SHA,
        notes,
        github: github([]),
        fetch: absent,
      }),
    ).rejects.toMatchObject({
      code: "not-published",
    });
    await expect(
      finalizeRelease({
        pkg: initializer,
        version: "0.2.15",
        sha: SHA,
        notes,
        github: github([], OTHER),
        fetch: published,
      }),
    ).rejects.toMatchObject({ code: "tag-mismatch" });
  });

  it("resumes only the missing stage", () => {
    const base = { version: "1.0.0", candidateSha: SHA, manifestVersion: "1.0.0", onMain: true };
    expect(
      nextStage({
        ...base,
        tagSha: null,
        registry: "not-found",
        identity: "unknown",
        release: false,
      }).stage,
    ).toBe("tag");
    expect(
      nextStage({
        ...base,
        tagSha: SHA,
        registry: "not-found",
        identity: "unknown",
        release: false,
      }).stage,
    ).toBe("publish");
    expect(
      nextStage({
        ...base,
        tagSha: OTHER,
        registry: "not-found",
        identity: "unknown",
        release: false,
      }).stage,
    ).toBe("stop");
    expect(
      nextStage({ ...base, tagSha: SHA, registry: "found", identity: "match", release: false })
        .stage,
    ).toBe("finalize");
    expect(
      nextStage({ ...base, tagSha: SHA, registry: "found", identity: "match", release: true })
        .stage,
    ).toBe("done");
    expect(
      nextStage({ ...base, tagSha: SHA, registry: "found", identity: "mismatch", release: false })
        .stage,
    ).toBe("stop");
    expect(
      nextStage({
        ...base,
        manifestVersion: "0.9.9",
        tagSha: null,
        registry: "not-found",
        identity: "unknown",
        release: false,
      }).stage,
    ).toBe("prepare");
  });

  it("finalize failure handling never reaches publication", () => {
    for (const file of ["publish-zudo-sg.yml", "publish-create-zudo-sg.yml"]) {
      const text = readFileSync(join(ROOT, ".github/workflows", file), "utf8");
      const finalize = text.slice(text.indexOf("\n  finalize:"));
      expect(finalize).toContain("needs: publish");
      expect(finalize).not.toMatch(/pnpm (--filter \S+ )?publish/);
    }
  });
});

describe("release notes sources", () => {
  it("matches the bodies of the existing published Releases", () => {
    const mdx = readFileSync(join(ROOT, engine.notesSource("0.9.2")), "utf8");
    expect(extractReleaseNotes(engine, "0.9.2", mdx)).toMatch(/^\nReleased: 2026-11-11\n/);
    const changelog = readFileSync(join(ROOT, initializer.notesSource("0.2.14")), "utf8");
    const notes = extractReleaseNotes(initializer, "0.2.14", changelog);
    expect(notes.startsWith("### Changed\n\n- New projects install zudo-doc 10.0.3")).toBe(true);
    expect(notes).not.toContain("0.2.13");
  });

  it("rejects unfinalized entries", () => {
    expect(() =>
      extractReleaseNotes(engine, "1.0.0", "---\ntitle: 1.0.0\n---\n\nReleased: unreleased\n"),
    ).toThrow(/unreleased/);
    expect(() => extractReleaseNotes(initializer, "1.0.0", "## [1.0.0]\n\n- x\n")).toThrow(
      /no release date/,
    );
    expect(() => extractReleaseNotes(initializer, "1.0.0", "## [0.9.0] - 2026-01-01\n")).toThrow(
      /no '## \[1.0.0\]'/,
    );
  });

  it("plans a create for a tag with no Release", () => {
    expect(
      planFinalization({
        releases: [{ tag_name: "v1.0.0" }],
        tag: "v1.0.1",
        title: "t",
        notes: "n",
      }).action,
    ).toBe("create");
  });
});

describe("review follow-ups", () => {
  const run = (over: Record<string, unknown>) => ({
    id: 10,
    head_sha: SHA,
    event: "push",
    head_branch: "main",
    path: ".github/workflows/main-deploy.yml",
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
    ...over,
  });

  it("prefers a newer run over an older re-run of the same workflow", () => {
    const ci = selectCiRuns(
      [run({ id: 10, run_attempt: 2, conclusion: "failure" }), run({ id: 11, run_attempt: 1 })],
      { sha: SHA },
    );
    expect(ci.ok).toBe(true);
  });

  it("accepts a concurrency-cancelled deploy only when a descendant main commit succeeded", () => {
    const ci = selectCiRuns([run({ conclusion: "cancelled" })], { sha: SHA });
    expect(ci.ok).toBe(false);
    const later = [run({ id: 12, head_sha: OTHER })];
    expect(resolveSuperseded(ci, { laterRuns: later, sha: SHA, isAncestor: () => true }).ok).toBe(
      true,
    );
    expect(resolveSuperseded(ci, { laterRuns: later, sha: SHA, isAncestor: () => false }).ok).toBe(
      false,
    );
    expect(resolveSuperseded(ci, { laterRuns: [], sha: SHA, isAncestor: () => true }).ok).toBe(
      false,
    );
    const failed = selectCiRuns([run({ conclusion: "failure" })], { sha: SHA });
    expect(
      resolveSuperseded(failed, { laterRuns: later, sha: SHA, isAncestor: () => true }).ok,
    ).toBe(false);
  });

  it("reads CRLF changelog sources", () => {
    const crlf = "---\r\ntitle: 1.0.0\r\n---\r\n\r\nReleased: 2026-11-12\r\n\r\n- x\r\n";
    expect(extractReleaseNotes(engine, "1.0.0", crlf)).toBe("\nReleased: 2026-11-12\n\n- x\n");
  });

  it("stops on a stray tag that is not a prepared commit on main", () => {
    const facts = {
      version: "1.0.0",
      candidateSha: SHA,
      tagSha: SHA,
      registry: "not-found",
      identity: "unknown",
      release: false,
    };
    expect(nextStage({ ...facts, manifestVersion: "1.0.0", onMain: false }).stage).toBe("stop");
    expect(nextStage({ ...facts, manifestVersion: "0.9.0", onMain: true }).stage).toBe("stop");
  });

  it("pages through all Releases so older tags are still found", async () => {
    const page = (n: number, size: number) =>
      Array.from({ length: size }, (_, i) => ({ tag_name: `v0.${n}.${i}` }));
    const { impl, calls } = fakeFetch((url) => ({
      status: 200,
      body: url.endsWith("&page=1") ? page(1, 100) : page(2, 3),
    }));
    const releases = await createGithubClient({ token: "t", fetch: impl }).releases();
    expect(releases).toHaveLength(103);
    expect(calls).toHaveLength(2);
  });

  it("classifies an unreadable annotated tag instead of crashing", async () => {
    const { impl } = fakeFetch((url) =>
      url.includes("/git/ref/")
        ? { status: 200, body: { object: { type: "tag", sha: "c".repeat(40) } } }
        : { status: 404 },
    );
    await expect(
      createGithubClient({ token: "t", fetch: impl }).tagSha("v1.0.0"),
    ).rejects.toMatchObject({
      code: "tag-unreadable",
    });
  });
});
