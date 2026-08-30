#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeComposableComponents,
  renderComposableComponentReport,
} from "./lib/composable-component-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const unknown = process.argv.slice(2).filter((arg) => arg !== "--check");
if (unknown.length > 0) {
  console.error(`Unknown argument(s): ${unknown.join(", ")}`);
  process.exitCode = 2;
} else {
  const report = analyzeComposableComponents(root);
  process.stdout.write(renderComposableComponentReport(report));
  if (check && report.errors.length > 0) process.exitCode = 1;
}
