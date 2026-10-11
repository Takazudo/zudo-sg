import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCandidateSetHash,
  getWindCompilerVersion,
  getWindConfigHash,
  scanDemoUiClasses,
} from "./authored-class-coverage";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixturePath = resolve(repoRoot, "packages/demo-ui/src/stories/__tests__/authored-class-coverage.wind-explain.json");
const scan = scanDemoUiClasses(repoRoot);
if (scan.dynamicConstructions.length > 0) {
  throw new Error(`Dynamic class construction found:\n${scan.dynamicConstructions.join("\n")}`);
}

const candidates = scan.classes.map(({ token }) => token);
const compilerVersion = getWindCompilerVersion(repoRoot);
// The command runs from repoRoot, so keep its recorded provenance checkout-independent.
const command = ["pnpm", "exec", "zfb", "wind", "explain", "--json", "--stdin", "--project-root", "."];
const result = spawnSync(command[0], command.slice(1), {
  cwd: repoRoot,
  encoding: "utf8",
  input: `${candidates.join("\n")}\n`,
  maxBuffer: 32 * 1024 * 1024,
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`zfb wind explain failed (${result.status ?? "signal"}):\n${result.stderr || result.stdout}`);
}

const jsonStart = result.stdout.indexOf("{");
if (jsonStart < 0) throw new Error(`zfb wind explain emitted no JSON:\n${result.stdout}`);
const windExplain = JSON.parse(result.stdout.slice(jsonStart)) as {
  schemaVersion: number;
  command: string;
  explanations: Array<{ candidate: string; outcome: string }>;
};
if (windExplain.schemaVersion !== 1 || windExplain.command !== "explain") {
  throw new Error(`Unexpected zfb wind explain document: ${JSON.stringify(windExplain).slice(0, 500)}`);
}
if (windExplain.explanations.length !== candidates.length) {
  throw new Error(`Expected ${candidates.length} wind explanations; received ${windExplain.explanations.length}`);
}

const fixture = {
  schemaVersion: 1,
  compilerVersion,
  windConfigSha256: getWindConfigHash(repoRoot, compilerVersion),
  candidateSetSha256: getCandidateSetHash(candidates),
  candidates,
  command,
  windExplain,
};
writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
process.stdout.write(`Wrote ${fixturePath}\n${candidates.length} classes explained by zfb ${compilerVersion}\n`);
