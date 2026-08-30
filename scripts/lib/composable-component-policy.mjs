import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";

export const CLASSIFICATIONS = [
  "has-sidecar",
  "expressible-but-unonboarded",
  "explicitly-excluded",
  "not-expressible",
];

const PACKAGE_NAME = "@zudo-sg/ui";
const INDEX_PATH = "packages/ui/src/index.ts";

/** Small, reviewable policy exceptions. Keys are public export names. */
export const POLICY_OVERRIDES = Object.freeze({
  // Client-only behavior adapters render no authorable UI of their own.
  ContactFormEnhancer: ["not-expressible", "app-runtime-coupling", "client behavior adapter with a callback seam"],
  ContextSwitcherEnhancer: ["not-expressible", "app-runtime-coupling", "client behavior adapter; renders no authorable UI"],
  MobileNavEnhancer: ["not-expressible", "app-runtime-coupling", "client behavior adapter; renders no authorable UI"],
  NavEnhancer: ["not-expressible", "app-runtime-coupling", "client behavior adapter; renders no authorable UI"],
  NewsFilterEnhancer: ["not-expressible", "app-runtime-coupling", "client behavior adapter; renders no authorable UI"],
  RecruitFormEnhancer: ["not-expressible", "app-runtime-coupling", "client behavior adapter; renders no authorable UI"],
  SearchResultsEnhancer: ["not-expressible", "app-runtime-coupling", "client behavior adapter; renders no authorable UI"],
  SearchToggleEnhancer: ["not-expressible", "app-runtime-coupling", "client behavior adapter; renders no authorable UI"],

  // The values are JSON-shaped, but ownership belongs to a caller data layer.
  NewsList: ["not-expressible", "caller-derived-collection", "items are caller-filtered/sorted feed data"],
  SearchResults: ["not-expressible", "caller-derived-collection", "docs are a caller-built application search index"],

  // Public building blocks remain supported API, but are intentionally not
  // standalone Composer palette entries.
  CardLink: ["explicitly-excluded", "internal-compositional-primitive", "wrapper intended to compose a card subtree"],
  CardTitle: ["explicitly-excluded", "internal-compositional-primitive", "compound child of Card"],
  Note: ["explicitly-excluded", "internal-compositional-primitive", "fixed-tone convenience companion to Callout"],
  ProseA: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseBlockquote: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseDd: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseDl: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseDt: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseEm: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseH2: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseH3: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseH4: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseH5: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseH6: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseLi: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseOl: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseStrong: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseTable: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseTd: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseTh: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ProseUl: ["explicitly-excluded", "internal-compositional-primitive", "MDX prose renderer primitive"],
  ViewAllLink: ["explicitly-excluded", "internal-compositional-primitive", "inline companion used inside larger sections"],
});

function posix(path) {
  return path.split(sep).join("/");
}

function gitKnownFiles(root, pattern) {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", pattern],
    {
    cwd: root,
    encoding: "utf8",
    },
  );
  return output.split("\n").filter(Boolean).sort();
}

function resolveModuleFile(containingFile, specifier) {
  const base = resolve(dirname(containingFile), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts"), resolve(base, "index.tsx")]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function publicComponents(root) {
  const indexFile = resolve(root, INDEX_PATH);
  const program = ts.createProgram([indexFile], {
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: "preact",
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    skipLibCheck: true,
    strict: true,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(indexFile);
  const moduleSymbol = source && checker.getSymbolAtLocation(source);
  if (!source || !moduleSymbol) throw new Error(`Cannot analyze ${INDEX_PATH}`);

  const declaredRuntimeNames = new Set();
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) {
      if (!element.isTypeOnly && /^[A-Z][a-zA-Z0-9]*$/.test(element.name.text)) declaredRuntimeNames.add(element.name.text);
    }
  }

  const rows = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(exported.name)) continue;
    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (!declaration) continue;
    const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
    if (signatures.length === 0) continue;
    const signature = signatures[0];
    const propsSymbol = signature.parameters[0];
    const propsType = propsSymbol
      ? checker.getTypeOfSymbolAtLocation(propsSymbol, propsSymbol.valueDeclaration ?? declaration)
      : undefined;
    rows.push({
      component: exported.name,
      identity: `${PACKAGE_NAME}#${exported.name}`,
      source: posix(relative(root, declaration.getSourceFile().fileName)),
      props: propsType ? checker.typeToString(propsType) : "none",
      propsType,
      checker,
    });
  }
  rows.sort((a, b) => a.identity.localeCompare(b.identity));
  const callableNames = new Set(rows.map((row) => row.component));
  const unresolved = [...declaredRuntimeNames].filter((name) => !callableNames.has(name)).sort();
  return { rows, unresolved };
}

function nonJsonEvidence(type, checker, seen = new Set(), path = "props", depth = 0) {
  if (depth > 12) return `${path}: recursive/opaque type`;
  const shown = checker.typeToString(type);
  if (/\b(?:VNode|ComponentChildren|ComponentType|JSX\.Element)\b/.test(shown)) return `${path}: ${shown}`;
  if (type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Never)) return undefined;
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.ESSymbol | ts.TypeFlags.BigIntLike)) return `${path}: ${checker.typeToString(type)}`;
  if (type.isUnion()) {
    for (const member of type.types) {
      const result = nonJsonEvidence(member, checker, seen, path, depth + 1);
      if (result) return result;
    }
    return undefined;
  }
  if (type.isIntersection()) {
    for (const member of type.types) {
      const result = nonJsonEvidence(member, checker, seen, path, depth + 1);
      if (result) return result;
    }
    return undefined;
  }
  if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) return `${path}: callback/function`;
  if (seen.has(type)) return undefined;
  seen.add(type);
  const element = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
  if (element) {
    const result = nonJsonEvidence(element, checker, seen, `${path}[]`, depth + 1);
    seen.delete(type);
    return result;
  }
  for (const prop of checker.getPropertiesOfType(type).sort((a, b) => a.name.localeCompare(b.name))) {
    const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
    if (!declaration) continue;
    const propType = checker.getTypeOfSymbolAtLocation(prop, declaration);
    const result = nonJsonEvidence(propType, checker, seen, `${path}.${prop.name}`, depth + 1);
    if (result) {
      seen.delete(type);
      return result;
    }
  }
  seen.delete(type);
  return undefined;
}

function sidecars(root, publicRows) {
  const publicBySource = new Map();
  for (const row of publicRows) {
    const values = publicBySource.get(row.source) ?? [];
    values.push(row.component);
    publicBySource.set(row.source, values);
  }
  const matches = new Map();
  const errors = [];
  for (const sidecar of gitKnownFiles(root, "packages/ui/src/**/*.composer.tsx")) {
    const absolute = resolve(root, sidecar);
    const ast = ts.createSourceFile(sidecar, readFileSync(absolute, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const candidates = [];
    for (const node of ast.statements) {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (!node.moduleSpecifier.text.startsWith(".")) continue;
      const target = resolveModuleFile(absolute, node.moduleSpecifier.text);
      if (!target) continue;
      const targetRel = posix(relative(root, target));
      const publicNames = new Set(publicBySource.get(targetRel) ?? []);
      const clause = node.importClause;
      if (clause?.name && publicNames.has(clause.name.text)) candidates.push(clause.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          if (!element.isTypeOnly && publicNames.has(element.propertyName?.text ?? element.name.text)) {
            candidates.push(element.propertyName?.text ?? element.name.text);
          }
        }
      }
    }
    const unique = [...new Set(candidates)];
    if (unique.length !== 1) {
      errors.push(`${sidecar}: expected exactly one matching public component import, found ${unique.length} (${unique.join(", ") || "none"})`);
      continue;
    }
    const component = unique[0];
    if (matches.has(component)) errors.push(`${component}: multiple sidecars (${matches.get(component)}, ${sidecar})`);
    matches.set(component, sidecar);
  }
  return { matches, errors };
}

export function analyzeComposableComponents(root, overrides = POLICY_OVERRIDES) {
  const { rows: publicRows, unresolved } = publicComponents(root);
  const { matches, errors } = sidecars(root, publicRows);
  for (const name of unresolved) errors.push(`${name}: public PascalCase runtime export is not a callable component`);
  const names = new Set(publicRows.map((row) => row.component));
  const identities = new Set();

  for (const [name, override] of Object.entries(overrides)) {
    if (!names.has(name)) {
      errors.push(`${name}: stale policy override (not a public component)`);
    } else if (matches.has(name)) {
      errors.push(`${name}: stale policy override (component has a sidecar)`);
    }
    if (
      !Array.isArray(override) ||
      override.length !== 3 ||
      !CLASSIFICATIONS.includes(override[0]) ||
      override[0] === "has-sidecar" ||
      typeof override[1] !== "string" ||
      override[1].length === 0 ||
      typeof override[2] !== "string" ||
      override[2].length === 0
    ) {
      errors.push(`${name}: invalid policy override`);
    }
  }

  const rows = publicRows.map((row) => {
    if (identities.has(row.identity)) errors.push(`${row.identity}: duplicate public identity`);
    identities.add(row.identity);
    let classification;
    let reasonCode;
    let evidence;
    const sidecar = matches.get(row.component);
    if (sidecar) {
      classification = "has-sidecar";
      reasonCode = "discovered-sidecar";
      evidence = sidecar;
    } else if (Array.isArray(overrides[row.component])) {
      [classification, reasonCode, evidence] = overrides[row.component];
    } else {
      const nonJson = row.propsType && nonJsonEvidence(row.propsType, row.checker);
      if (nonJson) {
        classification = "not-expressible";
        reasonCode = "non-json-prop";
        evidence = `${nonJson}; TypeScript props=${row.props}`;
      } else {
        classification = "expressible-but-unonboarded";
        reasonCode = "json-props-no-sidecar";
        evidence = `TypeScript callable export; props=${row.props}`;
      }
    }
    if (!CLASSIFICATIONS.includes(classification)) errors.push(`${row.component}: invalid or missing classification ${classification}`);
    return {
      component: row.component,
      identity: row.identity,
      source: row.source,
      classification,
      reasonCode,
      evidence,
    };
  });

  for (const component of matches.keys()) {
    if (!names.has(component)) errors.push(`${component}: sidecar has no matching public component`);
  }
  const counts = Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, rows.filter((row) => row.classification === classification).length]));
  return { rows, counts, total: rows.length, errors: [...new Set(errors)].sort() };
}

function clean(value) {
  return String(value).replace(/[\t\r\n]+/g, " ");
}

export function renderComposableComponentReport(report) {
  const lines = [
    "Composable component policy inventory",
    "component/export identity\tclassification\treason-code\tsource\tevidence",
  ];
  for (const row of report.rows) {
    lines.push(`ROW\t${clean(row.identity)}\t${row.classification}\t${row.reasonCode}\t${row.source}\t${clean(row.evidence)}`);
  }
  for (const classification of CLASSIFICATIONS) lines.push(`COUNT\t${classification}\t${report.counts[classification]}`);
  lines.push(`COUNT\ttotal\t${report.total}`);
  lines.push(`STATUS\tinconsistencies\t${report.errors.length}`);
  lines.push(`STATUS\tadvisory-gaps\t${report.counts["expressible-but-unonboarded"]}`);
  for (const error of report.errors) lines.push(`ERROR\t${clean(error)}`);
  return `${lines.join("\n")}\n`;
}
