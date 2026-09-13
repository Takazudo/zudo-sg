// Orchestration for `zudo-sg gen-token-manifest [--check]` — reads
// `config.tokens.cssFiles` (`[tokensCssPath, colorsCssPath]`, both
// project-root-relative), builds the manifest, and writes/verifies
// `config.tokens.manifestOut`. Ported from the host's former
// `scripts/gen-token-manifest.mjs`.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ZudoSgConfig } from "../config.js";
import { buildUiTokenManifest, renderUiTokenManifestFile } from "./ui-token-manifest.js";

export interface GenTokenManifestResult {
  tokenCount: number;
  changed: boolean;
  manifestOut: string;
}

export interface GenTokenManifestOptions {
  check?: boolean;
}

export class TokenManifestDriftError extends Error {
  constructor(manifestOut: string) {
    super(
      `Token manifest drift detected: ${manifestOut} is out of date.\n` +
        "Run `pnpm gen:token-manifest` and commit the result.",
    );
    this.name = "TokenManifestDriftError";
  }
}

export class TokensConfigMissingError extends Error {
  constructor() {
    super(
      "[zudo-sg] gen-token-manifest needs a `tokens` entry in zudo-sg.config.mjs " +
        "(`tokens: { cssFiles: [tokensCssPath, colorsCssPath], manifestOut }`).",
    );
    this.name = "TokensConfigMissingError";
  }
}

export function runGenTokenManifest(
  projectRoot: string,
  config: ZudoSgConfig,
  options: GenTokenManifestOptions = {},
): GenTokenManifestResult {
  const { tokens } = config;
  if (!tokens) throw new TokensConfigMissingError();
  const [tokensCssPath, colorsCssPath] = tokens.cssFiles;
  const tokensCss = readFileSync(resolve(projectRoot, tokensCssPath), "utf8");
  const colorsCss = readFileSync(resolve(projectRoot, colorsCssPath), "utf8");
  const manifest = buildUiTokenManifest({ tokensCss, colorsCss });
  const next = renderUiTokenManifestFile(manifest);

  const tokenCount =
    manifest.paletteColors.length +
    manifest.colorTokens.length +
    manifest.spacingTokens.length +
    manifest.fontTokens.length +
    manifest.sizeTokens.length;

  const manifestPath = resolve(projectRoot, tokens.manifestOut);
  let current: string | null;
  try {
    current = readFileSync(manifestPath, "utf8");
  } catch {
    current = null;
  }

  if (options.check) {
    if (current !== next) throw new TokenManifestDriftError(tokens.manifestOut);
    return { tokenCount, changed: false, manifestOut: tokens.manifestOut };
  }

  if (current === next) return { tokenCount, changed: false, manifestOut: tokens.manifestOut };
  writeFileSync(manifestPath, next);
  return { tokenCount, changed: true, manifestOut: tokens.manifestOut };
}
