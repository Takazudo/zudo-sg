#!/usr/bin/env node
// Writes `dist/islands.d.ts` for the side-effect-only `@takazudo/zudo-sg/islands`
// subpath. `src/islands.ts` is excluded from tsconfig.build.json because its
// `../routes-src/_preview-app.tsx` import would pull route sources (outside
// `rootDir`, typed by zfb virtual modules) into the declaration pass. Runs in
// the tsup `onSuccess` chain.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "dist");
mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, "islands.d.ts"), "// Side-effect module: registers every engine island.\nexport {};\n");
console.log("[emit-islands-dts] dist/islands.d.ts OK");
