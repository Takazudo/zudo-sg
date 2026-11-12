// Release helpers shared by the local/Cloud release procedure
// (packages/styleguide/RELEASE.md) and the hosted workflows
// (.github/workflows/release.yml, publish-zudo-sg.yml, publish-create-zudo-sg.yml).
//
// Every side effect (registry reads, GitHub REST, git, file reads) is injected
// so the decision logic is unit-tested without the network or a checkout.

export const REGISTRY = "https://registry.npmjs.org";
export const GITHUB_API = "https://api.github.com";
export const REPO = "Takazudo/zudo-sg";

// Push-to-main workflows whose success gates a release candidate. The publish
// and release workflows never run on a main push, so they never qualify.
export const REQUIRED_CI_WORKFLOWS = [".github/workflows/main-deploy.yml"];

const STABLE = "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)";

export const PACKAGES = {
  engine: {
    key: "engine",
    name: "@takazudo/zudo-sg",
    dir: "packages/styleguide",
    tagPrefix: "v",
    workflow: "publish-zudo-sg.yml",
    notesSource: (version) => `doc/src/content/docs/changelog/zudo-sg/${version}.mdx`,
    notesKind: "mdx",
    title: (version) => `@takazudo/zudo-sg ${version}`,
  },
  "create-zudo-sg": {
    key: "create-zudo-sg",
    name: "create-zudo-sg",
    dir: "packages/create-zudo-sg",
    tagPrefix: "create-zudo-sg-v",
    workflow: "publish-create-zudo-sg.yml",
    notesSource: () => "packages/create-zudo-sg/CHANGELOG.md",
    notesKind: "keep-a-changelog",
    title: (version) => `create-zudo-sg ${version}`,
  },
};

const ALIASES = {
  engine: "engine",
  "@takazudo/zudo-sg": "engine",
  "zudo-sg": "engine",
  "create-zudo-sg": "create-zudo-sg",
  initializer: "create-zudo-sg",
};

export class ReleaseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ReleaseError";
    this.code = code;
  }
}

export function resolvePackage(key) {
  const resolved = ALIASES[key];
  if (!resolved) {
    throw new ReleaseError(
      "unknown-package",
      `unknown package '${key}' (expected one of: ${Object.keys(PACKAGES).join(", ")})`,
    );
  }
  return PACKAGES[resolved];
}

export function isStableVersion(version) {
  return typeof version === "string" && new RegExp(`^${STABLE}$`).test(version);
}

export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function tagFor(pkg, version) {
  return `${pkg.tagPrefix}${version}`;
}

/** Map an exact release tag to its package and version; null for anything else. */
export function parseTag(tag) {
  for (const pkg of Object.values(PACKAGES)) {
    const match = new RegExp(`^${pkg.tagPrefix.replace(/-/g, "\\-")}(${STABLE})$`).exec(tag);
    if (match) return { pkg, version: match[1] };
  }
  return null;
}

/**
 * Guard a publish run's ref: it must be an exact stable tag in this package's
 * namespace that names the manifest version being published.
 */
export function checkTagRef({ pkg, refType, refName, manifestVersion }) {
  const errors = [];
  if (refType !== "tag") {
    errors.push(
      `refusing to publish from ${refType || "unknown"} ref '${refName}': only exact release tags publish`,
    );
    return errors;
  }
  const parsed = parseTag(refName);
  if (!parsed) {
    errors.push(`tag '${refName}' is not an exact stable release tag (${pkg.tagPrefix}X.Y.Z)`);
    return errors;
  }
  if (parsed.pkg.key !== pkg.key) {
    errors.push(`tag '${refName}' belongs to ${parsed.pkg.name}, not ${pkg.name}`);
  }
  if (!isStableVersion(manifestVersion)) {
    errors.push(`${pkg.dir}/package.json version '${manifestVersion}' is not a stable X.Y.Z`);
  } else if (refName !== tagFor(pkg, manifestVersion)) {
    errors.push(
      `tag '${refName}' does not match ${pkg.dir}/package.json version '${tagFor(pkg, manifestVersion)}'`,
    );
  }
  return errors;
}

function encodePackageName(name) {
  return name.replace("/", "%2f");
}

/**
 * Registry state of one exact version. Only an HTTP 404 for the package, or a
 * readable packument without the version, counts as not-found; every other
 * outcome is uncertain and must never be read as "unpublished".
 */
export async function registryState({
  name,
  version,
  fetch: fetchImpl = fetch,
  registry = REGISTRY,
}) {
  let response;
  try {
    response = await fetchImpl(`${registry}/${encodePackageName(name)}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    return { state: "uncertain", detail: `registry request failed: ${error.message}` };
  }
  if (response.status === 404) {
    return { state: "not-found", detail: `${name} does not exist on the registry` };
  }
  if (!response.ok) {
    return { state: "uncertain", detail: `registry answered HTTP ${response.status}` };
  }
  let packument;
  try {
    packument = await response.json();
  } catch {
    return { state: "uncertain", detail: "registry returned unreadable JSON" };
  }
  if (!packument || typeof packument !== "object" || typeof packument.versions !== "object") {
    return { state: "uncertain", detail: "registry response has no versions map" };
  }
  if (packument.versions[version]) {
    return {
      state: "found",
      detail: `${name}@${version} is published`,
      manifest: packument.versions[version],
    };
  }
  // The packument can lag a fresh publish (CDN / abbreviated metadata), so a
  // missing version is confirmed against the exact-version document before it
  // may count as unpublished. Anything but a clean 404 or 200 stays uncertain.
  let exact;
  try {
    exact = await fetchImpl(`${registry}/${encodePackageName(name)}/${version}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    return { state: "uncertain", detail: `registry version request failed: ${error.message}` };
  }
  if (exact.status === 404) {
    return { state: "not-found", detail: `${name}@${version} is not published` };
  }
  if (exact.ok) {
    let manifest;
    try {
      manifest = await exact.json();
    } catch {}
    if (manifest?.version === version) {
      return {
        state: "found",
        detail: `${name}@${version} is published (packument lagging)`,
        manifest,
      };
    }
  }
  return {
    state: "uncertain",
    detail: `packument lacks ${version} but the version document answered HTTP ${exact.status}`,
  };
}

/**
 * Prove an already-published version came from this repository's publisher at
 * the expected tag and commit, using its npm provenance attestation.
 */
export async function verifyPublishedIdentity({
  pkg,
  version,
  sha,
  repo = REPO,
  fetch: fetchImpl = fetch,
  registry = REGISTRY,
}) {
  const tag = tagFor(pkg, version);
  let response;
  try {
    response = await fetchImpl(
      `${registry}/-/npm/v1/attestations/${encodePackageName(pkg.name)}@${version}`,
      { headers: { Accept: "application/json" } },
    );
  } catch (error) {
    return { state: "uncertain", detail: `attestation request failed: ${error.message}` };
  }
  if (response.status === 404) {
    return {
      state: "unverifiable",
      detail: `${pkg.name}@${version} has no provenance attestation`,
    };
  }
  if (!response.ok) {
    return { state: "uncertain", detail: `attestation endpoint answered HTTP ${response.status}` };
  }
  let provenance;
  try {
    const body = await response.json();
    const slsa = body.attestations.find((a) =>
      String(a.predicateType).startsWith("https://slsa.dev/provenance/"),
    );
    provenance = JSON.parse(
      Buffer.from(slsa.bundle.dsseEnvelope.payload, "base64").toString("utf8"),
    );
  } catch {
    return { state: "uncertain", detail: "attestation response has no readable SLSA provenance" };
  }
  const definition = provenance.predicate?.buildDefinition ?? {};
  const workflow = definition.externalParameters?.workflow ?? {};
  const commit = definition.resolvedDependencies?.[0]?.digest?.gitCommit;
  const expected = {
    repository: `https://github.com/${repo}`.toLowerCase(),
    path: `.github/workflows/${pkg.workflow}`,
    ref: `refs/tags/${tag}`,
    commit: sha,
  };
  const actual = {
    repository: String(workflow.repository ?? "").toLowerCase(),
    path: workflow.path,
    ref: workflow.ref,
    commit,
  };
  const mismatches = Object.keys(expected).filter((key) => expected[key] !== actual[key]);
  if (mismatches.length > 0) {
    return {
      state: "mismatch",
      detail: mismatches
        .map((key) => `${key}: expected ${expected[key]}, attested ${actual[key]}`)
        .join("; "),
    };
  }
  return { state: "match", detail: `${pkg.name}@${version} attests ${tag} at ${sha}` };
}

/**
 * Decide whether a publish run should publish. Not-found publishes; an
 * existing version with matching provenance skips straight to finalization;
 * anything uncertain or foreign stops the run.
 */
export async function publishDecision({
  pkg,
  version,
  sha,
  fetch: fetchImpl = fetch,
  registry = REGISTRY,
}) {
  const reg = await registryState({ name: pkg.name, version, fetch: fetchImpl, registry });
  if (reg.state === "uncertain") {
    throw new ReleaseError(
      "registry-uncertain",
      `cannot establish whether ${pkg.name}@${version} exists: ${reg.detail}`,
    );
  }
  if (reg.state === "not-found") {
    return { publish: true, detail: reg.detail };
  }
  const identity = await verifyPublishedIdentity({ pkg, version, sha, fetch: fetchImpl, registry });
  if (identity.state !== "match") {
    throw new ReleaseError(
      `identity-${identity.state}`,
      `${pkg.name}@${version} is already published but its identity is ${identity.state}: ${identity.detail}`,
    );
  }
  return { publish: false, detail: `${reg.detail}; ${identity.detail}; skipping publication` };
}

/** Pick, per workflow, the newest push-to-main run for exactly this commit. */
export function selectCiRuns(runs, { sha, branch = "main", required = REQUIRED_CI_WORKFLOWS }) {
  const latest = new Map();
  for (const run of runs) {
    if (run.head_sha !== sha || run.event !== "push" || run.head_branch !== branch) continue;
    const path = String(run.path ?? "").replace(/@.*$/, "");
    const current = latest.get(path);
    // A re-run keeps its run id and bumps run_attempt, so id orders distinct runs first.
    const rank = (r) => [r.id ?? 0, r.run_attempt ?? 1];
    if (!current || compareRank(rank(run), rank(current)) > 0) latest.set(path, run);
  }
  const selected = [...latest.entries()].map(([path, run]) => ({
    path,
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
  }));
  const missing = required.filter((path) => !latest.has(path));
  const pending = selected.filter((r) => r.status !== "completed");
  const failing = selected.filter((r) => r.status === "completed" && r.conclusion !== "success");
  return {
    ok: missing.length === 0 && pending.length === 0 && failing.length === 0,
    selected,
    // main-deploy's concurrency group cancels a queued run when a newer push
    // queues behind it; such a run proves nothing either way (see resolveSuperseded).
    cancelledRequired: failing.filter(
      (r) => r.conclusion === "cancelled" && required.includes(r.path),
    ),
    missing,
    pending,
    failing,
  };
}

/**
 * Accept a required run cancelled by concurrency only when the same workflow
 * later succeeded on a main commit that contains the candidate. Any other
 * failure still rejects the candidate.
 */
export function resolveSuperseded(ci, { laterRuns, isAncestor, sha, branch = "main" }) {
  if (ci.ok || ci.missing.length || ci.pending.length) return ci;
  if (ci.failing.length !== ci.cancelledRequired.length) return ci;
  const superseded = [];
  for (const cancelled of ci.cancelledRequired) {
    const later = laterRuns.find(
      (run) =>
        String(run.path ?? "").replace(/@.*$/, "") === cancelled.path &&
        run.event === "push" &&
        run.head_branch === branch &&
        run.status === "completed" &&
        run.conclusion === "success" &&
        run.head_sha !== sha &&
        isAncestor(sha, run.head_sha),
    );
    if (!later) return ci;
    superseded.push({ ...cancelled, supersededBy: later.head_sha, url: later.html_url });
  }
  return { ...ci, ok: true, failing: [], superseded };
}

function compareRank(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function resolveGithubToken({ env = process.env, ghAuthToken } = {}) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN || (ghAuthToken ? ghAuthToken() : "");
  if (!token) {
    throw new ReleaseError(
      "missing-auth",
      "no GitHub credential: set GITHUB_TOKEN or GH_TOKEN (Actions provides github.token), or authenticate gh",
    );
  }
  return token;
}

/**
 * A GitHub REST failure with the details an operator needs afterwards: the
 * status, GitHub's own message and documentation link, the permission header
 * GitHub says the endpoint accepts, and the request id. `uncertain` marks a
 * failure after which the write may or may not have happened (network error,
 * 5xx), so callers must read back instead of assuming either outcome.
 */
export class GithubHttpError extends ReleaseError {
  constructor({ method, path, status, message, documentationUrl, acceptedPermissions, requestId }) {
    const kind =
      status === 0
        ? "github-network"
        : status === 429
          ? "github-rate-limit"
          : status === 401 || status === 403
            ? "github-auth"
            : "github-error";
    const parts = [
      `GitHub ${method} ${path || "/"} answered ${status ? `HTTP ${status}` : "no response"}`,
    ];
    if (message) parts.push(`message: ${message}`);
    if (acceptedPermissions) parts.push(`accepted permissions: ${acceptedPermissions}`);
    if (documentationUrl) parts.push(`docs: ${documentationUrl}`);
    if (requestId) parts.push(`request id: ${requestId}`);
    super(kind, parts.join("; "));
    this.status = status;
    this.githubMessage = message ?? "";
    this.uncertain = status === 0 || status >= 500;
  }
}

export function createGithubClient({
  token,
  fetch: fetchImpl = fetch,
  repo = REPO,
  api = GITHUB_API,
}) {
  if (!token) throw new ReleaseError("missing-auth", "GitHub client created without a token");
  async function request(method, path, body, { allow = [] } = {}) {
    let response;
    try {
      response = await fetchImpl(`${api}/repos/${repo}${path}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new GithubHttpError({ method, path, status: 0, message: error.message });
    }
    if (response.status === 404) return { status: 404, data: null };
    if (!response.ok && !allow.includes(response.status)) {
      let payload = {};
      try {
        payload = (await response.json()) ?? {};
      } catch {}
      const errors = Array.isArray(payload.errors)
        ? payload.errors.map((e) => (typeof e === "string" ? e : (e.message ?? e.code))).join(", ")
        : "";
      // A primary rate limit is a 403 with no remaining quota: still not an auth verdict.
      const status =
        response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0"
          ? 429
          : response.status;
      throw new GithubHttpError({
        method,
        path,
        status,
        message: [payload.message, errors].filter(Boolean).join(" — "),
        documentationUrl: payload.documentation_url,
        acceptedPermissions: response.headers.get("x-accepted-github-permissions"),
        requestId: response.headers.get("x-github-request-id"),
      });
    }
    let data = null;
    if (response.status !== 204) {
      const text = await response.text();
      data = text ? JSON.parse(text) : null;
    }
    return { status: response.status, data };
  }
  return {
    request,
    async ciRuns(sha) {
      const { data } = await request(
        "GET",
        `/actions/runs?head_sha=${sha}&event=push&per_page=100`,
      );
      return data?.workflow_runs ?? [];
    },
    async mainRuns(workflowPath) {
      const file = workflowPath.split("/").pop();
      const { data } = await request(
        "GET",
        `/actions/workflows/${file}/runs?branch=main&event=push&status=success&per_page=50`,
      );
      return data?.workflow_runs ?? [];
    },
    async tagSha(tag) {
      const { status, data } = await request("GET", `/git/ref/tags/${tag}`);
      if (status === 404) return null;
      if (data.object.type === "commit") return data.object.sha;
      const annotated = await request("GET", `/git/tags/${data.object.sha}`);
      if (annotated.status === 404) {
        throw new ReleaseError("tag-unreadable", `tag object for ${tag} could not be read`);
      }
      return annotated.data.object.sha;
    },
    async mainHead() {
      const { status, data } = await request("GET", "/git/ref/heads/main");
      if (status === 404) throw new ReleaseError("github-error", "refs/heads/main is not readable");
      return data.object.sha;
    },
    /** True when sha is main's HEAD or one of its ancestors (GitHub compare API). */
    async isOnMain(sha) {
      const { status, data } = await request("GET", `/compare/${sha}...main`);
      if (status === 404) return false;
      return data.status === "ahead" || data.status === "identical";
    },
    async createTagRef(tag, sha) {
      return request("POST", "/git/refs", { ref: `refs/tags/${tag}`, sha }, { allow: [422] });
    },
    async workflowRuns(workflow, branch) {
      const { data } = await request(
        "GET",
        `/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(branch)}&per_page=50`,
      );
      return data?.workflow_runs ?? [];
    },
    async run(id) {
      const { data } = await request("GET", `/actions/runs/${id}`);
      return data;
    },
    async runJobs(id) {
      const { data } = await request("GET", `/actions/runs/${id}/jobs?per_page=100`);
      return data?.jobs ?? [];
    },
    /**
     * workflow_dispatch with return_run_details: GitHub answers 200 with the
     * new run's id; an older API answers 204 and the caller finds the run by readback.
     */
    async dispatchWorkflow(workflow, ref, inputs) {
      return request("POST", `/actions/workflows/${workflow}/dispatches`, {
        ref,
        ...(inputs ? { inputs } : {}),
        return_run_details: true,
      });
    },
    async releases() {
      // Listing (not /releases/tags/{tag}) is the only way to see drafts.
      const all = [];
      for (let page = 1; ; page++) {
        const { data } = await request("GET", `/releases?per_page=100&page=${page}`);
        all.push(...(data ?? []));
        if (!data || data.length < 100) return all;
      }
    },
  };
}

/** Release notes from the existing sources, byte-compatible with past Releases. */
export function extractReleaseNotes(pkg, version, source) {
  source = source.replace(/\r\n/g, "\n");
  if (pkg.notesKind === "mdx") {
    const lines = source.split("\n");
    let fences = 0;
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimEnd() === "---" && ++fences === 2) {
        start = i + 1;
        break;
      }
    }
    if (start < 0)
      throw new ReleaseError("notes-missing", `${pkg.notesSource(version)} has no frontmatter`);
    const body = lines.slice(start).join("\n");
    if (/Released:\s*unreleased/i.test(body)) {
      throw new ReleaseError(
        "notes-unfinalized",
        `${pkg.notesSource(version)} is still marked unreleased`,
      );
    }
    if (!body.trim())
      throw new ReleaseError("notes-missing", `${pkg.notesSource(version)} has no body`);
    return body.endsWith("\n") ? body : `${body}\n`;
  }
  const heading = new RegExp(
    `^## \\[${version.replace(/\./g, "\\.")}\\](?: - \\d{4}-\\d{2}-\\d{2})?\\s*$`,
  );
  const lines = source.split("\n");
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0)
    throw new ReleaseError(
      "notes-missing",
      `${pkg.notesSource(version)} has no '## [${version}]' entry`,
    );
  if (!/ - \d{4}-\d{2}-\d{2}/.test(lines[start])) {
    throw new ReleaseError(
      "notes-unfinalized",
      `${pkg.notesSource(version)} entry for ${version} has no release date`,
    );
  }
  let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  if (end < 0) end = lines.length;
  const body = lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
  if (!body)
    throw new ReleaseError(
      "notes-missing",
      `${pkg.notesSource(version)} entry for ${version} is empty`,
    );
  return `${body}\n`;
}

const normalize = (text) =>
  String(text ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

/** Never overwrite a Release: create it, keep a matching one, or flag a conflict. */
export function planFinalization({ releases, tag, title, notes }) {
  const existing = releases.find((release) => release.tag_name === tag);
  if (!existing) return { action: "create" };
  if (existing.draft || existing.prerelease) {
    return {
      action: "conflict",
      detail: `Release ${tag} exists as a ${existing.draft ? "draft" : "prerelease"}; resolve it by hand (stable releases are never drafts or prereleases)`,
      url: existing.html_url,
    };
  }
  const matches = existing.name === title && normalize(existing.body) === normalize(notes);
  return {
    action: "keep",
    matches,
    url: existing.html_url,
    detail: matches
      ? `Release ${tag} already exists with the expected title and notes`
      : `Release ${tag} already exists with different title/notes; left untouched (edit it by hand if the changelog should win)`,
  };
}

export async function finalizeRelease({
  pkg,
  version,
  sha,
  notes,
  github,
  fetch: fetchImpl = fetch,
  dryRun = false,
  registry = REGISTRY,
}) {
  const tag = tagFor(pkg, version);
  const reg = await registryState({ name: pkg.name, version, fetch: fetchImpl, registry });
  if (reg.state !== "found") {
    throw new ReleaseError(
      reg.state === "uncertain" ? "registry-uncertain" : "not-published",
      `refusing to create the ${tag} Release: ${reg.detail}`,
    );
  }
  const tagSha = await github.tagSha(tag);
  if (tagSha !== sha) {
    throw new ReleaseError(
      "tag-mismatch",
      `tag ${tag} points at ${tagSha ?? "nothing"}, expected ${sha}`,
    );
  }
  const plan = planFinalization({
    releases: await github.releases(),
    tag,
    title: pkg.title(version),
    notes,
  });
  if (plan.action === "conflict") throw new ReleaseError("release-conflict", plan.detail);
  if (plan.action === "keep") return plan;
  if (dryRun) return { action: "create", dryRun: true, detail: `would create Release ${tag}` };
  let postError = null;
  try {
    await github.request(
      "POST",
      "/releases",
      { tag_name: tag, name: pkg.title(version), body: notes, draft: false, prerelease: false },
      { allow: [422] },
    );
  } catch (error) {
    // After a network/5xx failure the Release may exist anyway: read back first.
    if (!error.uncertain) throw error;
    postError = error;
  }
  const readback = (await github.releases()).find((r) => r.tag_name === tag);
  if (!readback) {
    throw new ReleaseError(
      postError ? "release-uncertain" : "release-missing",
      `Release ${tag} is not visible after the create request${postError ? ` (${postError.message})` : ""}; re-run finalize (it keeps an existing Release)`,
    );
  }
  if (readback.draft || readback.prerelease) {
    throw new ReleaseError("release-conflict", `Release ${tag} reads back as draft/prerelease`);
  }
  const matches =
    readback.name === pkg.title(version) && normalize(readback.body) === normalize(notes);
  return {
    action: "created",
    matches,
    url: readback.html_url,
    detail: `created Release ${tag} (read back${matches ? "" : " with different text"})`,
  };
}

/**
 * Resume point for a release, derived only from durable state (manifest on
 * main, the tag, the registry, the Release) so an interrupted run never
 * repeats a finished stage.
 */
export function nextStage({
  version,
  candidateSha,
  manifestVersion,
  onMain,
  tagSha,
  registry,
  identity,
  release,
}) {
  if (registry === "uncertain")
    return { stage: "stop", reason: "registry state is uncertain; recheck before any action" };
  if (registry === "found") {
    if (identity !== "match")
      return { stage: "stop", reason: `published version identity is ${identity}` };
    return release
      ? { stage: "done", reason: "published and Release exists" }
      : { stage: "finalize", reason: "published; GitHub Release missing" };
  }
  if (tagSha) {
    if (candidateSha && tagSha !== candidateSha) {
      return {
        stage: "stop",
        reason: `tag already points at ${tagSha}, not ${candidateSha}; never move a release tag`,
      };
    }
    if (!onMain || manifestVersion !== version) {
      return {
        stage: "stop",
        reason: `tag ${tagSha} is not a prepared release commit on main (manifest ${manifestVersion}); the publisher would refuse it`,
      };
    }
    return {
      stage: "publish",
      reason: "tag exists, version unpublished: dispatch the publisher at the exact tag",
    };
  }
  if (manifestVersion === version && onMain) {
    return {
      stage: "tag",
      reason: "candidate prepared on main: verify CI, then tag via the Release workflow",
    };
  }
  return {
    stage: "prepare",
    reason: "bump, changelog, verify and integrate the candidate into main",
  };
}

/**
 * Candidate pinning. A new release (no tag, not on npm) is pinned to the SHA
 * the operator passed — normally the CI-green main HEAD at preparation time —
 * and is never silently replaced by a newer main. It is refused only when
 * main has since moved the package to another version (the candidate is
 * superseded). A resume (tag exists or version published) keeps its original
 * SHA whatever main looks like now.
 */
export function checkCandidateFreshness({
  version,
  sha,
  newRelease,
  mainHead,
  mainManifestVersion,
}) {
  const errors = [];
  const notices = [];
  if (!newRelease) {
    notices.push(`resume: keeping the original candidate ${sha}`);
    return { errors, notices };
  }
  if (mainManifestVersion !== version) {
    errors.push(
      `main (${mainHead}) now declares version ${mainManifestVersion}; candidate ${version} at ${sha} is superseded — prepare a new candidate instead of tagging an old one`,
    );
  } else if (mainHead !== sha) {
    notices.push(
      `main advanced to ${mainHead} after the candidate; the release stays pinned to ${sha} (never replaced silently)`,
    );
  }
  return { errors, notices };
}

/** The `^X.Y.Z` engine range the initializer template ships; null when absent. */
export function templateEngineVersion(templateManifest) {
  const range = templateManifest?.dependencies?.[PACKAGES.engine.name];
  const match = new RegExp(`^\\^(${STABLE})$`).exec(range ?? "");
  return match ? match[1] : null;
}

/**
 * Write-time tag creation for the coordinator's tag job. Re-checks immediately
 * before the write (tag, main ancestry, registry), treats the same name at the
 * same SHA as success, refuses another SHA, and reads the ref back after an
 * ambiguous answer instead of assuming either outcome.
 */
export async function createReleaseTag({
  pkg,
  version,
  sha,
  github,
  fetch: fetchImpl = fetch,
  registry = REGISTRY,
}) {
  const tag = tagFor(pkg, version);
  const existing = await github.tagSha(tag);
  if (existing === sha) return { action: "exists", tag, detail: `tag ${tag} already at ${sha}` };
  if (existing) {
    throw new ReleaseError(
      "tag-conflict",
      `tag ${tag} points at ${existing}, not ${sha}; release tags are never moved`,
    );
  }
  if (!(await github.isOnMain(sha))) {
    throw new ReleaseError("candidate-rejected", `${sha} is no longer reachable from main`);
  }
  // Throws on an uncertain registry or a foreign existing version.
  await publishDecision({ pkg, version, sha, fetch: fetchImpl, registry });

  let response = null;
  let failure = null;
  try {
    response = await github.createTagRef(tag, sha);
  } catch (error) {
    if (!error.uncertain) throw annotateTagFailure(error, tag);
    failure = error;
  }
  const after = await github.tagSha(tag);
  if (after === sha) {
    const raced = response?.status === 422 || failure;
    return {
      action: raced ? "exists" : "created",
      tag,
      detail: raced
        ? `tag ${tag} at ${sha} confirmed by readback after ${failure ? `an uncertain answer (${failure.message})` : "HTTP 422"}`
        : `created tag ${tag} at ${sha}`,
    };
  }
  if (after) {
    throw new ReleaseError(
      "tag-conflict",
      `tag ${tag} appeared at ${after}, not ${sha} (concurrent writer); release tags are never moved`,
    );
  }
  const why = failure
    ? failure.message
    : response?.status === 422
      ? `HTTP 422 ${response.data?.message ?? ""}`.trim()
      : `HTTP ${response?.status}`;
  throw annotateTagFailure(
    new ReleaseError(
      failure ? "tag-uncertain" : "tag-not-created",
      `tag ${tag} is absent after the create request (${why}); nothing was published — re-run the coordinator after fixing the cause`,
    ),
    tag,
  );
}

function annotateTagFailure(error, tag) {
  if (error.code === "github-auth" || /rule|protect/i.test(error.message)) {
    error.message += `\nThe workflow token could not create ${tag}. Do not add a PAT or bypass a ruleset: an owner either allows GitHub Actions to create release tags, or pushes the tag from an authenticated local session (RELEASE.md step 7, local route).`;
  }
  return error;
}

/** Publisher runs that belong to one exact tag + commit, newest first. */
export function publisherRunsFor(runs, { tag, sha }) {
  return runs
    .filter((r) => r.head_branch === tag && (!sha || r.head_sha === sha))
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
}

/**
 * Reuse before dispatch: an in-flight publisher run for the tag is followed,
 * not duplicated; a successful one means nothing is left to dispatch. Only
 * when every earlier run ended unsuccessfully (or none exists) is a new run
 * dispatched — the publisher's registry/provenance guard keeps that safe.
 */
export function planDispatch(runs) {
  const active = runs.find((r) => r.status !== "completed");
  if (active)
    return {
      action: "reuse",
      run: active,
      reason: "a publisher run for this tag is still in progress",
    };
  const succeeded = runs.find((r) => r.conclusion === "success");
  if (succeeded)
    return {
      action: "reuse",
      run: succeeded,
      reason: "a publisher run for this tag already succeeded",
    };
  return {
    action: "dispatch",
    reason: runs.length
      ? "earlier publisher runs did not succeed"
      : "no publisher run for this tag yet",
  };
}

const runInfo = (r) => ({
  id: r.id,
  url: r.html_url,
  status: r.status,
  conclusion: r.conclusion ?? null,
});

/**
 * Dispatch the package's publisher at the exact tag and return the exact run
 * it started. The run id comes from the dispatch answer when GitHub returns
 * it, otherwise from a readback that must find exactly one new run.
 */
export async function dispatchPublisher({
  pkg,
  version,
  sha,
  github,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  attempts = 12,
  intervalMs = 5_000,
}) {
  const tag = tagFor(pkg, version);
  const tagRuns = publisherRunsFor(await github.workflowRuns(pkg.workflow, tag), { tag });
  const plan = planDispatch(tagRuns.filter((r) => r.head_sha === sha));
  if (plan.action === "reuse")
    return { action: "reused", tag, run: runInfo(plan.run), detail: plan.reason };

  const known = new Set(tagRuns.map((r) => r.id));
  let failure = null;
  let answer = null;
  try {
    answer = await github.dispatchWorkflow(pkg.workflow, tag);
  } catch (error) {
    if (!error.uncertain) throw error;
    failure = error;
  }
  const id = answer?.data?.workflow_run_id;
  if (id) {
    const run = await github.run(id);
    if (run && run.head_branch !== tag) {
      throw new ReleaseError(
        "dispatch-mismatch",
        `run ${id} started at ${run.head_branch}, not ${tag}`,
      );
    }
    return {
      action: "dispatched",
      tag,
      run: run
        ? runInfo(run)
        : { id, url: answer.data.html_url, status: "queued", conclusion: null },
      detail: `dispatched ${pkg.workflow} at ${tag}`,
    };
  }
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const fresh = publisherRunsFor(await github.workflowRuns(pkg.workflow, tag), { tag }).filter(
      (r) => !known.has(r.id) && r.event === "workflow_dispatch",
    );
    if (fresh.length === 1) {
      return {
        action: "dispatched",
        tag,
        run: runInfo(fresh[0]),
        detail: `dispatched ${pkg.workflow} at ${tag}${failure ? ` (confirmed by readback after: ${failure.message})` : " (run found by readback)"}`,
      };
    }
    if (fresh.length > 1) {
      throw new ReleaseError(
        "dispatch-ambiguous",
        `${fresh.length} new ${pkg.workflow} runs appeared for ${tag}: ${fresh.map((r) => r.html_url).join(", ")} — the publisher serializes them; follow each`,
      );
    }
    await sleep(intervalMs);
  }
  throw new ReleaseError(
    failure ? "dispatch-uncertain" : "dispatch-not-visible",
    `no ${pkg.workflow} run for ${tag} is visible after dispatch${failure ? ` (${failure.message})` : ""}; re-run the dispatch job — it reuses any run that appears instead of starting another`,
  );
}

/** Publication and finalization outcomes of one publisher run, kept apart. */
export function summarizePublisherJobs(jobs) {
  const pick = (prefix) => {
    const job = jobs.find((j) => j.name.startsWith(prefix));
    return job ? (job.status === "completed" ? job.conclusion : job.status) : "absent";
  };
  return { publish: pick("Build, verify, and publish"), finalize: pick("Finalize GitHub Release") };
}
