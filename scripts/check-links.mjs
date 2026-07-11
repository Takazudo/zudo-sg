#!/usr/bin/env node
/**
 * check-links.mjs — Post-build internal link checker.
 *
 * Scans <dist>/**\/*.html for href and src attributes pointing to internal
 * paths and verifies each target file exists in <dist>. Reports broken links
 * and exits non-zero if any are found (unless suppressed by
 * .check-links-allowlist).
 *
 * Usage: node scripts/check-links.mjs [--allowlist=<file>] [--dist=<dir>]
 *
 * --dist defaults to the root `dist/` (the styleguide host build). Pass
 * --dist=apps/demo/dist to check the demo site's build instead.
 */

import { readFile, readdir, access, stat } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

// Parse CLI flags
const args = process.argv.slice(2);
const distFlag = args.find((a) => a.startsWith("--dist="));
const DIST_DIR = distFlag ? resolve(ROOT_DIR, distFlag.split("=")[1]) : join(ROOT_DIR, "dist");
const allowlistFlag = args.find((a) => a.startsWith("--allowlist="));
const allowlistPath = allowlistFlag
  ? join(ROOT_DIR, allowlistFlag.split("=")[1])
  : join(ROOT_DIR, ".check-links-allowlist");

async function loadAllowlist(path) {
  try {
    const content = await readFile(path, "utf-8");
    return new Set(
      content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    );
  } catch {
    return new Set();
  }
}

async function findHtmlFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findHtmlFiles(full)));
    } else if (entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

// Extract internal href values from <a> tags and src values from <script>/<img>
// tags. Skips <link rel=...> meta elements (favicons, stylesheets — not
// navigational content), external URLs, fragments, mailto/tel, data URIs.
function extractInternalLinks(html) {
  const links = [];

  // Skip <link> elements entirely (rel=icon, rel=stylesheet, rel=canonical, etc.)
  // They are meta / resource hints, not navigational links.
  let stripped = html.replace(/<link\s[^>]*>/gi, "");

  // Strip the styleguide code panel (`<aside id="sg-code-panel">…</aside>`,
  // pages/components/[slug].tsx) before scanning. It SSRs a story's verbatim
  // JSX source into a plain `<pre><code>` fallback (see
  // src/features/styleguide/code-panel/source-editor.tsx) whose quote
  // characters are not escaped by Preact's text-node serialization — so a
  // fictional `href="…"` shown as displayed source text matches the same
  // href regex as a real `<a href>` (#174, #192). zfb serializes some
  // attributes unquoted (`id=sg-code-panel`), so tolerate that, and match
  // `id` in any attribute position while requiring the exact id value (no
  // prefix matches, e.g. not `id=sg-code-panel-something`). Assumes code
  // panels are not nested inside one another.
  stripped = stripped.replace(
    /<aside[^>]*\bid=["']?sg-code-panel["']?(?=[\s>])[^>]*>[\s\S]*?<\/aside>/gi,
    ""
  );

  // Match href="..." from <a> tags and src="..." from <script>/<img>
  const reA = /href="([^"]+)"/g;
  const reSrc = /<(?:script|img)\s[^>]*src="([^"]+)"/g;

  for (const re of [reA, reSrc]) {
    let m;
    while ((m = re.exec(stripped)) !== null) {
      const href = m[1];
      // Skip external, mailto, tel, data, fragments, and dynamic values.
      // (apps/demo's contact section links a "tel:" phone number.)
      if (
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("data:") ||
        href.startsWith("#") ||
        href.includes("{{") ||
        href === ""
      ) {
        continue;
      }
      links.push(href);
    }
  }
  return links;
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveDistPath(href) {
  // Strip query string and fragment
  const clean = href.split("?")[0].split("#")[0];
  if (!clean) return null;

  // Absolute path from dist root
  const candidate = join(DIST_DIR, clean);

  // If it ends with / or has no extension, look for index.html
  if (clean.endsWith("/") || !clean.split("/").pop()?.includes(".")) {
    const indexPath = join(candidate, "index.html");
    if (await pathExists(indexPath)) return indexPath;
    // Also try direct match (e.g. /sitemap.xml)
    if (await pathExists(candidate)) return candidate;
    return null;
  }

  if (await pathExists(candidate)) return candidate;
  return null;
}

async function main() {
  const relDist = relative(ROOT_DIR, DIST_DIR);

  // Check the target dist dir exists
  if (!(await pathExists(DIST_DIR))) {
    console.error(`❌ ${relDist}/ not found — run the build first.`);
    process.exit(1);
  }

  const allowlist = await loadAllowlist(allowlistPath);
  const htmlFiles = await findHtmlFiles(DIST_DIR);
  console.log(`Checking ${htmlFiles.length} HTML files in ${relDist}/...`);

  const broken = [];

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf-8");
    const links = extractInternalLinks(html);
    const relFile = relative(ROOT_DIR, htmlFile);

    for (const href of links) {
      // Skip __zfb/ assets (hashed, always present if build succeeded)
      if (href.startsWith("/__zfb/")) continue;
      // Skip pagefind assets
      if (href.includes("pagefind")) continue;

      const resolved = await resolveDistPath(href);
      if (!resolved) {
        const key = `${relFile}:${href}`;
        if (!allowlist.has(key)) {
          broken.push({ file: relFile, href });
        }
      }
    }
  }

  if (broken.length === 0) {
    console.log("✅ No broken internal links found.");
    process.exit(0);
  } else {
    console.error(`\n❌ ${broken.length} broken internal link(s) found:\n`);
    for (const { file, href } of broken) {
      console.error(`  ${file}: ${href}`);
    }
    console.error(
      "\nAdd entries to .check-links-allowlist to suppress known exceptions."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
