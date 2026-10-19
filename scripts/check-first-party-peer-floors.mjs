#!/usr/bin/env node
// scripts/check-first-party-peer-floors.mjs
//
// Read-only gate for ADR §13 "peer floors follow latest": every first-party
// `@takazudo/*` peer declared by the engine (packages/styleguide) and by
// @zudo-sg/demo-ui must be exactly `^<root exact pin>`, and any direct copy
// of that package in the owner must equal the root pin.
//
// One narrow exception (ADR §13, 2026-10-19 amendment): the engine's
// `@takazudo/zudo-doc` peer may instead be the two-major window
// `^6.2.0 || ^<root exact pin>`, keeping doc 6 / Node 22 adopters supported
// while doc 7 is adopted. The retained floor is fixed (DOC_PEER_WINDOW) and
// the spelling must match exactly; every other `||` form stays rejected.
//
// This verifies manifest agreement only. It does not read node_modules, the
// lockfile, or the npm registry — published-version freshness stays the job of
// the dependency-bump round (/dev-bump-zudo-deps). It never edits manifests.
//
// Usage:
//   node scripts/check-first-party-peer-floors.mjs   # exit 1 on any mismatch

import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCOPE = "@takazudo/";
export const ROOT_MANIFEST = "package.json";
export const OWNER_MANIFESTS = ["packages/styleguide/package.json", "packages/demo-ui/package.json"];
const ROOT_PIN_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];
const OWNER_COPY_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];

/**
 * ADR §13 (2026-10-19): the only owner/package allowed a two-major peer window,
 * and the fixed older floor it retains. Remove this when doc 6 / Node 22
 * support is retired (the peer then returns to plain `^<root pin>`).
 */
export const DOC_PEER_WINDOW = Object.freeze({
  owner: "packages/styleguide/package.json",
  name: "@takazudo/zudo-doc",
  retainedFloor: "6.2.0",
});

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

/**
 * The exact window spelling accepted for `owner` → `name` at `rootPin`, or null
 * when no window applies (other owner/package, or a root pin that is not on the
 * major right after the retained floor: on the same major the window is
 * redundant, and two majors ahead it would silently drop the middle major).
 */
export function peerWindowForm(owner, name, rootPin) {
  if (owner !== DOC_PEER_WINDOW.owner || name !== DOC_PEER_WINDOW.name) return null;
  const retainedMajor = Number(DOC_PEER_WINDOW.retainedFloor.split(".")[0]);
  if (Number(rootPin.split(".")[0]) !== retainedMajor + 1) return null;
  return `^${DOC_PEER_WINDOW.retainedFloor} || ^${rootPin}`;
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
        const windowForm = peerWindowForm(path, name, root.pin);
        const rangeProblem = peerRangeProblem(actual);
        if (windowForm !== null && actual === windowForm) {
          // ADR §13 two-major window, accepted only in this exact spelling.
        } else if (windowForm !== null && typeof actual === "string" && actual.includes("||")) {
          problems.push({
            owner: path,
            name,
            field: `peerDependencies${optional}`,
            actual,
            expected: `${expected} or "${windowForm}"`,
            fix: `the only accepted window is "${windowForm}" (retained floor ${DOC_PEER_WINDOW.retainedFloor} first, then ^<root pin>, separated by " || "); set it to that or "${expected}"`,
          });
        } else if (rangeProblem) {
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

// realpath, not resolve: Node realpaths the main module URL, so a symlinked
// checkout would otherwise skip the gate and exit 0.
function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) {
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
