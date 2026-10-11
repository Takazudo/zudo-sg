import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const manifestPath = fileURLToPath(new URL('./node_modules/wrangler/package.json', import.meta.url));
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch {
  console.error('Deployment tools are missing. Run: pnpm --dir tools/deploy install --frozen-lockfile');
  process.exit(1);
}
const binary = resolve(dirname(manifestPath), manifest.bin.wrangler);
// Config arguments stay repository-relative, including each site's ./dist assets.
const root = fileURLToPath(new URL('../../', import.meta.url));
const child = spawn(process.execPath, [binary, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  console.error(`Cannot start local Wrangler: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) {
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
  } else process.exitCode = code ?? 1;
});
