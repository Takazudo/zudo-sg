import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const ui = path.join(root, "packages/ui");
const errors = [];

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(target));
    else output.push(target);
  }
  return output;
}

function reject(content, pattern, label, file) {
  if (pattern.test(content)) errors.push(`${path.relative(root, file)}: ${label}`);
}

const packageJsonPath = path.join(ui, "package.json");
const packageJsonText = await readFile(packageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonText);
for (const hook of ["prepare", "prepack", "install", "postinstall"]) {
  if (packageJson.scripts?.[hook]) errors.push(`packages/ui/package.json: lifecycle hook ${hook} is forbidden`);
}
for (const protocol of ["workspace:", "file:", "link:", "path:"]) {
  if (packageJsonText.includes(protocol)) {
    errors.push(`packages/ui/package.json: ${protocol} is forbidden`);
  }
}

const workspacePath = path.join(ui, "pnpm-workspace.yaml");
const workspace = await readFile(workspacePath, "utf8");
if (!workspace.startsWith("packages: []\n")) errors.push("packages/ui/pnpm-workspace.yaml: packages must be []");
if (!workspace.includes("'@zudo-composer/component-contract': true")) errors.push("packages/ui/pnpm-workspace.yaml: contract allowBuilds entry missing");
const allowedBuildNames = [...workspace.matchAll(/^\s{2}['"]?([^'":]+)['"]?:\s*true$/gmu)].map((match) => match[1]);
if (allowedBuildNames.some((name) => name !== "@zudo-composer/component-contract")) {
  errors.push("packages/ui/pnpm-workspace.yaml: only the name-only contract build may be allowed");
}

const scoped = (await filesUnder(path.join(ui, "src"))).filter((file) =>
  file.endsWith(".composer.tsx") || file.endsWith("composer-pack.ts"),
);
for (const file of scoped) {
  const content = await readFile(file, "utf8");
  reject(content, /StoryMeta|\.stories(?:\.|["'])|styleguide\/data|src\/features/u, "provider boundary imports story/app code", file);
  reject(content, /from\s+["'][^"']+\/src\//u, "public /src/* specifier is forbidden", file);
  reject(content, /["'](?:workspace|file|link|path):/u, "local dependency protocol is forbidden", file);
  reject(content, /["']\.\.\/\.\.\/\.\.\//u, "sibling/root path escape is forbidden", file);
}

for (const file of await filesUnder(path.join(root, "fixtures/ui-provider-consumer"))) {
  const content = await readFile(file, "utf8");
  reject(content, /@zudo-sg\/ui\/src\//u, "fixture public /src/* specifier is forbidden", file);
  reject(content, /["'](?:workspace|file|link|path):/u, "fixture local dependency protocol is forbidden", file);
  reject(content, /["']\.\.\//u, "fixture sibling path is forbidden", file);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`UI provider boundary passed (${scoped.length} generated/sidecar sources checked).`);
}
