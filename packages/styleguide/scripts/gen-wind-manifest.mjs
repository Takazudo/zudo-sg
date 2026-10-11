#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function generateWindManifest({ projectRoot = resolve(import.meta.dirname, ".."), config = "scripts/wind-manifest.config.ts", output = "dist/wind.json", sources = ["dist/**/*.js", "routes-src/*.tsx"] } = {}) {
  const req = createRequire(resolve(projectRoot, "package.json"));
  const pkgPath = req.resolve("@takazudo/zfb/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const cli = resolve(dirname(pkgPath), typeof pkg.bin === "string" ? pkg.bin : pkg.bin.zfb);
  const args = [cli, "wind", "manifest", "--project-root", ".", "--config", config, "--producer", "zudo-sg", "--output", output];
  for (const source of sources) args.push("--source", source);
  args.push("--no-auto-source");
  const run = spawnSync(process.execPath, args, { cwd: projectRoot, encoding: "utf8" });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`zfb wind manifest failed: ${run.stdout} ${run.stderr}`);
  return JSON.parse(readFileSync(resolve(projectRoot, output), "utf8"));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generateWindManifest();
