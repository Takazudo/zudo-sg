// Compile preview styles through the host-installed public zfb CLI.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, globSync, realpathSync, readFileSync, readdirSync, statSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import postcss from "postcss";

export const PREVIEW_DOC_ATTRIBUTE = "data-sg-preview-doc";
export interface CompilePreviewCssOptions {
  projectRoot?: string;
  wind?: Record<string, unknown>;
  sources?: string[];
}
export interface CompilePreviewCssResult {
  css: string;
  dependencies: string[];
  sourceFiles: string[];
  /** The public CSS CLI does not expose a candidate count; always zero. */
  candidateCount: number;
}

// Visit selectors only. Quoted attribute values, escaped characters and comments
// must not be mistaken for pseudo classes; compound roots are scoped too.
export function scopeTokensToPreviewDoc(css: string): string {
  const ast = postcss.parse(css);
  ast.walkRules((rule) => {
    let quote = "", comment = false, out = "", brackets = 0;
    const s = rule.selector;
    for (let i = 0; i < s.length; i++) {
      const c = s[i]!;
      if (comment) { out += c; if (c === "*" && s[i + 1] === "/") { out += s[++i]; comment = false; } continue; }
      if (c === "\\") { out += c + (s[++i] ?? ""); continue; }
      if (quote) { out += c; if (c === quote) quote = ""; continue; }
      if (c === '"' || c === "'") { quote = c; out += c; continue; }
      if (c === "/" && s[i + 1] === "*") { comment = true; out += c; continue; }
      if (c === "[") brackets++;
      if (c === "]") brackets--;
      if (brackets === 0 && s[i - 1] !== ":" && s.slice(i, i + 5).toLowerCase() === ":root" && !/[\w\\-\u0080-\uFFFF]/.test(s[i + 5] ?? "")) {
        out += ":root";
        if (!new RegExp(`^\\[${PREVIEW_DOC_ATTRIBUTE}(?:\\]|[~|^$*]?=)`).test(s.slice(i + 5))) out += `[${PREVIEW_DOC_ATTRIBUTE}]`;
        i += 4;
      } else out += c;
    }
    rule.selector = out;
  });
  return ast.toString();
}

export function resolveZfbCli(projectRoot: string): { cli: string; packageJson: string } {
  const req = createRequire(join(projectRoot, "package.json"));
  const packageJson = req.resolve("@takazudo/zfb/package.json");
  const pkg = JSON.parse(readFileSync(packageJson, "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.zfb;
  return { cli: resolve(dirname(packageJson), bin), packageJson };
}

/** Reject values that JSON would silently omit/change in the child snapshot. */
export function snapshotWind(wind: Record<string, unknown> = {}): string {
  const seen = new Set<object>();
  const check = (v: unknown): void => {
    if (v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) return;
    if (typeof v !== "object" || (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype)) throw new Error("[zudo-sg] wind must contain only plain serializable data");
    if (seen.has(v)) throw new Error("[zudo-sg] circular wind config");
    seen.add(v); for (const value of Object.values(v)) check(value); seen.delete(v);
  };
  check(wind);
  return JSON.stringify(wind);
}

export function resolveInput(spec: string, from: string): string | undefined {
  try {
    const path = spec.startsWith(".") ? resolve(dirname(from), spec) : createRequire(from).resolve(spec);
    for (const candidate of [path, path.replace(/\.js$/, ".ts"), path.replace(/\.js$/, ".tsx"), `${path}.ts`, `${path}.js`, `${path}.mjs`, join(path, "index.ts")]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  } catch { /* Missing inputs are also retained by graph() for invalidation. */ }
  return undefined;
}
export function inputGraph(entries: string[]): string[] {
  const found = new Set<string>();
  const visit = (file: string) => {
    if (found.has(file)) return;
    found.add(file);
    let text: string; try { text = readFileSync(file, "utf8"); } catch { return; }
    const pattern = /(?:@import\s+(?:url\(\s*)?|(?:import|export)\s+(?:[^;]*?from\s*)?|require\(\s*)["']([^"']+)["']/g;
    const imports = [...text.matchAll(pattern)];
    if (file.endsWith(".css")) for (const m of text.matchAll(/@import\s+url\(\s*([^\s"')]+)\s*\)/g)) imports.push(m);
    for (const m of imports) {
      if (/^(https?:|data:)/.test(m[1]!)) continue;
      const dep = resolveInput(m[1]!, file);
      if (dep) visit(dep);
      else if (m[1]!.startsWith(".")) found.add(resolve(dirname(file), m[1]!));
    }
  };
  entries.forEach(visit); return [...found].sort();
}

/** Re-enumerate every root, including empty and nested directories. */
export function sourceInputs(projectRoot: string, sources: string[], includeNodeModules = false): string[] {
  const found = new Set<string>();
  const visited = new Set<string>();
  const walk = (path: string, matches?: Set<string>) => {
    if (/\.zudo-sg-preview-/.test(path)) return;
    let stat; try { stat = statSync(path); } catch { found.add(path); return; }
    if (stat.isDirectory()) {
      const real = realpathSync(path);
      if (visited.has(real)) return;
      visited.add(real);
      found.add(path);
      for (const name of readdirSync(path).sort()) if ((includeNodeModules || name !== "node_modules") && name !== ".git") walk(join(path, name), matches);
    } else if (!matches || matches.has(path)) found.add(path);
  };
  for (const source of sources) {
    const abs = resolve(projectRoot, source);
    const at = abs.search(/[?*{[]/);
    if (at < 0) walk(abs);
    else {
      const base = abs.slice(0, abs.lastIndexOf("/", at));
      // Node's glob dialect handles brace alternatives and character classes,
      // while walking the anchor retains initially empty directory membership.
      walk(base, new Set(globSync(abs)));

    }
  }
  return [...found].sort();
}
export function contentStamp(paths: readonly string[], data = ""): string {
  const hash = createHash("sha256").update(data);
  for (const file of [...new Set(paths)].sort()) {
    hash.update(file);
    try { if (statSync(file).isFile()) hash.update(readFileSync(file)); else hash.update(readdirSync(file).filter(n => !n.startsWith(".zudo-sg-preview-")).sort().join("\n")); }
    catch { hash.update("missing"); }
  }
  return hash.digest("hex");
}

export async function compilePreviewCss(entryAbsPath: string, options: CompilePreviewCssOptions = {}): Promise<CompilePreviewCssResult> {
  const entry = resolve(entryAbsPath);
  const projectRoot = resolve(options.projectRoot ?? dirname(entry));
  const { cli, packageJson } = resolveZfbCli(projectRoot);
  const hostWind = options.wind ?? {};
  const hostSources = (hostWind.sources ?? {}) as Record<string, unknown>;
  const wind = snapshotWind({ ...hostWind, sources: { ...hostSources, exclude: [...((hostSources.exclude ?? []) as string[]), ".zudo-sg-preview-*", "**/.zudo-sg-preview-*"] } });
  const nonce = `${process.pid}-${randomBytes(8).toString("hex")}`;
  const config = join(projectRoot, `.zudo-sg-preview-${nonce}.config.ts`);
  const output = join(projectRoot, `.zudo-sg-preview-${nonce}.css`);
  try {
    await writeFile(config, `export default { wind: ${wind} };\n`);
    const args = [cli, "css", "--input", entry, "--output", output, "--config", config, "--project-root", projectRoot];
    for (const source of options.sources ?? []) args.push("--source", source);
    args.push("--no-auto-source");
    await new Promise<void>((ok, fail) => {
      const child = spawn(process.execPath, args, { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] });
      let diagnostic = "";
      child.stdout.on("data", b => { diagnostic = (diagnostic + b).slice(-32000); });
      child.stderr.on("data", b => { diagnostic = (diagnostic + b).slice(-32000); });
      child.on("error", fail);
      child.on("close", code => code === 0 ? ok() : fail(new Error(`zfb css failed (${code}): ${diagnostic}`)));
    });
    return { css: scopeTokensToPreviewDoc(await readFile(output, "utf8")), dependencies: inputGraph([entry, packageJson]), sourceFiles: sourceInputs(projectRoot, options.sources ?? []), candidateCount: 0 };
  } finally {
    await Promise.all([rm(config, { force: true }), rm(output, { force: true })]);
  }
}
