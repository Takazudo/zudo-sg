import { readFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { scaffold } from "../scaffold.js";

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

describe("scaffold", () => {
  it("copies recursively, renames _gitignore, and replaces the package name token", async () => {
    const root = await mkdtemp(join(tmpdir(), "create-zudo-sg-scaffold-"));
    temporaryDirectories.push(root);
    const targetDir = join(root, "starter");

    await scaffold({
      targetDir,
      projectName: "my-styleguide",
      templateDir: fixtureDir,
    });

    expect(await readdir(targetDir)).toEqual(
      expect.arrayContaining([".gitignore", "nested", "package.json"]),
    );
    await expect(readFile(join(targetDir, "_gitignore"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(targetDir, ".gitignore"), "utf8")).toContain(
      "node_modules",
    );
    expect(await readFile(join(targetDir, "nested/readme.txt"), "utf8")).toBe(
      "fixture content\n",
    );
    expect(JSON.parse(await readFile(join(targetDir, "package.json"), "utf8"))).toMatchObject({
      name: "my-styleguide",
    });
  });

  it("refuses a non-empty target directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "create-zudo-sg-nonempty-"));
    temporaryDirectories.push(root);
    const targetDir = join(root, "starter");
    await mkdir(targetDir);
    await writeFile(join(targetDir, "already-there.txt"), "keep me\n");

    await expect(
      scaffold({
        targetDir,
        projectName: "my-styleguide",
        templateDir: fixtureDir,
      }),
    ).rejects.toThrow(/not empty/);
  });
});
