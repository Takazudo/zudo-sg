import { execFile as execFileCallback } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const root = fileURLToPath(new URL("../", import.meta.url));
const packageRoot = path.join(root, "packages/ui");
const fixtureRoot = path.join(root, "fixtures/ui-provider-consumer");
const handoffPath = path.join(root, "ui-provider-handoff.json");
const repositoryUrl = "https://github.com/Takazudo/zudo-sg.git";
const uiName = "@zudo-sg/ui";
const contractName = "@zudo-composer/component-contract";
const args = process.argv.slice(2);
const forceExact = args.includes("--exact");
const forceLocal = args.includes("--local");
const outputArg = args.find((arg) => arg.startsWith("--output-dir="));

function fail(message) {
  throw new Error(`[ui provider install] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function run(command, commandArgs, cwd, { allowFailure = false } = {}) {
  try {
    const result = await execFile(command, commandArgs, {
      cwd,
      env: process.env,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { ...result, exitCode: 0 };
  } catch (error) {
    if (allowFailure) {
      return { stdout: error.stdout ?? "", stderr: error.stderr ?? "", exitCode: error.code ?? 1 };
    }
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n");
    fail(`${command} ${commandArgs.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
}

function assertNoLocalProtocols(content, label) {
  for (const protocol of ["workspace:", "file:", "link:", "path:"]) {
    assert(!content.includes(protocol), `${label} must not contain ${protocol}`);
  }
  assert(!content.includes("../") && !content.includes("..\\"), `${label} must not contain sibling paths`);
}

const handoff = JSON.parse(await readFile(handoffPath, "utf8"));
assert(handoff.packageName === uiName, "handoff package name changed");
assert(handoff.sourcePath === "packages/ui", "handoff source path changed");
assert(/^[0-9a-f]{40}$/u.test(handoff.sourceTree), "handoff sourceTree must be a full tree SHA");
assert(handoff.packageBranch === "package/ui-v1", "handoff package branch changed");
assert(/^[0-9a-f]{40}$/u.test(handoff.packageCommit), "handoff packageCommit must be a full SHA");
assert(handoff.rootGitSpec === `git+${repositoryUrl}#${handoff.packageCommit}`, "handoff UI Git spec mismatch");
assert(handoff.contract?.packageName === contractName, "handoff contract package mismatch");
assert(/^[0-9a-f]{40}$/u.test(handoff.contract.packageCommit), "contract commit must be a full SHA");
assert(
  handoff.contract.rootGitSpec ===
    `git+https://github.com/Takazudo/zudo-composer.git#${handoff.contract.packageCommit}`,
  "handoff contract Git spec mismatch",
);

const localTree = (await run("git", ["rev-parse", `HEAD:${handoff.sourcePath}`], root)).stdout.trim();
assert(localTree === handoff.sourceTree, `HEAD:${handoff.sourcePath} tree ${localTree} differs from handoff ${handoff.sourceTree}`);

async function remotePackageStatus() {
  const ref = `refs/heads/${handoff.packageBranch}`;
  const result = await run("git", ["ls-remote", "--exit-code", repositoryUrl, ref], root, { allowFailure: true });
  const row = result.stdout.split(/\r?\n/u).map((line) => line.trim().split(/\s+/u)).find((parts) => parts[1] === ref);
  if (!row) return { status: "unavailable", reason: `${ref} is not advertised` };
  if (row[0] !== handoff.packageCommit) return { status: "mismatch", reason: `${ref} points at ${row[0]}` };
  return { status: "reachable", reason: "" };
}

async function verifyRemoteTree() {
  const bare = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-ui-ref-"));
  try {
    await run("git", ["init", "--bare", "--quiet", bare], root);
    await run("git", ["fetch", "--no-tags", "--depth=1", repositoryUrl, handoff.packageCommit], bare);
    const tree = (await run("git", ["rev-parse", `${handoff.packageCommit}^{tree}`], bare)).stdout.trim();
    assert(tree === handoff.sourceTree, `remote package tree ${tree} differs from sourceTree ${handoff.sourceTree}`);
  } finally {
    await rm(bare, { recursive: true, force: true });
  }
}

function generatedComposition() {
  return `import { AutoGrid, Card, Container, CtaButton, ProseP } from "@zudo-sg/ui";

export function GeneratedComposition({ theme }: { theme: "light" | "dark" }) {
  return (
    <Container class="generated-container">
      <h2>Generated {theme} composition</h2>
      <AutoGrid min="13rem" gap="split" aria-label="Generated provider grid">
        <Card title="Container component"><ProseP>Real package JSX</ProseP></Card>
        <Card title="Leaf component"><CtaButton href="/proof">Provider action</CtaButton></Card>
      </AutoGrid>
    </Container>
  );
}
`;
}

async function writeConsumer(directory, uiSpec) {
  await cp(fixtureRoot, directory, { recursive: true });
  const manifest = {
    name: "zudo-sg-ui-provider-consumer",
    version: "0.0.0",
    private: true,
    type: "module",
    packageManager: "pnpm@11.5.2",
    scripts: { typecheck: "tsc --noEmit", build: "vite build", preview: "vite preview" },
    dependencies: {
      [contractName]: handoff.contract.rootGitSpec,
      [uiName]: uiSpec,
      preact: "^10.29.1",
    },
    devDependencies: {
      "@playwright/test": "^1.61.0",
      "@preact/preset-vite": "^2.10.6",
      "@tailwindcss/vite": "^4.2.0",
      "@types/node": "^22.0.0",
      tailwindcss: "^4.2.0",
      typescript: "^5.9.0",
      vite: "^7.0.0",
    },
  };
  await writeFile(path.join(directory, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    path.join(directory, "pnpm-workspace.yaml"),
    `packages: []\nallowBuilds:\n  '${contractName}': true\n  esbuild: true\n`,
  );
  await writeFile(path.join(directory, "src/generated-composition.tsx"), generatedComposition());
}

async function assertExactInputs(directory) {
  const packageJsonText = await readFile(path.join(directory, "package.json"), "utf8");
  const packageJson = JSON.parse(packageJsonText);
  const workspace = await readFile(path.join(directory, "pnpm-workspace.yaml"), "utf8");
  const lock = await readFile(path.join(directory, "pnpm-lock.yaml"), "utf8");
  assertNoLocalProtocols(packageJsonText, "exact consumer package.json");
  assertNoLocalProtocols(workspace, "exact consumer workspace");
  assertNoLocalProtocols(lock, "exact consumer lockfile");
  assert(packageJson.dependencies[uiName] === handoff.rootGitSpec, "consumer UI spec is not exact");
  assert(packageJson.dependencies[contractName] === handoff.contract.rootGitSpec, "consumer contract spec is not exact");
  const lockedShas = new Set(lock.match(/[0-9a-f]{40}/gu) ?? []);
  assert(lockedShas.has(handoff.packageCommit), "lockfile does not pin the exact UI SHA");
  assert(lockedShas.has(handoff.contract.packageCommit), "lockfile does not pin the exact contract SHA");
  assert(workspace.startsWith("packages: []\n"), "consumer workspace must stay empty");
  assert(workspace.includes(`'${contractName}': true`), "consumer must allow only the contract build");
}

async function prepareAndBuild(directory, uiSpec, exact) {
  await mkdir(directory, { recursive: true });
  await writeConsumer(directory, uiSpec);
  await run("corepack", ["pnpm", "install", "--lockfile-only"], directory);
  if (exact) await assertExactInputs(directory);
  await run("corepack", ["pnpm", "install", "--frozen-lockfile"], directory);
  await run("corepack", ["pnpm", "run", "typecheck"], directory);
  await run("corepack", ["pnpm", "run", "build"], directory);
  await run("corepack", ["pnpm", "exec", "playwright", "install", "chromium"], directory);
  await run("node", ["browser-proof.mjs"], directory);
  await writeFile(
    path.join(directory, "provider-proof.json"),
    `${JSON.stringify({ exact, uiSpec, sourceTree: handoff.sourceTree }, null, 2)}\n`,
  );
  console.log(`Consumer install/typecheck/build passed (${exact ? "exact Git" : "local package"}): ${directory}`);
}

async function localPackageSpec() {
  const artifacts = await mkdtemp(path.join(os.tmpdir(), "zudo-sg-ui-pack-"));
  await run("corepack", ["pnpm", "pack", "--pack-destination", artifacts], packageRoot);
  const files = (await readdir(artifacts)).filter((file) => file.endsWith(".tgz"));
  assert(files.length === 1, `expected one UI tarball, found ${files.length}`);
  return { spec: `file:${path.join(artifacts, files[0])}`, artifacts };
}

let consumer = outputArg
  ? path.resolve(outputArg.slice("--output-dir=".length))
  : await mkdtemp(path.join(os.tmpdir(), "zudo-sg-ui-consumer-"));
let artifacts;

try {
  const remote = await remotePackageStatus();
  if (remote.status === "mismatch") fail(`advertised package branch is stale: ${remote.reason}`);
  if (forceExact) assert(remote.status === "reachable", `advertised package branch unavailable: ${remote.reason}`);

  if (!forceLocal && remote.status === "reachable") {
    await verifyRemoteTree();
    await prepareAndBuild(consumer, handoff.rootGitSpec, true);
  } else {
    const local = await localPackageSpec();
    artifacts = local.artifacts;
    await prepareAndBuild(consumer, local.spec, false);
    if (remote.status !== "reachable") console.log(`Exact remote proof deferred: ${remote.reason}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (artifacts) await rm(artifacts, { recursive: true, force: true });
  if (!outputArg && process.exitCode) await rm(consumer, { recursive: true, force: true });
}
