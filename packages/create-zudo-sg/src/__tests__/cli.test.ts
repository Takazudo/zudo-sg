import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatNextSteps,
  parseArgs,
  run,
  validateProjectName,
} from "../index.js";

const fixtureUrl = new URL("./fixtures/", import.meta.url);
const fixtureDir =
  fixtureUrl.protocol === "file:"
    ? fileURLToPath(fixtureUrl)
    : join(process.cwd(), "packages/create-zudo-sg/src/__tests__/fixtures");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("parseArgs", () => {
  it("parses the destination and supported flags", () => {
    expect(
      parseArgs(["my-styleguide", "--name", "custom-name", "--install", "--yes"]),
    ).toEqual({
      destination: "my-styleguide",
      name: "custom-name",
      install: true,
      yes: true,
    });
  });

  it("supports the explicit no-install spelling", () => {
    expect(parseArgs(["my-styleguide", "--no-install"])).toEqual({
      destination: "my-styleguide",
      install: false,
    });
  });

  it("rejects more than one project directory", () => {
    expect(() => parseArgs(["one", "two"])).toThrow(/at most one project directory/);
  });
});

describe("validateProjectName", () => {
  it.each(["styleguide", "styleguide-2", "@zudo/styleguide"]) (
    "accepts %s",
    (name) => expect(validateProjectName(name)).toBeNull(),
  );

  it.each(["Styleguide", "-styleguide", "style guide", "@scope", "node_modules"])(
    "rejects %s",
    (name) => expect(validateProjectName(name)).not.toBeNull(),
  );
});

describe("run", () => {
  it("scaffolds with no install by default and prints the exact next steps", async () => {
    const root = await mkdtemp(join(tmpdir(), "create-zudo-sg-cli-"));
    temporaryDirectories.push(root);
    const output: string[] = [];

    await run({
      argv: ["generated", "--yes"],
      cwd: root,
      output: (message) => output.push(message),
      templateDir: fixtureDir,
    });

    expect(output.at(-1)).toBe(formatNextSteps("generated"));
  });
});
