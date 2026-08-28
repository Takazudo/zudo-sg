import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRootBuildOutputGuard,
  IMAGE_DIMENSIONS_CANNOT_STAT,
  rootBuildExitCode,
} from "./lib/root-build-guard.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const ROOT_BUILD_ARGS = ["exec", "zfb", "build"];
const FORWARDED_SIGNALS =
  process.platform === "win32" ? ["SIGINT", "SIGTERM"] : ["SIGINT", "SIGTERM", "SIGHUP"];

function pipeChildOutput(readable, writable, guard) {
  if (!readable) return;
  readable.on("data", (chunk) => {
    guard.feed(chunk);
    writable.write(chunk);
  });
}

/**
 * Run the real root zfb build and stream both child output streams unchanged.
 * Options are intentionally injectable so the process/exit behavior can be
 * tested without invoking the full site build.
 */
export function runRootBuild(options = {}) {
  const command = options.command ?? pnpmCommand;
  const args = options.args ?? ROOT_BUILD_ARGS;
  const cwd = options.cwd ?? projectRoot;
  const env = options.env ?? { ...process.env };
  const spawnProcess = options.spawnProcess ?? spawn;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const stdoutGuard = createRootBuildOutputGuard();
  const stderrGuard = createRootBuildOutputGuard();

  return new Promise((resolveResult) => {
    let child;
    try {
      child = spawnProcess(command, args, {
        cwd,
        env,
        stdio: ["inherit", "pipe", "pipe"],
      });
    } catch (error) {
      resolveResult({
        code: null,
        signal: null,
        error,
        diagnosticFound: stdoutGuard.matched || stderrGuard.matched,
      });
      return;
    }

    pipeChildOutput(child.stdout, stdout, stdoutGuard);
    pipeChildOutput(child.stderr, stderr, stderrGuard);

    const signalHandlers = new Map();
    for (const signal of FORWARDED_SIGNALS) {
      const handler = () => {
        if (child.exitCode === null && !child.killed) child.kill(signal);
      };
      signalHandlers.set(signal, handler);
      process.on(signal, handler);
    }

    let spawnError;
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (code, signal) => {
      for (const [forwardedSignal, handler] of signalHandlers) {
        process.off(forwardedSignal, handler);
      }
      resolveResult({
        code,
        signal,
        error: spawnError,
        diagnosticFound: stdoutGuard.matched || stderrGuard.matched,
      });
    });
  });
}

export { IMAGE_DIMENSIONS_CANNOT_STAT, rootBuildExitCode };

async function main() {
  const result = await runRootBuild();

  if (result.error) process.stderr.write(`${result.error.message}\n`);
  if (result.diagnosticFound && result.code === 0 && !result.signal) {
    stderrGuardFailure();
  }

  const exitCode = rootBuildExitCode(result);
  if (exitCode === null) {
    process.kill(process.pid, result.signal);
  } else {
    process.exitCode = exitCode;
  }
}

function stderrGuardFailure() {
  process.stderr.write(
    `Root build guard: output contains ${IMAGE_DIMENSIONS_CANNOT_STAT}; failing the build.\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
