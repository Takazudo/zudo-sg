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
  return { state: "not-found", detail: `${name}@${version} is not published` };
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
    const rank = (r) => [r.run_attempt ?? 1, Date.parse(r.created_at ?? 0) || 0, r.id ?? 0];
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
    missing,
    pending,
    failing,
  };
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

export function createGithubClient({
  token,
  fetch: fetchImpl = fetch,
  repo = REPO,
  api = GITHUB_API,
}) {
  if (!token) throw new ReleaseError("missing-auth", "GitHub client created without a token");
  async function request(method, path, body) {
    const response = await fetchImpl(`${api}/repos/${repo}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 404) return { status: 404, data: null };
    if (response.status === 401 || response.status === 403) {
      throw new ReleaseError(
        "github-auth",
        `GitHub ${method} ${path} answered HTTP ${response.status}`,
      );
    }
    if (!response.ok) {
      throw new ReleaseError(
        "github-error",
        `GitHub ${method} ${path} answered HTTP ${response.status}`,
      );
    }
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
    };
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
    async tagSha(tag) {
      const { status, data } = await request("GET", `/git/ref/tags/${tag}`);
      if (status === 404) return null;
      if (data.object.type === "commit") return data.object.sha;
      const annotated = await request("GET", `/git/tags/${data.object.sha}`);
      return annotated.data.object.sha;
    },
    async releases() {
      const { data } = await request("GET", "/releases?per_page=100");
      return data ?? [];
    },
  };
}

/** Release notes from the existing sources, byte-compatible with past Releases. */
export function extractReleaseNotes(pkg, version, source) {
  if (pkg.notesKind === "mdx") {
    const lines = source.split("\n");
    let fences = 0;
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "---" && ++fences === 2) {
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
  const { data } = await github.request("POST", "/releases", {
    tag_name: tag,
    name: pkg.title(version),
    body: notes,
    draft: false,
    prerelease: false,
  });
  return { action: "created", url: data?.html_url, detail: `created Release ${tag}` };
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
