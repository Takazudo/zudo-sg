import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const demoRoot = resolve(process.cwd(), "apps/demo");
const japaneseScript = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const mdxImage = /!\[([^\]]*)\]\(([^)]*)\)/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const file = resolve(directory, entry);
    if (statSync(file).isDirectory()) {
      return ["node_modules", "dist", ".zfb"].includes(entry) ? [] : sourceFiles(file);
    }
    return [file];
  });
}

describe("demo English-copy coverage", () => {
  const sources = sourceFiles(demoRoot).filter((file) => /\.(?:md|mdx|ts|tsx)$/.test(file));

  it("contains no Japanese script in scoped demo source", () => {
    const findings = sources.flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return japaneseScript.test(content) ? [relative(process.cwd(), file)] : [];
    });

    expect(findings).toEqual([]);
  });

  it("uses concise, descriptive English alt text for MDX images", () => {
    const findings: string[] = [];

    for (const file of sources.filter((candidate) => /\.(?:md|mdx)$/.test(candidate))) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(mdxImage)) {
        const alt = match[1].trim();
        if (!/[A-Za-z]/.test(alt) || /^(?:image|photo|picture|graphic|illustration)$/i.test(alt)) {
          findings.push(`${relative(process.cwd(), file)}: ${match[2]}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });
});
