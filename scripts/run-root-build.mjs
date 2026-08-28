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
const ROOT_BUILD_ARGS = Object.freeze(["exec", "zfb", "build"]);

export function rootBuildArgs(cliArgs = []) {
  if (!Array.isArray(cliArgs)) throw new TypeError("cliArgs must be an array.");
  return [...ROOT_BUILD_ARGS, ...cliArgs];
}

export function forwardedSignals(platform = process.platform) {
  return platform === "win32" ? ["SIGINT", "SIGTERM"] : ["SIGINT", "SIGTERM", "SIGHUP"];
}

const FORWARDED_SIGNALS = forwardedSignals();

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
  const args = options.args ?? rootBuildArgs(options.cliArgs);
  const cwd = options.cwd ?? projectRoot;
  const env = options.env ?? { ...process.env };
  const spawnProcess = options.spawnProcess ?? spawn;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const signalSource = options.signalSource ?? process;
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
        const childIsActive =
          child.exitCode === null &&
          (child.signalCode === null || child.signalCode === undefined);
        if (childIsActive) child.kill(signal);
      };
      signalHandlers.set(signal, handler);
      signalSource.on(signal, handler);
    }

    let spawnError;
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (code, signal) => {
      for (const [forwardedSignal, handler] of signalHandlers) {
        signalSource.off(forwardedSignal, handler);
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

export async function main(cliArgs = process.argv.slice(2), options = {}) {
  const result = await runRootBuild({ ...options, cliArgs });

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
