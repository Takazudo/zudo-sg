import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import postcss from "postcss";
import * as ts from "typescript";
import { hashWindExplainProvenance } from "./wind-explain-provenance";

export interface ClassOccurrence {
  token: string;
  locations: string[];
}

export interface ClassScan {
  classes: ClassOccurrence[];
  dynamicConstructions: string[];
}

const EXCLUDED_SOURCE_DIRS = new Set(["__snapshots__"]);

export function getConfiguredClassHelpers(repoRoot: string): Set<string> {
  const source = readFileSync(resolve(repoRoot, "zfb.config.ts"), "utf8");
  const match = source.match(/classHelpers\s*:\s*\[([^\]]*)\]/);
  if (!match) throw new Error("Could not find wind.sources.classHelpers in zfb.config.ts");
  const helpers = new Set([...match[1].matchAll(/["']([a-zA-Z_$][\w$]*)["']/g)].map((item) => item[1]));
  if (helpers.size === 0) throw new Error("zfb.config.ts declares no class helpers");
  return helpers;
}

export function getConfiguredAuthoredClassReservations(repoRoot: string): Set<string> {
  const sourceFile = ts.createSourceFile(
    "zfb.config.ts",
    readFileSync(resolve(repoRoot, "zfb.config.ts"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const reservations = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === "authoredClasses" && ts.isObjectLiteralExpression(node.initializer)) {
      for (const entry of node.initializer.properties) {
        if (!ts.isPropertyAssignment(entry)) continue;
        const name = propertyName(entry.name);
        if (name && entry.initializer.kind === ts.SyntaxKind.TrueKeyword) reservations.add(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return reservations;
}

function listTsxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_SOURCE_DIRS.has(entry.name)) files.push(...listTsxFiles(join(dir, entry.name)));
    } else if (entry.isFile() && extname(entry.name) === ".tsx") {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function propertyName(name: ts.PropertyName | ts.BindingName | undefined): string | undefined {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

interface ResolvedDeclaration {
  declaration: ts.VariableDeclaration;
  sourceFile: ts.SourceFile;
}

function declarationInScope(identifier: ts.Identifier): ResolvedDeclaration | undefined {
  let current: ts.Node | undefined = identifier.parent;
  const sourceFile = identifier.getSourceFile();
  while (current) {
    if (ts.isSourceFile(current) || ts.isBlock(current)) {
      for (const statement of current.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === identifier.text) {
            return { declaration, sourceFile };
          }
        }
      }
    }
    current = current.parent;
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const specifier of bindings.elements) {
      if (specifier.name.text !== identifier.text) continue;
      const importedName = specifier.propertyName?.text ?? specifier.name.text;
      const importedSource = importedSourceFile(sourceFile, statement.moduleSpecifier.text);
      if (!importedSource) continue;
      for (const importedStatement of importedSource.statements) {
        if (!ts.isVariableStatement(importedStatement)) continue;
        for (const declaration of importedStatement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === importedName) {
            return { declaration, sourceFile: importedSource };
          }
        }
      }
    }
  }
  return undefined;
}

const importedSourceCache = new Map<string, ts.SourceFile | null>();

function importedSourceFile(importer: ts.SourceFile, moduleSpecifier: string): ts.SourceFile | undefined {
  if (!moduleSpecifier.startsWith(".")) return undefined;
  const basePath = resolve(dirname(importer.fileName), moduleSpecifier);
  const candidates = /\.[cm]?[jt]sx?$/.test(basePath)
    ? [basePath]
    : [
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.mts`,
        `${basePath}.cts`,
        `${basePath}.js`,
        `${basePath}.mjs`,
        join(basePath, "index.ts"),
        join(basePath, "index.tsx"),
      ];

  for (const candidate of candidates) {
    if (importedSourceCache.has(candidate)) {
      const cached = importedSourceCache.get(candidate);
      if (cached) return cached;
      continue;
    }
    if (!existsSync(candidate)) {
      importedSourceCache.set(candidate, null);
      continue;
    }
    const scriptKind = candidate.endsWith(".tsx") ? ts.ScriptKind.TSX : candidate.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(candidate, readFileSync(candidate, "utf8"), ts.ScriptTarget.Latest, true, scriptKind);
    importedSourceCache.set(candidate, sourceFile);
    return sourceFile;
  }
  return undefined;
}

function isStringLike(node: ts.Expression): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function staticStringValue(node: ts.Expression): string | undefined {
  if (isStringLike(node)) return node.text;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
    return staticStringValue(node.expression);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringValue(node.left);
    const right = staticStringValue(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
}

function jsxAttributeName(node: ts.JsxAttribute): string | undefined {
  return ts.isIdentifier(node.name) ? node.name.text : undefined;
}

/** Collect class literals reachable from JSX class attributes and static story source examples. */
export function scanDemoUiClasses(repoRoot: string): ClassScan {
  const sourceRoot = resolve(repoRoot, "packages/demo-ui/src");
  const classHelpers = getConfiguredClassHelpers(repoRoot);
  const locations = new Map<string, Set<string>>();
  const dynamicConstructions = new Set<string>();

  function addLiteral(value: string, location: string): void {
    for (const token of value.split(/\s+/).filter(Boolean)) {
      const tokenLocations = locations.get(token) ?? new Set<string>();
      tokenLocations.add(location);
      locations.set(token, tokenLocations);
    }
  }

  function getLocation(node: ts.Node, sourceFile: ts.SourceFile): string {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return `${relative(repoRoot, sourceFile.fileName)}:${line + 1}`;
  }

  function evaluateClassExpression(
    expression: ts.Expression,
    sourceFile: ts.SourceFile,
    location: string,
    visitedDeclarations: Set<ts.VariableDeclaration>,
  ): void {
    const staticValue = staticStringValue(expression);
    if (staticValue !== undefined) {
      addLiteral(staticValue, location);
      return;
    }
    if (isStringLike(expression)) {
      addLiteral(expression.text, location);
      return;
    }
    if (ts.isTemplateExpression(expression)) {
      for (const span of expression.templateSpans) {
        dynamicConstructions.add(`${location}: ${expression.getText(sourceFile)}`);
        addLiteral(span.literal.text, location);
      }
      addLiteral(expression.head.text, location);
      return;
    }
    if (ts.isIdentifier(expression)) {
      const resolved = declarationInScope(expression);
      if (!resolved?.declaration.initializer || visitedDeclarations.has(resolved.declaration)) return;
      const nextVisited = new Set(visitedDeclarations);
      nextVisited.add(resolved.declaration);
      evaluateClassExpression(resolved.declaration.initializer, resolved.sourceFile, location, nextVisited);
      return;
    }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
      evaluateClassExpression(expression.expression, sourceFile, location, visitedDeclarations);
      return;
    }
    if (ts.isSatisfiesExpression(expression)) {
      evaluateClassExpression(expression.expression, sourceFile, location, visitedDeclarations);
      return;
    }
    if (ts.isConditionalExpression(expression)) {
      evaluateClassExpression(expression.whenTrue, sourceFile, location, visitedDeclarations);
      evaluateClassExpression(expression.whenFalse, sourceFile, location, visitedDeclarations);
      return;
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        dynamicConstructions.add(`${location}: ${expression.getText(sourceFile)}`);
      }
      evaluateClassExpression(expression.left, sourceFile, location, visitedDeclarations);
      evaluateClassExpression(expression.right, sourceFile, location, visitedDeclarations);
      return;
    }
    if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        if (ts.isSpreadElement(element)) evaluateClassExpression(element.expression, sourceFile, location, visitedDeclarations);
        else evaluateClassExpression(element, sourceFile, location, visitedDeclarations);
      }
      return;
    }
    if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        if (ts.isPropertyAssignment(property)) evaluateClassExpression(property.initializer, sourceFile, location, visitedDeclarations);
        else if (ts.isShorthandPropertyAssignment(property)) evaluateClassExpression(property.name, sourceFile, location, visitedDeclarations);
        else if (ts.isSpreadAssignment(property)) evaluateClassExpression(property.expression, sourceFile, location, visitedDeclarations);
      }
      return;
    }
    if (ts.isElementAccessExpression(expression) || ts.isPropertyAccessExpression(expression)) {
      evaluateClassExpression(expression.expression, sourceFile, location, visitedDeclarations);
      return;
    }
    if (ts.isCallExpression(expression)) {
      const calleeName = ts.isIdentifier(expression.expression)
        ? expression.expression.text
        : ts.isPropertyAccessExpression(expression.expression)
          ? expression.expression.name.text
          : undefined;
      if (calleeName && classHelpers.has(calleeName)) {
        for (const argument of expression.arguments) evaluateClassExpression(argument, sourceFile, location, visitedDeclarations);
      } else if (["filter", "join"].includes(calleeName ?? "") && ts.isPropertyAccessExpression(expression.expression)) {
          evaluateClassExpression(expression.expression.expression, sourceFile, location, visitedDeclarations);
        for (const argument of expression.arguments) evaluateClassExpression(argument, sourceFile, location, visitedDeclarations);
      }
      return;
    }
    if (ts.isJsxExpression(expression) && expression.expression) {
      evaluateClassExpression(expression.expression, sourceFile, location, visitedDeclarations);
    }
  }

  function parseStorySource(source: string, originalPath: string): void {
    if (!source.includes("<")) return;
    const sourceFile = ts.createSourceFile(`${originalPath}.story-source.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    visitSource(sourceFile);
  }

  function visitSource(sourceFile: ts.SourceFile): void {
    const visit = (node: ts.Node): void => {
      if (ts.isJsxAttribute(node) && ["class", "className"].includes(jsxAttributeName(node) ?? "")) {
        const location = getLocation(node, sourceFile);
        if (node.initializer && ts.isStringLiteral(node.initializer)) addLiteral(node.initializer.text, location);
        else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          evaluateClassExpression(node.initializer.expression, sourceFile, location, new Set());
        }
      }
      if (ts.isPropertyAssignment(node) && propertyName(node.name) === "source" && isStringLike(node.initializer)) {
        parseStorySource(node.initializer.text, sourceFile.fileName);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const { expression: receiver, name } = node.expression;
        if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === "classList" && ["add", "remove", "toggle", "contains"].includes(name.text)) {
          const location = getLocation(node, sourceFile);
          for (const argument of node.arguments) evaluateClassExpression(argument, sourceFile, location, new Set());
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  for (const file of listTsxFiles(sourceRoot)) {
    const sourceFile = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    visitSource(sourceFile);
  }

  return {
    classes: [...locations.entries()]
      .map(([token, tokenLocations]) => ({ token, locations: [...tokenLocations].sort() }))
      .sort((a, b) => a.token.localeCompare(b.token)),
    dynamicConstructions: [...dynamicConstructions].sort(),
  };
}

export function getWindCompilerVersion(repoRoot: string): string {
  const manifestPath = resolve(repoRoot, "node_modules/@takazudo/zfb/package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")).version as string;
}

export function getWindConfigHash(repoRoot: string, compilerVersion: string): Promise<string> {
  return hashWindExplainProvenance(repoRoot, compilerVersion);
}

export function getCandidateSetHash(candidates: string[]): string {
  return createHash("sha256").update(JSON.stringify([...candidates].sort())).digest("hex");
}

/** Read class selectors from components.css and its relative imports, plus tokens.css and prose-md.css. */
export function readAuthoredCssClasses(repoRoot: string): Set<string> {
  const stylesRoot = resolve(repoRoot, "packages/demo-ui/styles");
  const seedFiles = [
    join(stylesRoot, "components.css"),
    join(stylesRoot, "tokens.css"),
    resolve(repoRoot, "packages/demo-ui/src/content/prose-md/prose-md.css"),
  ];
  const visitedFiles = new Set<string>();
  const classes = new Set<string>();

  function visitCss(file: string): void {
    const absoluteFile = resolve(file);
    if (visitedFiles.has(absoluteFile)) return;
    if (!existsSync(absoluteFile)) throw new Error(`Missing authored CSS input: ${relative(repoRoot, absoluteFile)}`);
    visitedFiles.add(absoluteFile);

    const root = postcss.parse(readFileSync(absoluteFile, "utf8"), { from: absoluteFile });
    root.walkAtRules("import", (rule) => {
      const match = rule.params.match(/^(?:url\()?\s*["']?([^"')\s]+)["']?\s*\)?/);
      const imported = match?.[1];
      if (!imported || !imported.startsWith(".")) return;
      visitCss(resolve(dirname(absoluteFile), imported));
    });
    root.walkRules((rule) => {
      for (const match of rule.selector.matchAll(/(?<![\w-])\.([A-Za-z_][A-Za-z0-9_-]*)/g)) {
        classes.add(match[1]);
      }
    });
  }

  for (const file of seedFiles) visitCss(file);
  return classes;
}
