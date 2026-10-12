#!/usr/bin/env node
// scripts/check-first-party-peer-floors.mjs
//
// Read-only gate for ADR §13 "peer floors follow latest": every first-party
// `@takazudo/*` peer declared by the engine (packages/styleguide) and by
// @zudo-sg/demo-ui must be exactly `^<root exact pin>`, and any direct copy
// of that package in the owner must equal the root pin.
//
// This verifies manifest agreement only. It does not read node_modules, the
// lockfile, or the npm registry — published-version freshness stays the job of
// the dependency-bump round (/dev-bump-zudo-deps). It never edits manifests.
//
// Usage:
//   node scripts/check-first-party-peer-floors.mjs   # exit 1 on any mismatch

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCOPE = "@takazudo/";
export const ROOT_MANIFEST = "package.json";
export const OWNER_MANIFESTS = ["packages/styleguide/package.json", "packages/demo-ui/package.json"];
const ROOT_PIN_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];
const OWNER_COPY_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];

const EXACT_STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const LOOSE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+/;

/** Why `spec` is not an exact stable `MAJOR.MINOR.PATCH`, or null when it is. */
export function exactPinProblem(spec) {
  if (typeof spec !== "string") return `not a string (${JSON.stringify(spec)})`;
  if (EXACT_STABLE.test(spec)) return null;
  if (spec !== spec.trim() || /\s/.test(spec)) return "contains whitespace";
  if (/^(workspace|file|link|npm|git|github|http|https):/.test(spec))
    return `"${spec.split(":")[0]}:" specifier is not an exact version`;
  if (/^[\^~<>=*]|^x$|\|\|/.test(spec)) return "is a range, not an exact pin";
  if (LOOSE_VERSION.test(spec) && /[-+]/.test(spec)) return "has a prerelease/build suffix";
  return "is malformed (expected MAJOR.MINOR.PATCH with no leading zeros)";
}

/**
 * Resolve one unambiguous root pin for `name` across ROOT_PIN_SECTIONS.
 * Returns `{ pin }` or `{ error }`.
 */
export function resolveRootPin(rootManifest, name) {
  const found = ROOT_PIN_SECTIONS.flatMap((section) => {
    const deps = rootManifest?.[section];
    return deps && Object.hasOwn(deps, name) ? [{ section, spec: deps[name] }] : [];
  });
  if (found.length === 0) {
    return { error: `no root declaration in ${ROOT_PIN_SECTIONS.join(" / ")}` };
  }
  const distinct = [...new Set(found.map((f) => JSON.stringify(f.spec)))];
  if (distinct.length > 1) {
    const list = found.map((f) => `${f.section}=${JSON.stringify(f.spec)}`).join(", ");
    return { error: `conflicting root declarations (${list})` };
  }
  const { section, spec } = found[0];
  const problem = exactPinProblem(spec);
  if (problem) {
    return { error: `root ${section} ${JSON.stringify(spec)} ${problem}` };
  }
  return { pin: spec };
}

function peerRangeProblem(spec) {
  if (typeof spec !== "string") return `not a string (${JSON.stringify(spec)})`;
  if (spec.startsWith("^") && exactPinProblem(spec.slice(1)) === null) return null;
  return "unsupported range form (only `^MAJOR.MINOR.PATCH` is allowed)";
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

/**
 * Pure validator. `owners` is `[{ path, manifest }]`. Returns every mismatch as
 * `{ owner, name, field, actual, expected, fix }`; an empty array means OK.
 */
export function validatePeerFloors({ rootPath = ROOT_MANIFEST, rootManifest, owners }) {
  const problems = [];
  for (const { path, manifest } of owners) {
    const peers = manifest?.peerDependencies ?? {};
    const meta = manifest?.peerDependenciesMeta ?? {};
    const names = new Set(
      [...Object.keys(peers), ...Object.keys(meta)].filter((n) => n.startsWith(SCOPE)),
    );
    for (const name of [...names].sort()) {
      const optional = meta[name]?.optional === true ? " (optional peer)" : "";
      const root = resolveRootPin(rootManifest, name);
      if (root.error) {
        problems.push({
          owner: path,
          name,
          field: `peerDependencies${optional}`,
          actual: Object.hasOwn(peers, name) ? peers[name] : "(absent)",
          expected: `^<exact stable pin in ${rootPath}>`,
          fix: `${rootPath}: ${root.error}; declare ${name} once as an exact MAJOR.MINOR.PATCH`,
        });
        continue;
      }
      const expected = `^${root.pin}`;

      if (!Object.hasOwn(peers, name)) {
        problems.push({
          owner: path,
          name,
          field: `peerDependenciesMeta${optional}`,
          actual: "(no peerDependencies entry)",
          expected,
          fix: `add "${name}": "${expected}" to peerDependencies (keep peerDependenciesMeta as is)`,
        });
      } else {
        const actual = peers[name];
        const rangeProblem = peerRangeProblem(actual);
        if (rangeProblem) {
          problems.push({
            owner: path,
            name,
            field: `peerDependencies${optional}`,
            actual,
            expected,
            fix: `${rangeProblem}; set it to "${expected}"`,
          });
        } else if (actual !== expected) {
          const direction =
            compareVersions(actual.slice(1), root.pin) < 0 ? "below" : "above";
          problems.push({
            owner: path,
            name,
            field: `peerDependencies${optional}`,
            actual,
            expected,
            fix: `floor is ${direction} the root pin ${root.pin}; set the peer to "${expected}" (or move the root pin and every owner copy together)`,
          });
        }
      }

      for (const section of OWNER_COPY_SECTIONS) {
        const deps = manifest?.[section];
        if (!deps || !Object.hasOwn(deps, name)) continue;
        if (deps[name] !== root.pin) {
          problems.push({
            owner: path,
            name,
            field: section,
            actual: deps[name],
            expected: root.pin,
            fix: `set the owner's direct ${section} copy to the exact root pin "${root.pin}"`,
          });
        }
      }
    }
  }
  return problems;
}

export function formatProblems(problems) {
  return problems
    .map(
      (p) =>
        `  ${p.owner} → ${p.name} [${p.field}]\n` +
        `    actual:   ${typeof p.actual === "string" ? p.actual : JSON.stringify(p.actual)}\n` +
        `    expected: ${p.expected}\n` +
        `    fix:      ${p.fix}`,
    )
    .join("\n");
}

function readManifest(repoRoot, rel) {
  const file = join(repoRoot, rel);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`cannot read ${rel}: ${err.message}`);
  }
}

export function checkRepo(repoRoot) {
  const rootManifest = readManifest(repoRoot, ROOT_MANIFEST);
  const owners = OWNER_MANIFESTS.map((path) => ({ path, manifest: readManifest(repoRoot, path) }));
  return validatePeerFloors({ rootManifest, owners });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let problems;
  try {
    problems = checkRepo(repoRoot);
  } catch (err) {
    console.error(`check:peer-floors: ${err.message}`);
    process.exit(1);
  }
  if (problems.length > 0) {
    console.error(
      `check:peer-floors: ${problems.length} first-party peer-floor mismatch(es) (ADR §13):\n` +
        formatProblems(problems),
    );
    process.exit(1);
  }
  console.log("check:peer-floors: first-party peer floors match the root pins.");
}
