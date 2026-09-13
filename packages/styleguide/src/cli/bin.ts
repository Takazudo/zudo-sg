// `zudo-sg` CLI dispatcher — `bin/zudo-sg.js` (the package's `bin` entry)
// imports and calls `runZudoSgCli`. Commands (ADR docs/adr/styleguide-engine.md
// decision 10): `gen-registry [--check]`, `new-component <name> --category
// <c> [--nested] [--skip-barrel]`, `gen-token-manifest [--check]`.

import { loadZudoSgConfig } from "./config.js";
import { SgRegistryDriftError, runGenRegistry } from "./registry/gen-registry.js";
import { parseArgs, runNewComponent } from "./scaffold/new-component.js";
import { runGenTokenManifest, TokenManifestDriftError, TokensConfigMissingError } from "./token-manifest/gen-token-manifest.js";

const USAGE = `Usage: zudo-sg <command> [options]

Commands:
  gen-registry [--check]
  new-component <name> --category <c> [--nested] [--skip-barrel]
  gen-token-manifest [--check]
`;

export async function runZudoSgCli(argv: string[], projectRoot: string = process.cwd()): Promise<number> {
  const [command, ...rest] = argv;

  if (!command) {
    console.error(USAGE);
    return 1;
  }

  switch (command) {
    case "gen-registry": {
      const check = rest.includes("--check");
      const config = await loadZudoSgConfig(projectRoot);
      try {
        const result = runGenRegistry(projectRoot, config, { check });
        if (check) {
          console.log(`OK — sg-registry is up to date (${result.entryCount} stories).`);
        } else if (result.changed.length === 0) {
          console.log(`sg-registry already up to date (${result.entryCount} stories); no change.`);
        } else {
          for (const path of result.changed) console.log(`Wrote generated block to ${path}.`);
        }
        return 0;
      } catch (err) {
        if (err instanceof SgRegistryDriftError) {
          console.error(err.message);
          return 1;
        }
        throw err;
      }
    }

    case "new-component": {
      const config = await loadZudoSgConfig(projectRoot);
      return runNewComponent(projectRoot, config, parseArgs(rest));
    }

    case "gen-token-manifest": {
      const check = rest.includes("--check");
      const config = await loadZudoSgConfig(projectRoot);
      try {
        const result = runGenTokenManifest(projectRoot, config, { check });
        if (check) {
          console.log(`OK — token manifest is up to date (${result.tokenCount} entries).`);
        } else if (!result.changed) {
          console.log(`Token manifest already up to date (${result.tokenCount} entries); no change.`);
        } else {
          console.log(`Wrote ${result.manifestOut} (${result.tokenCount} entries).`);
        }
        return 0;
      } catch (err) {
        if (err instanceof TokenManifestDriftError || err instanceof TokensConfigMissingError) {
          console.error(err.message);
          return 1;
        }
        throw err;
      }
    }

    default:
      console.error(`zudo-sg: unknown command "${command}"\n\n${USAGE}`);
      return 1;
  }
}
