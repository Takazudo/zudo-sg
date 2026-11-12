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
  checkCandidateFreshness,
  createGithubClient,
  createReleaseTag,
  dispatchPublisher,
  releasePathsChanged,
  extractReleaseNotes,
  finalizeRelease,
  nextStage,
  parseTag,
  planDispatch,
  planFinalization,
  publishDecision,
  registryState,
  resolveGithubToken,
  resolvePackage,
  resolveSuperseded,
  selectCiRuns,
  summarizePublisherJobs,
  templateEngineVersion,
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
    const exact = /\/(\d+\.\d+\.\d+)$/.exec(url);
    if (exact)
      return versions.includes(exact[1])
        ? { status: 200, body: { version: exact[1] } }
        : { status: 404 };
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
    const posts: Record<string, unknown>[] = [];
    return {
      posts,
      tagSha: async () => tagSha,
      releases: async () => [
        ...releases,
        ...posts.map((p) => ({ ...p, html_url: "https://example.test/r" })),
      ],
      request: async (_m: string, _p: string, body: Record<string, unknown>) => {
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

// ---------------------------------------------------------------------------
// Coordinator hardening (#1081): write-time rechecks, resend/conflict,
// readback after ambiguous answers, exact publisher run tracking.
// ---------------------------------------------------------------------------

type FakeRun = {
  id: number;
  head_branch: string;
  head_sha: string;
  event: string;
  status: string;
  conclusion: string | null;
  html_url: string;
};

const uncertain = (message = "socket hang up") =>
  Object.assign(new ReleaseError("github-network", message), { uncertain: true });

function fakeGithub(opts: {
  tag?: string | null;
  onMain?: boolean;
  create?: () => { status: number; data?: unknown } | Error;
  runs?: FakeRun[];
  dispatch?: (runs: FakeRun[]) => { status: number; data?: unknown } | Error;
  mainHead?: string;
  mainVersion?: string;
  changed?: string[] | null;
}) {
  const state = { tag: opts.tag ?? null, runs: [...(opts.runs ?? [])], writes: [] as string[] };
  return {
    state,
    tagSha: async () => state.tag,
    isOnMain: async () => opts.onMain ?? true,
    mainHead: async () => opts.mainHead ?? SHA,
    fileAt: async () => JSON.stringify({ version: opts.mainVersion ?? "1.0.0" }),
    changedFiles: async () => (opts.changed === undefined ? [] : opts.changed),
    createTagRef: async (_tag: string, sha: string) => {
      state.writes.push(`tag ${sha}`);
      const result = opts.create ? opts.create() : ((state.tag = sha), { status: 201 });
      if (result instanceof Error) throw result;
      return result;
    },
    workflowRuns: async () => state.runs,
    run: async (id: number) => state.runs.find((r) => r.id === id) ?? null,
    dispatchWorkflow: async () => {
      state.writes.push("dispatch");
      const result = opts.dispatch ? opts.dispatch(state.runs) : { status: 204 };
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

const pubRun = (over: Partial<FakeRun>): FakeRun => ({
  id: 100,
  head_branch: "v1.0.0",
  head_sha: SHA,
  event: "workflow_dispatch",
  status: "completed",
  conclusion: "success",
  html_url: "https://example.test/run",
  ...over,
});

describe("tag creation at write time", () => {
  const unpublished = fakeFetch(registry({ versions: ["0.9.0"] })).impl;
  const args = { pkg: engine, version: "1.0.0", sha: SHA, fetch: unpublished };

  it("creates the tag after re-checking tag, main and registry", async () => {
    const gh = fakeGithub({});
    expect(await createReleaseTag({ ...args, github: gh })).toMatchObject({ action: "created" });
    expect(gh.state.writes).toEqual([`tag ${SHA}`]);
  });

  it("treats a resend at the same SHA as success without writing", async () => {
    const gh = fakeGithub({ tag: SHA });
    expect(await createReleaseTag({ ...args, github: gh })).toMatchObject({ action: "exists" });
    expect(gh.state.writes).toEqual([]);
  });

  it("refuses an existing tag at another SHA and never writes", async () => {
    const gh = fakeGithub({ tag: OTHER });
    await expect(createReleaseTag({ ...args, github: gh })).rejects.toMatchObject({
      code: "tag-conflict",
    });
    expect(gh.state.writes).toEqual([]);
  });

  it("re-checks main ancestry and the registry right before the write", async () => {
    const offMain = fakeGithub({ onMain: false });
    await expect(createReleaseTag({ ...args, github: offMain })).rejects.toMatchObject({
      code: "candidate-rejected",
    });
    const flaky = fakeFetch(() => ({ status: 429 })).impl;
    const gh = fakeGithub({});
    await expect(createReleaseTag({ ...args, fetch: flaky, github: gh })).rejects.toMatchObject({
      code: "registry-uncertain",
    });
    expect(offMain.state.writes).toEqual([]);
    expect(gh.state.writes).toEqual([]);
  });

  it("reads back after a lost race (422) or an uncertain POST", async () => {
    // Another writer created the same tag between the recheck and the POST.
    const raced = fakeGithub({});
    raced.createTagRef = async () => ((raced.state.tag = SHA), { status: 422 });
    expect(await createReleaseTag({ ...args, github: raced })).toMatchObject({ action: "exists" });

    const conflicting = fakeGithub({});
    conflicting.createTagRef = async () => ((conflicting.state.tag = OTHER), { status: 422 });
    await expect(createReleaseTag({ ...args, github: conflicting })).rejects.toMatchObject({
      code: "tag-conflict",
    });

    const landed = fakeGithub({});
    landed.createTagRef = async () => {
      landed.state.tag = SHA;
      throw uncertain();
    };
    expect(await createReleaseTag({ ...args, github: landed })).toMatchObject({ action: "exists" });

    const lost = fakeGithub({ create: () => uncertain() });
    await expect(createReleaseTag({ ...args, github: lost })).rejects.toMatchObject({
      code: "tag-uncertain",
    });
  });

  it("keeps a 403's GitHub details and points to the owner routes, not a PAT", async () => {
    const { impl } = fakeFetch((url, init) =>
      init?.method === "POST"
        ? {
            status: 403,
            body: {
              message: "Resource not accessible by integration",
              documentation_url: "https://docs.github.com/rest/git/refs#create-a-reference",
            },
          }
        : url.includes("/compare/")
          ? { status: 200, body: { status: "ahead" } }
          : url.endsWith("/git/ref/heads/main")
            ? { status: 200, body: { object: { type: "commit", sha: SHA } } }
            : url.includes("/contents/")
              ? {
                  status: 200,
                  body: { content: Buffer.from('{"version":"1.0.0"}').toString("base64") },
                }
              : { status: 404 },
    );
    const client = createGithubClient({ token: "t", fetch: impl });
    const error = await createReleaseTag({ ...args, github: client }).catch((e) => e);
    expect(error.code).toBe("github-auth");
    expect(error.message).toContain("Resource not accessible by integration");
    expect(error.message).toContain("docs.github.com");
    expect(error.message).toMatch(/Do not add a PAT/);
  });
});

describe("GitHub error details", () => {
  it("separates rate limits and network failures from auth", async () => {
    const limited = fakeFetch(() => ({
      status: 403,
      body: { message: "Resource not accessible by integration" },
    }));
    const res = (status: number, headers: Record<string, string>) =>
      new Response(JSON.stringify({ message: "x" }), { status, headers });
    const rateLimited = createGithubClient({
      token: "t",
      fetch: (async () => res(403, { "x-ratelimit-remaining": "0" })) as unknown as typeof fetch,
    });
    await expect(rateLimited.ciRuns(SHA)).rejects.toMatchObject({ code: "github-rate-limit" });
    await expect(
      createGithubClient({ token: "t", fetch: limited.impl }).ciRuns(SHA),
    ).rejects.toMatchObject({ code: "github-auth" });
    const down = createGithubClient({
      token: "t",
      fetch: fakeFetch(() => new Error("ECONNRESET")).impl,
    });
    await expect(down.ciRuns(SHA)).rejects.toMatchObject({
      code: "github-network",
      uncertain: true,
    });
    const flaky = createGithubClient({
      token: "t",
      fetch: fakeFetch(() => ({ status: 502 })).impl,
    });
    await expect(flaky.ciRuns(SHA)).rejects.toMatchObject({ uncertain: true });
  });
});

describe("publisher dispatch and exact run tracking", () => {
  const args = { pkg: engine, version: "1.0.0", sha: SHA, sleep: async () => {} };

  it("reuses an in-flight or successful run instead of dispatching again", async () => {
    expect(planDispatch([pubRun({ status: "in_progress", conclusion: null })]).action).toBe(
      "reuse",
    );
    const gh = fakeGithub({ runs: [pubRun({ id: 7 })] });
    expect(await dispatchPublisher({ ...args, github: gh })).toMatchObject({
      action: "reused",
      run: { id: 7 },
    });
    expect(gh.state.writes).toEqual([]);
  });

  it("dispatches after failed runs and returns the exact run id from the answer", async () => {
    const gh = fakeGithub({
      runs: [pubRun({ id: 1, conclusion: "failure" })],
      dispatch: (runs) => {
        runs.push(pubRun({ id: 2, status: "queued", conclusion: null }));
        return { status: 200, data: { workflow_run_id: 2, html_url: "u" } };
      },
    });
    expect(await dispatchPublisher({ ...args, github: gh })).toMatchObject({
      action: "dispatched",
      run: { id: 2 },
    });
    expect(gh.state.writes).toEqual(["dispatch"]);
  });

  it("finds the run by readback when the answer has no id or was uncertain", async () => {
    const plain = fakeGithub({
      dispatch: (runs) => (
        runs.push(pubRun({ id: 3, status: "queued", conclusion: null })),
        { status: 204 }
      ),
    });
    expect((await dispatchPublisher({ ...args, github: plain })).run.id).toBe(3);
    const lostAnswer = fakeGithub({
      dispatch: (runs) => (
        runs.push(pubRun({ id: 4, status: "queued", conclusion: null })),
        uncertain()
      ),
    });
    const result = await dispatchPublisher({ ...args, github: lostAnswer });
    expect(result.run.id).toBe(4);
    expect(result.detail).toMatch(/readback/);
  });

  it("fails loudly on a refused, invisible or ambiguous dispatch", async () => {
    const refused = fakeGithub({
      dispatch: () =>
        Object.assign(new ReleaseError("github-auth", "HTTP 403"), { uncertain: false }),
    });
    await expect(dispatchPublisher({ ...args, github: refused })).rejects.toMatchObject({
      code: "github-auth",
    });
    const invisible = fakeGithub({ dispatch: () => uncertain() });
    await expect(
      dispatchPublisher({ ...args, github: invisible, attempts: 2 }),
    ).rejects.toMatchObject({ code: "dispatch-uncertain" });
    const twice = fakeGithub({
      dispatch: (runs) => (
        runs.push(pubRun({ id: 5, status: "queued", conclusion: null })),
        runs.push(pubRun({ id: 6, status: "queued", conclusion: null })),
        { status: 204 }
      ),
    });
    await expect(dispatchPublisher({ ...args, github: twice })).rejects.toMatchObject({
      code: "dispatch-ambiguous",
    });
  });

  it("ignores runs for another tag or commit", async () => {
    const gh = fakeGithub({
      runs: [pubRun({ id: 8, head_branch: "v0.9.9" }), pubRun({ id: 9, head_sha: OTHER })],
      dispatch: (runs) => (
        runs.push(pubRun({ id: 10, status: "queued", conclusion: null })),
        { status: 204 }
      ),
    });
    expect((await dispatchPublisher({ ...args, github: gh })).run.id).toBe(10);
  });

  it("reports publication and finalization outcomes separately", () => {
    expect(
      summarizePublisherJobs([
        { name: "Build, verify, and publish", status: "completed", conclusion: "success" },
        { name: "Finalize GitHub Release", status: "completed", conclusion: "failure" },
      ]),
    ).toEqual({ publish: "success", finalize: "failure" });
    expect(summarizePublisherJobs([])).toEqual({ publish: "absent", finalize: "absent" });
  });
});

describe("candidate pinning", () => {
  const base = { version: "1.0.0", sha: SHA, mainHead: SHA, mainManifestVersion: "1.0.0" };

  it("keeps a new candidate pinned when main advances, refuses a superseded one", () => {
    expect(checkCandidateFreshness({ ...base, newRelease: true })).toEqual({
      errors: [],
      notices: [],
    });
    const advanced = checkCandidateFreshness({ ...base, newRelease: true, mainHead: OTHER });
    expect(advanced.errors).toEqual([]);
    expect(advanced.notices[0]).toMatch(/stays pinned to a{40}/);
    expect(
      checkCandidateFreshness({
        ...base,
        newRelease: true,
        mainHead: OTHER,
        mainManifestVersion: "1.0.1",
      }).errors[0],
    ).toMatch(/superseded/);
  });

  it("keeps the original SHA on resume whatever main declares now", () => {
    const resume = checkCandidateFreshness({
      ...base,
      newRelease: false,
      mainHead: OTHER,
      mainManifestVersion: "2.0.0",
    });
    expect(resume.errors).toEqual([]);
    expect(resume.notices[0]).toMatch(/resume/);
  });

  it("reads the initializer template's engine floor", () => {
    expect(templateEngineVersion({ dependencies: { "@takazudo/zudo-sg": "^0.9.4" } })).toBe(
      "0.9.4",
    );
    expect(
      templateEngineVersion({ dependencies: { "@takazudo/zudo-sg": "workspace:*" } }),
    ).toBeNull();
    const template = JSON.parse(
      readFileSync(join(ROOT, "packages/create-zudo-sg/templates/default/package.json"), "utf8"),
    );
    expect(templateEngineVersion(template)).toBe(
      JSON.parse(readFileSync(join(ROOT, "packages/styleguide/package.json"), "utf8")).version,
    );
  });
});

describe("registry lag never reads as unpublished", () => {
  it("confirms a version missing from the packument against the version document", async () => {
    const lagging = fakeFetch((url) =>
      url.endsWith("/1.0.0")
        ? { status: 200, body: { version: "1.0.0" } }
        : { status: 200, body: { versions: { "0.9.0": {} } } },
    ).impl;
    expect(
      (await registryState({ name: engine.name, version: "1.0.0", fetch: lagging })).state,
    ).toBe("found");
    const limited = fakeFetch((url) =>
      url.endsWith("/1.0.0") ? { status: 429 } : { status: 200, body: { versions: {} } },
    ).impl;
    expect(
      (await registryState({ name: engine.name, version: "1.0.0", fetch: limited })).state,
    ).toBe("uncertain");
  });
});

describe("finalization readback", () => {
  it("accepts a Release that exists after an uncertain create, fails when it does not", async () => {
    const published = fakeFetch(registry({ versions: ["1.0.0"] })).impl;
    const releases: Record<string, unknown>[] = [];
    const landed = {
      tagSha: async () => SHA,
      releases: async () => releases,
      request: async (_m: string, _p: string, body: Record<string, unknown>) => {
        releases.push({ ...body, html_url: "https://example.test/r" });
        throw uncertain();
      },
    };
    const call = (github: typeof landed) =>
      finalizeRelease({
        pkg: engine,
        version: "1.0.0",
        sha: SHA,
        notes: "n\n",
        github,
        fetch: published,
        sleep: async () => {},
      });
    expect(await call(landed)).toMatchObject({ action: "created", matches: true });
    const lost = {
      ...landed,
      releases: async () => [],
      request: async () => Promise.reject(uncertain()),
    };
    await expect(call(lost)).rejects.toMatchObject({ code: "release-uncertain" });
  });
});

describe("coordinator workflow contract", () => {
  const text = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
  const job = (name: string, next?: string) =>
    text.slice(text.indexOf(`\n  ${name}:`), next ? text.indexOf(`\n  ${next}:`) : undefined);

  it("scopes write permissions to exactly the job that writes", () => {
    expect(text).toMatch(/^permissions: \{\}$/m);
    expect(text.match(/contents: write/g)).toHaveLength(1);
    expect(text.match(/actions: write/g)).toHaveLength(1);
    expect(job("tag", "dispatch")).toContain("contents: write");
    expect(job("dispatch")).toContain("actions: write");
    expect(text).not.toContain("id-token");
    expect(text).not.toMatch(/secrets\./);
  });

  it("routes writes through the rechecking helpers and waits for pending CI", () => {
    expect(job("verify", "tag")).toContain("--wait-ci 600");
    expect(job("tag", "dispatch")).toContain("release.mjs create-tag");
    expect(job("dispatch")).toContain("release.mjs dispatch-publisher");
    expect(text).not.toMatch(/gh api -X POST|gh workflow run/);
  });

  it("keeps publication green once pnpm publish succeeded and waits for visibility in finalize", () => {
    for (const file of ["publish-zudo-sg.yml", "publish-create-zudo-sg.yml"]) {
      const pub = readFileSync(join(ROOT, ".github/workflows", file), "utf8");
      const publishJob = pub.slice(pub.indexOf("\n  publish:"), pub.indexOf("\n  finalize:"));
      const finalize = pub.slice(pub.indexOf("\n  finalize:"));
      expect(publishJob).not.toContain("await-published");
      expect(finalize).toMatch(/await-published[\s\S]*--timeout \d+[\s\S]*release\.mjs finalize/);
    }
  });
});

describe("review follow-ups: superseded candidates and error details", () => {
  const unpublished = fakeFetch(registry({ versions: ["0.9.0"] })).impl;
  const args = { pkg: engine, version: "1.0.0", sha: SHA, fetch: unpublished };

  it("refuses a candidate when later main commits touched its release files", () => {
    const base = {
      version: "1.0.0",
      sha: SHA,
      newRelease: true,
      mainHead: OTHER,
      mainManifestVersion: "1.0.0",
    };
    expect(
      checkCandidateFreshness({
        ...base,
        changedPackagePaths: releasePathsChanged(engine, "1.0.0", [
          "packages/styleguide/src/x.ts",
          "apps/demo/y.ts",
        ]),
      }).errors[0],
    ).toMatch(/changed release files after a{40} \(packages\/styleguide\/src\/x.ts\)/);
    expect(
      checkCandidateFreshness({
        ...base,
        changedPackagePaths: releasePathsChanged(engine, "1.0.0", ["apps/demo/y.ts", "doc/z.mdx"]),
      }),
    ).toMatchObject({ errors: [] });
    expect(checkCandidateFreshness({ ...base, changedPackagePaths: null }).errors[0]).toMatch(
      /too far/,
    );
    expect(
      releasePathsChanged(initializer, "0.2.17", [
        "packages/create-zudo-sg/templates/default/package.json",
        "packages/styleguide/a.ts",
      ]),
    ).toEqual(["packages/create-zudo-sg/templates/default/package.json"]);
  });

  it("re-applies the superseded rule in the tag job right before the write", async () => {
    const bumped = fakeGithub({ mainHead: OTHER, mainVersion: "1.1.0" });
    await expect(createReleaseTag({ ...args, github: bumped })).rejects.toMatchObject({
      code: "candidate-superseded",
    });
    const touched = fakeGithub({ mainHead: OTHER, changed: ["packages/styleguide/src/a.ts"] });
    await expect(createReleaseTag({ ...args, github: touched })).rejects.toMatchObject({
      code: "candidate-superseded",
    });
    const unrelated = fakeGithub({ mainHead: OTHER, changed: ["apps/demo/a.ts"] });
    expect(await createReleaseTag({ ...args, github: unrelated })).toMatchObject({
      action: "created",
    });
    expect(bumped.state.writes).toEqual([]);
    expect(touched.state.writes).toEqual([]);
  });

  it("keeps a ruleset's 422 rule names in the refusal", async () => {
    const gh = fakeGithub({
      create: () => ({
        status: 422,
        data: {
          message: "Repository rule violations found",
          errors: [{ message: "Cannot create ref due to creations being restricted." }],
          documentation_url: "https://docs.github.com/rules",
        },
      }),
    });
    const error = await createReleaseTag({ ...args, github: gh }).catch((e) => e);
    expect(error.code).toBe("tag-not-created");
    expect(error.message).toContain("creations being restricted");
    expect(error.message).toContain("docs.github.com/rules");
    expect(error.message).toMatch(/Do not add a PAT/);
  });

  it("reports a 404 on a write as an error, not as absence", async () => {
    const { impl } = fakeFetch(() => ({ status: 404, body: { message: "Not Found" } }));
    const client = createGithubClient({ token: "t", fetch: impl });
    await expect(client.dispatchWorkflow("publish-zudo-sg.yml", "v1.0.0")).rejects.toMatchObject({
      code: "github-error",
      status: 404,
      uncertain: false,
    });
    expect(await client.tagSha("v1.0.0")).toBeNull();
  });

  it("classifies a secondary rate limit as rate-limit, not auth", async () => {
    const client = createGithubClient({
      token: "t",
      fetch: (async () =>
        new Response(JSON.stringify({ message: "You have exceeded a secondary rate limit" }), {
          status: 403,
          headers: { "retry-after": "60" },
        })) as unknown as typeof fetch,
    });
    await expect(client.ciRuns(SHA)).rejects.toMatchObject({ code: "github-rate-limit" });
  });

  it("treats behind/diverged compare results as off main", async () => {
    for (const status of ["behind", "diverged"]) {
      const { impl } = fakeFetch(() => ({ status: 200, body: { status } }));
      expect(await createGithubClient({ token: "t", fetch: impl }).isOnMain(SHA)).toBe(false);
    }
    const { impl } = fakeFetch(() => ({ status: 200, body: { status: "ahead" } }));
    expect(await createGithubClient({ token: "t", fetch: impl }).isOnMain(SHA)).toBe(true);
  });

  it("names every coordinator run by its exact inputs", () => {
    const text = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    expect(text).toMatch(/^run-name: .*inputs\.package.*inputs\.version.*inputs\.sha.*dry run/m);
  });
});

describe("finalization readback lag (v0.9.5 publisher run 43256125588)", () => {
  const published = fakeFetch(registry({ versions: ["1.0.0"] })).impl;
  const notes = "n\n";
  const body = { tag_name: "v1.0.0", name: "@takazudo/zudo-sg 1.0.0", body: notes, html_url: "u" };
  const base = {
    pkg: engine,
    version: "1.0.0",
    sha: SHA,
    notes,
    fetch: published,
    sleep: async () => {},
  };

  it("retries a list that lags a 201 and finds the Release", async () => {
    let lists = 0;
    const github = {
      tagSha: async () => SHA,
      releases: async () => (++lists >= 4 ? [body] : []),
      request: async () => ({ status: 201, data: body }),
    };
    expect(await finalizeRelease({ ...base, github })).toMatchObject({
      action: "created",
      matches: true,
    });
  });

  it("prefers the by-tag readback and trusts a confirmed 201 when every read lags", async () => {
    const byTag = {
      tagSha: async () => SHA,
      releases: async () => [],
      releaseByTag: async () => body,
      request: async () => ({ status: 201, data: body }),
    };
    expect(await finalizeRelease({ ...base, github: byTag })).toMatchObject({ action: "created" });
    const lagging = { ...byTag, releaseByTag: async () => null };
    expect(await finalizeRelease({ ...base, github: lagging })).toMatchObject({
      action: "created",
      url: "u",
    });
    const unconfirmed = { ...lagging, request: async () => ({ status: 422, data: {} }) };
    await expect(finalizeRelease({ ...base, github: unconfirmed })).rejects.toMatchObject({
      code: "release-missing",
    });
  });
});

describe("dispatch readback after a confirmed run id (create-zudo-sg 0.2.17)", () => {
  it("keeps the dispatched run id when looking the run up answers 5xx", async () => {
    const gh = fakeGithub({
      dispatch: () => ({ status: 200, data: { workflow_run_id: 42, html_url: "u42" } }),
    });
    gh.run = async () => {
      throw uncertain("HTTP 500");
    };
    const result = await dispatchPublisher({
      pkg: initializer,
      version: "0.2.17",
      sha: SHA,
      github: gh,
      sleep: async () => {},
    });
    expect(result).toMatchObject({ action: "dispatched", run: { id: 42, url: "u42" } });
    expect(gh.state.writes).toEqual(["dispatch"]);
  });
});
