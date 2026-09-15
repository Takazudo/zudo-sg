#!/usr/bin/env bash
set -euo pipefail

# Real-artifact gate for @takazudo/zudo-sg (#668, docs/adr/styleguide-engine.md
# decisions 11-12). Packs the engine tarball and proves it is the artifact a
# real consumer would install, without publishing to the npm registry:
#
#   1. asserts the tarball's file listing matches the `files` whitelist and
#      leaks none of the host-only paths (doc/, pages/, src/content, apps/,
#      packages/demo-ui, fixtures/), and includes LICENSE;
#   2. asserts every literal (non-wildcard) `exports` target resolves inside
#      the tarball;
#   3. runs the README pnpm add command with strict peers in an empty project,
#      then installs the tarball into a second scratch project exactly like an external
#      consumer would (`npm install <tarball>`);
#   4. imports the exports subpaths that are safe to import under plain
#      Node — @takazudo/zfb type-only imports erase at build time, so
#      config/registry/stories/plugins/* have no runtime peer dependency and
#      import cleanly. NOT imported here: `./chrome`, `./chrome/panel-contract`,
#      `./islands`, `./catalog`, `./preview`, `./token-tweak*`, `./search`,
#      `./code-panel`, `./token-dashboard` and the `./routes-src/*` sources —
#      these render Preact JSX or reach a zfb `Island` helper at module scope,
#      so importing them under plain Node without the `preact`/`@takazudo/zfb`
#      peers installed would fail for reasons that have nothing to do with the
#      packed artifact being correct. Their presence in the tarball is still
#      checked by step 2 above.
#   5. runs the `zudo-sg` CLI bin and asserts it responds.
#
# Run from the repo root. Called by publish-zudo-sg.yml before the publish
# step, and safe to run locally any time (bash scripts/check-pack.sh) — it
# never runs `npm publish` / `pnpm publish` and never mutates the registry.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$ROOT_DIR/packages/styleguide"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "==> Packing @takazudo/zudo-sg"
ARTIFACT_DIR="$WORK_DIR/artifacts"
mkdir -p "$ARTIFACT_DIR"
(cd "$ROOT_DIR" && corepack pnpm --filter @takazudo/zudo-sg pack --pack-destination "$ARTIFACT_DIR" >/dev/null)
TARBALL="$(find "$ARTIFACT_DIR" -maxdepth 1 -name '*.tgz' | head -1)"
if [ -z "$TARBALL" ]; then
  echo "check-pack: pnpm pack produced no tarball in $ARTIFACT_DIR" >&2
  exit 1
fi
echo "    -> $TARBALL"

echo "==> Checking tarball file listing against the files whitelist"
LISTING_FILE="$WORK_DIR/listing.txt"
tar -tzf "$TARBALL" | sed 's|^package/||' >"$LISTING_FILE"

# Package managers always include a package-root LICENSE, even outside files[].
ALLOWED_TOP_LEVEL="dist bin routes-src virtual-modules.d.ts styles.css CHANGELOG.md README.md LICENSE package.json"
FORBIDDEN_PREFIXES="doc/ pages/ src/content apps/ packages/demo-ui fixtures/"

while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  top="${rel%%/*}"
  allowed=0
  for candidate in $ALLOWED_TOP_LEVEL; do
    if [ "$top" = "$candidate" ]; then
      allowed=1
      break
    fi
  done
  if [ "$allowed" -ne 1 ]; then
    echo "check-pack: tarball entry '$rel' is outside the files whitelist ($ALLOWED_TOP_LEVEL)" >&2
    exit 1
  fi
  for forbidden in $FORBIDDEN_PREFIXES; do
    case "$rel" in
      "$forbidden"*)
        echo "check-pack: tarball entry '$rel' leaks a non-package path (matches '$forbidden')" >&2
        exit 1
        ;;
    esac
  done
done <"$LISTING_FILE"
ENTRY_COUNT="$(wc -l <"$LISTING_FILE" | tr -d ' ')"
echo "    -> OK, $ENTRY_COUNT entries, no forbidden paths"

echo "==> Checking the package license is packed"
if ! grep -Fxq 'LICENSE' "$LISTING_FILE"; then
  echo "check-pack: tarball is missing the package-root LICENSE" >&2
  exit 1
fi
echo "    -> LICENSE present"

echo "==> Checking every literal exports target is packed"
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('$PKG_DIR/package.json', 'utf8'));
const listing = new Set(
  readFileSync('$LISTING_FILE', 'utf8').split('\n').map((l) => l.trim()).filter(Boolean),
);
const errors = [];
function walk(subpath, node) {
  if (typeof node === 'string') {
    if (node.includes('*')) return; // wildcard subpath — directory presence already checked above
    const rel = node.replace(/^\.\//, '');
    if (!listing.has(rel)) errors.push(\`exports[\"\${subpath}\"] target \"\${node}\" is missing from the tarball\`);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) walk(subpath, value);
  }
}
for (const [subpath, target] of Object.entries(pkg.exports ?? {})) walk(subpath, target);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(\`    -> OK, every literal exports target resolves (\${Object.keys(pkg.exports ?? {}).length} exports entries checked)\`);
"

echo "==> Verifying the README install command and inherited prerequisites (strict peers)"
node "$ROOT_DIR/scripts/verify-styleguide-install.mjs" --readme-install-only --tarball "$TARBALL"

echo "==> Installing the tarball into a scratch project (isolated Node import smoke)"
SCRATCH_DIR="$WORK_DIR/scratch"
mkdir -p "$SCRATCH_DIR"
cat >"$SCRATCH_DIR/package.json" <<'EOF'
{
  "name": "zudo-sg-check-pack-scratch",
  "private": true,
  "type": "module"
}
EOF
# --legacy-peer-deps: the peers (@takazudo/zfb, @takazudo/zudo-doc, preact,
# @takazudo/zdtp) are erased type-only imports in every subpath this script
# imports (see the header comment) — installing them isn't needed to prove
# the artifact, so skip npm's peer auto-install instead of hitting the
# registry for packages this check does not exercise.
(cd "$SCRATCH_DIR" && npm install "$TARBALL" --no-audit --no-fund --no-save --legacy-peer-deps >/dev/null)
INSTALLED_DIR="$SCRATCH_DIR/node_modules/@takazudo/zudo-sg"
if [ ! -d "$INSTALLED_DIR" ]; then
  echo "check-pack: @takazudo/zudo-sg did not install into $SCRATCH_DIR/node_modules" >&2
  exit 1
fi
echo "    -> installed at $INSTALLED_DIR"

echo "==> Import smoke (Node-importable exports subpaths)"
(cd "$SCRATCH_DIR" && node --input-type=module -e "
const subpaths = [
  '@takazudo/zudo-sg/config',
  '@takazudo/zudo-sg/registry',
  '@takazudo/zudo-sg/stories',
  '@takazudo/zudo-sg/plugins/routes',
  '@takazudo/zudo-sg/plugins/preview-css',
  '@takazudo/zudo-sg/plugins/zdtp-apply-proxy',
];
for (const subpath of subpaths) {
  await import(subpath);
  console.log(\`    -> imported \${subpath}\`);
}
")

echo "==> Checking CSS subpaths are present on disk"
for rel in "styles.css" "dist/safelist.css"; do
  if [ ! -f "$INSTALLED_DIR/$rel" ]; then
    echo "check-pack: installed package is missing $rel" >&2
    exit 1
  fi
  echo "    -> $rel present"
done

echo "==> Running the zudo-sg CLI bin"
set +e
CLI_OUTPUT="$(cd "$SCRATCH_DIR" && node_modules/.bin/zudo-sg --help 2>&1)"
CLI_EXIT=$?
set -e
if ! echo "$CLI_OUTPUT" | grep -q "Usage: zudo-sg"; then
  echo "check-pack: zudo-sg --help did not print usage text (exit $CLI_EXIT):" >&2
  echo "$CLI_OUTPUT" >&2
  exit 1
fi
echo "    -> zudo-sg CLI resolved and responded (exit $CLI_EXIT, usage text present)"

echo ""
echo "check-pack: OK — @takazudo/zudo-sg packs, installs, and imports as a real consumer would."
