import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePortArg } from "./lib/playwright-e2e-server.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const port = parsePortArg(process.argv.slice(2), 4_702);

const child = spawn("pnpm", ["exec", "zfb", "dev", "--port", String(port)], {
  cwd: projectRoot,
  env: { ...process.env, ZFB_DEV_BOOT_LAZY: "1" },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (child.exitCode === null && !child.killed) child.kill(signal);
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
