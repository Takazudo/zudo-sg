#!/usr/bin/env node
// Release CLI. The canonical procedure that drives it is
// packages/styleguide/RELEASE.md; agent skills are thin adapters over both.
//
//   node scripts/release/release.mjs <command> --package <engine|create-zudo-sg> [options]
//
// Commands:
//   status            resume point from durable state (main, tag, registry, Release)
//   prepare           bump the manifest (+ initializer template sync for the engine)
//   verify-prepared   the working tree holds a finalized changelog for --version
//   notes             print the GitHub Release notes for --version [--ref <sha>]
//   verify-candidate  --sha: commit on main, manifest/notes/tag/registry/exact CI agree
//   guard-tag         publish-run guard for GITHUB_REF_TYPE / GITHUB_REF_NAME
//   publish-decision  --sha: publish=true|false from registry state + provenance
//   await-published   poll the registry until --version is visible
//   finalize          --sha: create or keep the GitHub Release (never overwrite) [--dry-run]
//
// --github-output appends key=value results to $GITHUB_OUTPUT.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  ReleaseError,
  checkTagRef,
  compareVersions,
  createGithubClient,
  extractReleaseNotes,
  finalizeRelease,
  isStableVersion,
  nextStage,
  publishDecision,
  registryState,
  resolveGithubToken,
  resolvePackage,
  selectCiRuns,
  tagFor,
  verifyPublishedIdentity,
} from "./release-lib.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    package: { type: "string" },
    version: { type: "string" },
    sha: { type: "string" },
    ref: { type: "string" },
    "ref-type": { type: "string" },
    "ref-name": { type: "string" },
    "wait-ci": { type: "string", default: "0" },
    "dry-run": { type: "boolean", default: false },
    "github-output": { type: "boolean", default: false },
    out: { type: "string" },
  },
});

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const gitOk = (...args) => {
  try {
    execFileSync("git", args, { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

function output(results) {
  for (const [key, value] of Object.entries(results)) console.log(`${key}=${value}`);
  if (values["github-output"] && process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(results)
        .map(([k, v]) => `${k}=${v}\n`)
        .join(""),
    );
  }
}

function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}

function need(name) {
  if (!values[name]) throw new ReleaseError("usage", `--${name} is required`);
  return values[name];
}

function requireVersion() {
  const version = need("version");
  if (!isStableVersion(version))
    throw new ReleaseError("unstable-version", `'${version}' is not a stable X.Y.Z`);
  return version;
}

function requireSha() {
  const sha = need("sha");
  if (!/^[0-9a-f]{40}$/.test(sha))
    throw new ReleaseError("usage", `--sha must be a full 40-character commit SHA, got '${sha}'`);
  return sha;
}

function ghAuthToken() {
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function github() {
  return createGithubClient({
    token: resolveGithubToken({ ghAuthToken }),
    repo: process.env.GITHUB_REPOSITORY || undefined,
  });
}

const readAt = (ref, path) =>
  ref ? git("show", `${ref}:${path}`) : readFileSync(join(ROOT, path), "utf8");
const manifestVersionAt = (pkg, ref) => JSON.parse(readAt(ref, `${pkg.dir}/package.json`)).version;
const notesAt = (pkg, version, ref) =>
  extractReleaseNotes(pkg, version, readAt(ref, pkg.notesSource(version)));

async function waitForCi(client, sha, waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    const ci = selectCiRuns(await client.ciRuns(sha), { sha });
    const settled = ci.pending.length === 0 && ci.missing.length === 0;
    if (ci.ok || ci.failing.length > 0 || (settled && !ci.ok) || Date.now() >= deadline) return ci;
    console.log(
      `waiting for CI on ${sha}: ${[...ci.missing, ...ci.pending.map((r) => r.path)].join(", ")}`,
    );
    await new Promise((r) => setTimeout(r, 20_000));
  }
}

function describeCi(ci) {
  return [
    ...ci.missing.map((p) => `missing ${p}`),
    ...ci.pending.map((r) => `pending ${r.path} (${r.url})`),
    ...ci.failing.map((r) => `${r.conclusion} ${r.path} (${r.url})`),
  ].join("; ");
}

const commands = {
  async status(pkg) {
    const version = values.version ?? manifestVersionAt(pkg, "origin/main");
    const tag = tagFor(pkg, version);
    const tagSha = gitOk("rev-parse", "-q", "--verify", `refs/tags/${tag}^{commit}`)
      ? git("rev-parse", `${tag}^{commit}`)
      : null;
    const candidateSha = values.sha ?? tagSha ?? undefined;
    const reg = await registryState({ name: pkg.name, version });
    const identity =
      reg.state === "found" && candidateSha
        ? (await verifyPublishedIdentity({ pkg, version, sha: candidateSha })).state
        : "unknown";
    let release = false;
    try {
      release = (await github().releases()).some((r) => r.tag_name === tag && !r.draft);
    } catch (error) {
      if (reg.state === "found") throw error;
    }
    const manifestVersion = manifestVersionAt(pkg, candidateSha ?? "origin/main");
    const onMain = candidateSha
      ? gitOk("merge-base", "--is-ancestor", candidateSha, "origin/main")
      : manifestVersionAt(pkg, "origin/main") === version;
    const next = nextStage({
      version,
      candidateSha,
      manifestVersion,
      onMain,
      tagSha,
      registry: reg.state,
      identity,
      release,
    });
    output({
      package: pkg.name,
      version,
      tag,
      tag_sha: tagSha ?? "",
      registry: reg.state,
      identity,
      release,
      stage: next.stage,
    });
    console.log(next.reason);
  },

  async prepare(pkg) {
    const version = requireVersion();
    const manifestPath = join(ROOT, pkg.dir, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const tagged = gitOk(
      "rev-parse",
      "-q",
      "--verify",
      `refs/tags/${tagFor(pkg, manifest.version)}`,
    );
    if (
      compareVersions(version, manifest.version) < 0 ||
      (compareVersions(version, manifest.version) === 0 && tagged)
    ) {
      throw new ReleaseError(
        "version-order",
        `${version} must be greater than the released ${manifest.version}`,
      );
    }
    const reg = await registryState({ name: pkg.name, version });
    if (reg.state !== "not-found")
      throw new ReleaseError(
        `registry-${reg.state}`,
        `cannot prepare ${pkg.name}@${version}: ${reg.detail}`,
      );
    const text = readFileSync(manifestPath, "utf8");
    writeFileSync(manifestPath, text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
    if (pkg.key === "engine") {
      execFileSync("pnpm", ["sync:create-template"], { cwd: ROOT, stdio: "inherit" });
      execFileSync("pnpm", ["check:create-template"], { cwd: ROOT, stdio: "inherit" });
    }
    output({ package: pkg.name, version, notes_source: pkg.notesSource(version) });
  },

  async "verify-prepared"(pkg) {
    const version = requireVersion();
    const errors = [];
    if (manifestVersionAt(pkg) !== version)
      errors.push(`${pkg.dir}/package.json is ${manifestVersionAt(pkg)}, not ${version}`);
    try {
      notesAt(pkg, version);
    } catch (error) {
      errors.push(error.message);
    }
    if (
      pkg.key === "engine" &&
      !readFileSync(join(ROOT, pkg.dir, "CHANGELOG.md"), "utf8").includes(`## [${version}]`)
    ) {
      errors.push(`${pkg.dir}/CHANGELOG.md has no '## [${version}]' entry (run pnpm build:doc)`);
    }
    if (errors.length) throw new ReleaseError("not-prepared", errors.join("\n"));
    output({ prepared: true });
  },

  async notes(pkg) {
    const notes = notesAt(pkg, requireVersion(), values.ref);
    if (values.out) writeFileSync(values.out, notes);
    else process.stdout.write(notes);
  },

  async "guard-tag"(pkg) {
    const errors = checkTagRef({
      pkg,
      refType: values["ref-type"] ?? process.env.GITHUB_REF_TYPE,
      refName: values["ref-name"] ?? process.env.GITHUB_REF_NAME,
      manifestVersion: manifestVersionAt(pkg),
    });
    if (errors.length) throw new ReleaseError("bad-ref", errors.join("\n"));
    output({ version: manifestVersionAt(pkg), tag: tagFor(pkg, manifestVersionAt(pkg)) });
  },

  async "verify-candidate"(pkg) {
    const version = requireVersion();
    const sha = requireSha();
    const tag = tagFor(pkg, version);
    const errors = [];
    if (!gitOk("cat-file", "-e", `${sha}^{commit}`))
      throw new ReleaseError(
        "unknown-commit",
        `${sha} is not in this clone (fetch with full history)`,
      );
    if (!gitOk("merge-base", "--is-ancestor", sha, "origin/main"))
      errors.push(`${sha} is not on origin/main; only commits integrated into main are released`);
    const atSha = manifestVersionAt(pkg, sha);
    if (atSha !== version)
      errors.push(`${pkg.dir}/package.json at ${sha} is ${atSha}, not ${version}`);
    try {
      notesAt(pkg, version, sha);
    } catch (error) {
      errors.push(error.message);
    }
    const client = github();
    const tagSha = await client.tagSha(tag);
    if (tagSha && tagSha !== sha)
      errors.push(`tag ${tag} already points at ${tagSha}; release tags are never moved`);
    const ci = await waitForCi(client, sha, Number(values["wait-ci"]));
    if (!ci.ok) errors.push(`CI for ${sha} is not green: ${describeCi(ci)}`);
    if (errors.length) throw new ReleaseError("candidate-rejected", errors.join("\n"));
    const decision = await publishDecision({ pkg, version, sha });
    const results = {
      version,
      tag,
      sha,
      tag_exists: Boolean(tagSha),
      publish: decision.publish,
      workflow: pkg.workflow,
    };
    output(results);
    console.log(decision.detail);
    summary(
      `### ${pkg.name} ${version} candidate verified\n\n- commit: \`${sha}\` (on main)\n- CI: ${ci.selected
        .map((r) => `[${r.path}](${r.url}) ${r.conclusion}`)
        .join(
          ", ",
        )}\n- tag \`${tag}\`: ${tagSha ? "exists at this commit" : "absent"}\n- registry: ${decision.detail}${values["dry-run"] ? "\n- **dry run: no tag, dispatch, publication or Release**" : ""}`,
    );
  },

  async "publish-decision"(pkg) {
    const version = requireVersion();
    const decision = await publishDecision({ pkg, version, sha: requireSha() });
    output({ publish: decision.publish });
    console.log(decision.detail);
    summary(`- ${pkg.name}@${version}: ${decision.detail}`);
  },

  async "await-published"(pkg) {
    const version = requireVersion();
    for (let attempt = 1; attempt <= 12; attempt++) {
      const reg = await registryState({ name: pkg.name, version });
      if (reg.state === "found") return output({ published: true });
      console.log(`attempt ${attempt}: ${reg.detail}`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
    throw new ReleaseError(
      "not-visible",
      `${pkg.name}@${version} is not visible on the registry yet`,
    );
  },

  async finalize(pkg) {
    const version = requireVersion();
    const sha = requireSha();
    const result = await finalizeRelease({
      pkg,
      version,
      sha,
      notes: notesAt(pkg, version, sha),
      github: github(),
      dryRun: values["dry-run"],
    });
    output({ release_action: result.action, release_url: result.url ?? "" });
    console.log(result.detail);
    if (result.action === "keep" && !result.matches) console.log(`::warning::${result.detail}`);
    summary(`- GitHub Release: ${result.detail}${result.url ? ` (${result.url})` : ""}`);
  },
};

const [command] = positionals;
try {
  if (!commands[command])
    throw new ReleaseError(
      "usage",
      `unknown command '${command ?? ""}' (see the header of this file)`,
    );
  await commands[command](resolvePackage(need("package")));
} catch (error) {
  const message = error instanceof ReleaseError ? `[${error.code}] ${error.message}` : error.stack;
  console.error(process.env.GITHUB_ACTIONS ? `::error::${message.replace(/\n/g, "%0A")}` : message);
  process.exit(1);
}
