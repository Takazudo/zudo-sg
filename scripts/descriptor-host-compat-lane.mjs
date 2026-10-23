// fixtures/descriptor-host is the intentional zudo-doc 6 / Node 22 compat lane
// for the engine's `^6.2.0 || ^7.1.0` doc peer window (ADR §13, 2026-10-19
// amendment). Every other host moves with the root zudo-doc pin; this one
// must not. A generic `/dev-bump-zudo-deps` resolver run rewrites it to the
// newest doc, so these assertions fail loudly instead of letting that
// silently erase the older half of the window's test coverage.
//
// Limitation: descriptor-host disables the in-engine preview and /tokens
// routes, so the lane proves descriptor-mode compatibility on doc 6, not
// every engine mode.

export const DOC6_LANE_FIXTURE = "fixtures/descriptor-host";
export const DOC6_LANE_ZUDO_DOC = "6.2.0";
/** KaTeX 0.16.x is the line zudo-doc 6.2.0 peers (`^0.16.0`); doc 7 rejects it. */
const DOC6_LANE_KATEX = /^\^?0\.16\.(0|[1-9]\d*)$/u;
const KATEX_016_VERSION = /^0\.16\.(0|[1-9]\d*)$/u;

/** Problems with the committed fixture manifest; an empty array means the lane is intact. */
export function doc6LaneManifestProblems(manifest) {
  const problems = [];
  const deps = manifest?.dependencies ?? {};
  if (deps["@takazudo/zudo-doc"] !== DOC6_LANE_ZUDO_DOC) {
    problems.push(
      `${DOC6_LANE_FIXTURE} must pin @takazudo/zudo-doc to exactly ${DOC6_LANE_ZUDO_DOC} (found ${JSON.stringify(deps["@takazudo/zudo-doc"])}); it is the doc 6 compat lane — see ADR §13`,
    );
  }
  if (typeof deps.katex !== "string" || !DOC6_LANE_KATEX.test(deps.katex)) {
    problems.push(
      `${DOC6_LANE_FIXTURE} must keep katex on 0.16.x (found ${JSON.stringify(deps.katex)}); zudo-doc ${DOC6_LANE_ZUDO_DOC} peers katex ^0.16.0`,
    );
  }
  if (Object.hasOwn(deps, "@takazudo/zudo-doc-history-server")) {
    problems.push(`${DOC6_LANE_FIXTURE} must not add @takazudo/zudo-doc-history-server`);
  }
  const node = manifest?.engines?.node;
  if (node !== undefined && !/^>=\s*22(\.|\s|$)/u.test(node)) {
    problems.push(
      `${DOC6_LANE_FIXTURE} engines.node ${JSON.stringify(node)} must keep admitting Node 22 (or be omitted)`,
    );
  }
  return problems;
}

/** Problems with the versions an install of the fixture actually resolved. */
export function doc6LaneInstalledProblems({ zudoDoc, katex }) {
  const problems = [];
  if (zudoDoc !== DOC6_LANE_ZUDO_DOC) {
    problems.push(`installed @takazudo/zudo-doc ${zudoDoc}, expected ${DOC6_LANE_ZUDO_DOC}`);
  }
  if (typeof katex !== "string" || !KATEX_016_VERSION.test(katex)) {
    problems.push(`installed katex ${katex}, expected 0.16.x`);
  }
  return problems;
}
