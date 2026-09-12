import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ZfbBuildHookContext, ZfbSetupContext } from "@takazudo/zfb/plugins";
import plugin, { loadDocHistoryMeta } from "../../pages/lib/_doc-history-meta";

describe("doc-history metadata serialization", () => {
  let projectRoot: string;
  let buildContext: ZfbBuildHookContext;
  let setupContext: ZfbSetupContext;
  let outputPath: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "zudo-sg-doc-history-meta-"));
    buildContext = {
      projectRoot,
      outDir: join(projectRoot, "dist"),
      config: {},
      options: {},
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
    setupContext = {
      ...buildContext,
      command: "build",
      addAlias: vi.fn((_specifier: string, target: string) => {
        outputPath = resolve(projectRoot, target);
      }),
      addVirtualModule: vi.fn(),
      injectRoute: vi.fn(),
      addClientEntry: vi.fn(),
    };
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function writeMetadata(contents: string): void {
    const path = join(projectRoot, ".zfb/doc-history-meta.json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents, "utf8");
  }

  // Evaluate the emitted ESM in a fresh Node process, with no test-runner
  // transforms. This checks that arbitrary author strings remain data.
  function readGeneratedModule(): { metadata: unknown; executed: boolean } {
    return JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          'const { docHistoryMeta } = await import(process.argv[1]); process.stdout.write(JSON.stringify({ metadata: docHistoryMeta, executed: globalThis.__metadataExecuted === true }));',
          pathToFileURL(outputPath).href,
        ],
        { encoding: "utf8" },
      ),
    );
  }

  it("returns an empty map without creating files when metadata is absent", () => {
    expect(loadDocHistoryMeta(projectRoot)).toEqual({});
    expect(existsSync(join(projectRoot, ".zfb"))).toBe(false);
  });

  it("emits a usable empty module when preBuild has no metadata", () => {
    plugin.setup(setupContext);
    expect(existsSync(outputPath)).toBe(false);

    plugin.preBuild(buildContext);

    expect(readGeneratedModule()).toEqual({ metadata: {}, executed: false });
  });

  it("reads fresh metadata after setup and preserves code-like strings and slug keys", () => {
    writeMetadata(JSON.stringify({ old: { author: "Stale author" } }));
    plugin.setup(setupContext);

    const metadata = Object.fromEntries([
      [
        "overview/token-panels",
        {
          author: '\"; globalThis.__metadataExecuted = true; // </script>\u2028\u2029',
          createdDate: "2026-06-23T01:46:24+09:00",
          updatedDate: "2026-09-13T02:17:58+09:00",
          ext: ".mdx",
        },
      ],
      ["__proto__", { author: "Ordinary data key" }],
    ]);
    writeMetadata(JSON.stringify(metadata));
    plugin.preBuild(buildContext);

    expect(readGeneratedModule()).toEqual({ metadata, executed: false });
    expect(setupContext.addVirtualModule).not.toHaveBeenCalled();
  });

  it("fails visibly for malformed metadata rather than emitting an empty map", () => {
    writeMetadata("{");
    plugin.setup(setupContext);

    expect(() => plugin.preBuild(buildContext)).toThrow(SyntaxError);
    expect(existsSync(outputPath)).toBe(false);
  });
});
