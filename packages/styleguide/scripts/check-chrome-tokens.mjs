#!/usr/bin/env node
// Guard the styleguide engine's private --sg-* color namespace.
//
// The engine stylesheet is embedded into a host that may reset Tailwind's
// --color-* theme tier.  Keep the engine chrome on its raw --sg-* tier and on
// the bracket arbitrary-value form that survives the package safelist
// extractor.  This is intentionally a small, deterministic source lint: the
// diagnostics are sorted by file, line, and source offset so a CI failure is
// easy to reproduce locally.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES_FILE = join(PACKAGE_ROOT, "styles.css");
const SOURCE_ROOT = join(PACKAGE_ROOT, "src");

export const CHROME_ROLES = Object.freeze([
  "bg",
  "fg",
  "surface",
  "surface-2",
  "border",
  "border-strong",
  "muted",
  "accent",
  "on-accent",
  "focus",
  "success",
]);
// Short alias for callers that think of these as the namespace's role list.
export const ROLES = CHROME_ROLES;

export const COLOR_UTILITY_PREFIXES = Object.freeze([
  "bg",
  "border",
  "outline",
  "ring",
  "text",
]);

const ROLE_PATTERN = CHROME_ROLES.slice().sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
const COLOR_PREFIX_PATTERN = COLOR_UTILITY_PREFIXES.join("|");

// The source tree has a few deliberate host-token boundaries.  Keep each
// entry next to its reason: these are contract exceptions, not an invitation
// to silence a new chrome violation.
const SOURCE_ALLOWLIST = [
  // Scaffolds intentionally emit the host component token utilities they teach.
  { name: "cli scaffold", matches: (path) => path.startsWith("src/cli/scaffold/") },
  // Token-manifest code inspects/generates the host token namespace by design.
  { name: "cli token manifest", matches: (path) => path.startsWith("src/cli/token-manifest/") },
  // Tests include old/new spellings as fixtures to prove validation behavior.
  { name: "tests", matches: (path) => path.includes("/__tests__/") },
];

// Per-file, per-token bare-utility exceptions. Each one is a deliberate
// host-token boundary, not a silenced violation.
const BARE_UTILITY_ALLOWLIST = [
  {
    path: "src/routes/components-preview.tsx",
    tokens: ["bg-bg"],
    // The preview canvas follows the host page background; it is not engine chrome.
    reason: "preview canvas intentionally follows the host background",
  },
  {
    path: "src/config/index.ts",
    tokens: ["text-muted", "hover:text-fg"],
    // The header token trigger renders inside zudo-doc's site header, beside
    // the package's own header buttons, so it must follow the DOC chrome's
    // theme rather than the engine's private --sg-* namespace (which styles
    // the catalog/preview chrome only).
    reason: "header-right item styled by zudo-doc's header theme",
  },
];

const SOURCE_EXT_RE = /\.(?:ts|tsx)$/;

/** Escape a literal string for use in a regular expression. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove comments while retaining exact string offsets and line breaks.
 * Strings/templates are kept intact so class literals in source still lint.
 */
export function stripComments(source) {
  // split("") retains JavaScript's UTF-16 code-unit offsets, which are the
  // offsets returned by String.matchAll() and used for line diagnostics.
  const chars = source.split("");
  let quote = null;
  let escaped = false;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "/" && next === "/") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      while (i < chars.length && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      i--;
    } else if (ch === "/" && next === "*") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      while (i < chars.length) {
        if (chars[i] === "*" && chars[i + 1] === "/") {
          chars[i] = " ";
          chars[i + 1] = " ";
          i++;
          break;
        }
        if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
        i++;
      }
    }
  }

  return chars.join("");
}

/** Recursively collect source files in a stable order. */
export function collectSourceFiles(sourceRoot = SOURCE_ROOT) {
  const files = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && SOURCE_EXT_RE.test(entry.name)) files.push(full);
    }
  }

  walk(sourceRoot);
  return files;
}

/** Return the package-root-relative path in the form used by diagnostics. */
export function packageRelative(filePath, packageRoot = PACKAGE_ROOT) {
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(packageRoot, filePath);
  return relative(packageRoot, absolutePath).replaceAll("\\", "/");
}

/** Find the body of the first `:where(:root) { … }` block. */
function findDefaultsBlock(source) {
  const cleaned = stripComments(source);
  const selector = /:where\(\s*:root\s*\)\s*\{/g;
  const match = selector.exec(cleaned);
  if (!match) return { source: cleaned, body: "", start: 0 };

  const bodyStart = selector.lastIndex;
  let depth = 1;
  let i = bodyStart;
  for (; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return { source: cleaned, body: cleaned.slice(bodyStart, i), start: bodyStart };
}

/** Parse --sg-* declarations from the contract's top defaults block. */
export function parseDefaultRoles(stylesSource) {
  const { body } = findDefaultsBlock(stylesSource);
  const declared = new Set();
  for (const match of body.matchAll(/--sg-([a-z0-9]+(?:-[a-z0-9]+)*)\s*:/gi)) {
    declared.add(match[1].toLowerCase());
  }
  return declared;
}

/** Parse every --sg-* declaration, including local layout variables. */
export function parseDeclaredVariables(stylesSource) {
  const cleaned = stripComments(stylesSource);
  const declared = new Set();
  for (const match of cleaned.matchAll(/--sg-([a-z0-9]+(?:-[a-z0-9]+)*)\s*:/gi)) {
    declared.add(match[1].toLowerCase());
  }
  return declared;
}

function lineNumber(source, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (source[i] === "\n") line++;
  return line;
}

function isAllowlisted(path, category, token) {
  if (SOURCE_ALLOWLIST.some((entry) => entry.matches(path))) return true;
  return (
    category === "bare utility" &&
    BARE_UTILITY_ALLOWLIST.some((entry) => entry.path === path && entry.tokens.includes(token))
  );
}

function replacementForUtility(prefix, role) {
  if (prefix === "bg") return `${prefix}-[var(--sg-${role})]`;
  return `${prefix}-[color:var(--sg-${role})]`;
}

function replacementForVariable(variable) {
  const name = variable.replace(/^--/, "");
  if (name.startsWith("color-sg-")) return `--sg-${name.slice("color-sg-".length)}`;
  if (name.startsWith("sg-color-")) return `--sg-${name.slice("sg-color-".length)}`;
  if (name.startsWith("color-")) return `--sg-${name.slice("color-".length)}`;
  return variable;
}

function addFinding(findings, source, filePath, offset, category, token, replacement) {
  const relPath = packageRelative(filePath);
  const line = lineNumber(source, offset);
  // A forbidden spelling nested in var(--color-sg-…) is the same source
  // mistake as the outer legacy var; keep one actionable diagnostic.
  const duplicate = findings.some((finding) => {
    if (finding.file !== relPath || finding.line !== line) return false;
    if (finding.token === token && finding.replacement === replacement) return true;
    return (
      finding.category === "legacy color variable" &&
      category === "forbidden spelling" &&
      finding.offset <= offset &&
      finding.offset + finding.token.length >= offset
    );
  });
  if (!duplicate) findings.push({ file: relPath, line, offset, category, token, replacement });
}

function scanForbiddenSpellings(source, filePath, findings) {
  const cleaned = stripComments(source);
  const forbidden = /--(?:color-sg|sg-color)-[a-z0-9_-]+/gi;
  for (const match of cleaned.matchAll(forbidden)) {
    addFinding(
      findings,
      source,
      filePath,
      match.index,
      "forbidden spelling",
      match[0],
      replacementForVariable(match[0]),
    );
  }
}

function scanLegacyVars(source, filePath, findings) {
  const cleaned = stripComments(source);
  const legacy = /var\(\s*(--color-[a-z0-9_-]+)\s*(?=[,)])/gi;
  for (const match of cleaned.matchAll(legacy)) {
    const variable = match[1];
    const token = `var(${variable})`;
    addFinding(
      findings,
      source,
      filePath,
      match.index,
      "legacy color variable",
      token,
      `var(${replacementForVariable(variable)})`,
    );
  }
}

function scanBareUtilities(source, filePath, findings) {
  const cleaned = stripComments(source);
  const bare = new RegExp(
    String.raw`(?<![A-Za-z0-9_/-])(?<variants>(?:(?:[A-Za-z0-9_-]+):)*)(?<important>!?)(?<prefix>${COLOR_PREFIX_PATTERN})-(?<role>${ROLE_PATTERN})(?<modifier>\/[A-Za-z0-9._%-]+)?(?![A-Za-z0-9_-])`,
    "gi",
  );
  for (const match of cleaned.matchAll(bare)) {
    const token = match[0];
    if (isAllowlisted(packageRelative(filePath), "bare utility", token)) continue;
    const { variants = "", important = "", prefix, role, modifier = "" } = match.groups;
    const replacement = `${variants}${important}${replacementForUtility(prefix.toLowerCase(), role.toLowerCase())}${modifier}`;
    addFinding(findings, source, filePath, match.index, "bare utility", token, replacement);
  }
}

function scanParenUtilities(source, filePath, findings) {
  const cleaned = stripComments(source);
  const paren = new RegExp(
    String.raw`(?<![A-Za-z0-9_/-])(?<variants>(?:(?:[A-Za-z0-9_-]+):)*)(?<important>!?)(?<prefix>[A-Za-z][A-Za-z0-9-]*)-\((?<variable>--sg-[a-z0-9_-]+)\)(?<modifier>\/[A-Za-z0-9._%-]+)?(?![A-Za-z0-9_-])`,
    "gi",
  );
  for (const match of cleaned.matchAll(paren)) {
    const token = match[0];
    if (isAllowlisted(packageRelative(filePath), "paren utility", token)) continue;
    const { variants = "", important = "", prefix, variable, modifier = "" } = match.groups;
    const normalizedPrefix = prefix.toLowerCase();
    const replacement =
      normalizedPrefix === "bg"
        ? `${variants}${important}${normalizedPrefix}-[var(${variable})]${modifier}`
        : COLOR_UTILITY_PREFIXES.includes(normalizedPrefix)
          ? `${variants}${important}${normalizedPrefix}-[color:var(${variable})]${modifier}`
          : `${variants}${important}${normalizedPrefix}-[var(${variable})]${modifier}`;
    addFinding(findings, source, filePath, match.index, "paren utility", token, replacement);
  }
}

function scanRoleReferences(source, filePath, declaredRoles, declaredVariables, findings) {
  const cleaned = stripComments(source);
  const refs = /var\(\s*--sg-([a-z0-9]+(?:-[a-z0-9]+)*)\s*(?=[,)])/gi;
  for (const match of cleaned.matchAll(refs)) {
    const role = match[1].toLowerCase();
    // The eleven color roles must be in the dedicated defaults block. Other
    // --sg-* references are allowed only when styles.css declares a local
    // layout variable (e.g. --sg-header-h) somewhere in the stylesheet.
    if (CHROME_ROLES.includes(role) ? declaredRoles.has(role) : declaredVariables.has(role)) continue;
    const token = `var(--sg-${role})`;
    addFinding(
      findings,
      source,
      filePath,
      match.index,
      "undeclared role",
      token,
      `--sg-${role}`,
    );
  }
}

/** Lint one source text (useful for focused tests and editor integrations). */
export function lintSource(
  source,
  filePath = "src/sample.tsx",
  declaredRoles = new Set(CHROME_ROLES),
  declaredVariables = declaredRoles,
) {
  const findings = [];
  scanForbiddenSpellings(source, filePath, findings);
  scanBareUtilities(source, filePath, findings);
  scanParenUtilities(source, filePath, findings);
  scanRoleReferences(source, filePath, declaredRoles, declaredVariables, findings);
  return findings;
}

/**
 * Lint the checked-in package tree.
 *
 * Options are intentionally injectable so tests can exercise the exact
 * diagnostics without rewriting package files:
 *   { stylesSource, sourceFiles: [{ path, source }] }
 */
export function lintChromeTokens({
  stylesSource = readFileSync(STYLES_FILE, "utf8"),
  sourceFiles = collectSourceFiles(),
} = {}) {
  const findings = [];
  const declaredRoles = parseDefaultRoles(stylesSource);
  const declaredVariables = parseDeclaredVariables(stylesSource);

  scanLegacyVars(stylesSource, STYLES_FILE, findings);
  scanForbiddenSpellings(stylesSource, STYLES_FILE, findings);
  scanRoleReferences(stylesSource, STYLES_FILE, declaredRoles, declaredVariables, findings);

  for (const entry of sourceFiles) {
    const filePath = typeof entry === "string" ? entry : entry.path;
    const source = typeof entry === "string" ? readFileSync(entry, "utf8") : entry.source;
    const relPath = packageRelative(filePath);
    if (SOURCE_ALLOWLIST.some((allowlist) => allowlist.matches(relPath))) continue;
    const sourceFindings = lintSource(source, filePath, declaredRoles, declaredVariables);
    findings.push(...sourceFindings);
  }

  return findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.offset - b.offset || a.category.localeCompare(b.category),
  );
}

export function formatFinding(finding) {
  if (finding.category === "undeclared role") {
    return `${finding.file}:${finding.line}: ${finding.category} ${JSON.stringify(finding.token)} → declare ${JSON.stringify(finding.replacement)} in the styles.css defaults block`;
  }
  return `${finding.file}:${finding.line}: ${finding.category} ${JSON.stringify(finding.token)} → replace with ${JSON.stringify(finding.replacement)}`;
}

export function main() {
  const findings = lintChromeTokens();
  if (findings.length > 0) {
    console.error(`[check:chrome-tokens] FAILED (${findings.length} violation${findings.length === 1 ? "" : "s"}):`);
    for (const finding of findings) console.error(`  ${formatFinding(finding)}`);
    process.exitCode = 1;
    return findings;
  }
  console.log(`[check:chrome-tokens] OK — --sg-* chrome namespace (${collectSourceFiles().length} source files scanned).`);
  return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
