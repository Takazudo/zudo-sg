#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function validateWindManifest(value, required = ["border-sg-border", "text-sg-muted", "bg-sg-surface-2"]) {
  if (value?.schemaVersion !== 1 || value?.producer !== "zudo-sg" || !Array.isArray(value?.candidates) || !value.candidates.length || value.candidates.some(c => typeof c !== "string")) throw new Error("invalid zudo-sg wind manifest schema/producer/candidates");
  for (const candidate of required) if (!value.candidates.includes(candidate)) throw new Error(`wind manifest missing ${candidate}`);
  return value;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateWindManifest(JSON.parse(readFileSync(resolve(import.meta.dirname, "../dist/wind.json"), "utf8")));
  console.log("check:package-wind-manifest OK");
}
