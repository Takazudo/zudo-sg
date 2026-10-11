import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const baselineDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(baselineDir, "../../..");
const sites = [
  { id: "root", dist: "dist" },
  { id: "demo", dist: "apps/demo/dist" },
  { id: "doc", dist: "doc/dist" },
];
const textExtensions = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".xml", ".txt"]);

async function textFiles(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await textFiles(path)));
    else if (textExtensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) paths.push(path);
  }
  return paths;
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function attributeValues(content, attribute) {
  const expression = new RegExp(
    `(?<![\\w-])${attribute}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "g",
  );
  return [...content.matchAll(expression)].map((match) => match[1] ?? match[2] ?? match[3]);
}

for (const site of sites) {
  const distDir = resolve(repoRoot, site.dist);
  const routesPath = join(distDir, "__zfb", "routes.json");
  const routeManifest = JSON.parse(await readFile(routesPath, "utf8"));
  const routes = routeManifest.routes;
  const htmlRoutes = routes.filter((route) => route.extension === "html");
  const routeLines = routes
    .map((route) => `${route.url}\t${route.output}\t${route.source}`)
    .sort((left, right) => left.localeCompare(right));
  const files = await textFiles(distDir);
  const contents = await Promise.all(files.map((path) => readFile(path, "utf8")));
  const markers = [];
  const classes = [];
  const persistNames = [];

  for (const content of contents) {
    markers.push(
      ...attributeValues(content, "data-zfb-island").map((value) => `data-zfb-island="${value}"`),
    );
    for (const value of attributeValues(content, "class")) {
      classes.push(...value.split(/\s+/).filter(Boolean));
    }
    persistNames.push(...attributeValues(content, "data-zfb-transition-persist"));
  }

  const islandBundles = [];
  for (const path of files) {
    const file = basename(path);
    if (/^islands-[a-z0-9]+\.js$/i.test(file)) {
      const fileStat = await stat(path);
      islandBundles.push(`${relative(distDir, path)}\t${fileStat.size} bytes`);
    }
  }

  const outputDir = join(baselineDir, "inventories");
  await writeFile(
    join(outputDir, `${site.id}-routes.txt`),
    `HTML routes: ${htmlRoutes.length}\nAll routes: ${routes.length}\n\n${routeLines.join("\n")}\n`,
  );
  await writeFile(
    join(outputDir, `${site.id}-islands.txt`),
    `${sortedUnique(markers).join("\n")}\n`,
  );
  await writeFile(
    join(outputDir, `${site.id}-islands-bundle.txt`),
    `${islandBundles.sort((left, right) => left.localeCompare(right)).join("\n")}\n`,
  );
  await writeFile(
    join(outputDir, `${site.id}-classes.txt`),
    `${sortedUnique(classes).join("\n")}\n`,
  );
  await writeFile(
    join(outputDir, `${site.id}-transition-persist.txt`),
    `${sortedUnique(persistNames).join("\n")}\n`,
  );

  console.log(`${site.id}: ${htmlRoutes.length} HTML / ${routes.length} total routes, ${files.length} text assets`);
}
