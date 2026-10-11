import { readFile } from "node:fs/promises";
import { validateExternalCatalogOutputs, validateExternalCatalogAssets } from "@takazudo/zudo-sg/registry/external-catalog-node";
const outputs = JSON.parse(await readFile("artifacts/catalog.json", "utf8"));
validateExternalCatalogOutputs(outputs);
validateExternalCatalogAssets({ manifest: outputs.manifest, projectRoot: process.cwd(), assetRoot: "public", captures: JSON.parse(await readFile("artifacts/captures.json", "utf8")) });
