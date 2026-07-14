import { spawn } from "node:child_process";
const projectRoot = process.cwd();
const portIndex = process.argv.indexOf("--port");
const port = portIndex >= 0 ? process.argv[portIndex + 1] : "4702";

const child = spawn("pnpm", ["exec", "zfb", "dev", "--port", port], {
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
