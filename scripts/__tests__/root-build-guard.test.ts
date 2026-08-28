import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  createRootBuildOutputGuard,
  IMAGE_DIMENSIONS_CANNOT_STAT,
  rootBuildExitCode,
} from "../lib/root-build-guard.mjs";
import { forwardedSignals, main, rootBuildArgs, runRootBuild } from "../run-root-build.mjs";

function captureStream() {
  let value = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      value += chunk.toString();
      callback();
    },
  });
  return {
    stream,
    value: () => value,
  };
}

async function runNode(source: string) {
  const stdout = captureStream();
  const stderr = captureStream();
  const result = await runRootBuild({
    command: process.execPath,
    args: ["-e", source],
    stdout: stdout.stream,
    stderr: stderr.stream,
    env: { ...process.env },
  });
  return { result, stdout: stdout.value(), stderr: stderr.value() };
}

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  exitCode: number | null = null;
  signalCode: string | null = null;
  killed = false;
  killSignals: string[] = [];

  kill(signal: string) {
    this.killed = true;
    this.killSignals.push(signal);
    return true;
  }

  finish(code: number | null = 0, signal: string | null = null) {
    this.exitCode = signal === null ? code : null;
    this.signalCode = signal;
    this.stdout.end();
    this.stderr.end();
    setImmediate(() => this.emit("close", this.exitCode, signal));
  }
}

async function runFakeChild(
  events: Array<{ stream: "stdout" | "stderr"; chunk: string }>,
  code = 0,
  options: {
    signalSource?: EventEmitter;
  } = {},
) {
  const stdout = captureStream();
  const stderr = captureStream();
  const child = new FakeChild();
  const signalSource = options.signalSource ?? new EventEmitter();
  const pending = runRootBuild({
    spawnProcess: () => child,
    signalSource,
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  for (const event of events) child[event.stream].write(event.chunk);
  child.finish(code);

  const result = await pending;
  return { result, stdout: stdout.value(), stderr: stderr.value(), child, signalSource };
}

describe("createRootBuildOutputGuard", () => {
  it("passes clean output and unrelated warnings", () => {
    const guard = createRootBuildOutputGuard();

    guard.feed("siteUrl is not set\n");
    guard.feed(Buffer.from("another pre-existing warning\n"));

    expect(guard.matched).toBe(false);
  });

  it("finds the exact diagnostic across arbitrary chunks", () => {
    const guard = createRootBuildOutputGuard();
    const chunks = [
      { stream: "stdout", value: Buffer.from("imageDim") },
      { stream: "stdout", value: "ensions: cannot " },
      { stream: "stdout", value: Uint8Array.from(Buffer.from("stat\n")) },
    ];

    for (const chunk of chunks) guard.feed(chunk.value);

    expect(IMAGE_DIMENSIONS_CANNOT_STAT).toBe("imageDimensions: cannot stat");
    expect(guard.matched).toBe(true);
  });

  it("does not join fragments from independent streams", () => {
    const stdoutGuard = createRootBuildOutputGuard();
    const stderrGuard = createRootBuildOutputGuard();

    stdoutGuard.feed("imageDimensions: cannot ");
    stderrGuard.feed("stat\n");

    expect(stdoutGuard.matched).toBe(false);
    expect(stderrGuard.matched).toBe(false);
  });
});

describe("runRootBuild", () => {
  it("appends CLI flags after the real zfb build arguments", async () => {
    let spawnedArgs: string[] | undefined;
    const signalSource = new EventEmitter();
    const stdout = captureStream();
    const stderr = captureStream();
    const child = new FakeChild();
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      const pending = main(["--outdir", "custom-dist", "--strict-broken"], {
        signalSource,
        stdout: stdout.stream,
        stderr: stderr.stream,
        spawnProcess: (_command: string, args: string[]) => {
          spawnedArgs = args;
          return child;
        },
      });
      child.finish();
      await pending;
    } finally {
      process.exitCode = previousExitCode;
    }

    expect(spawnedArgs).toEqual([
      "exec",
      "zfb",
      "build",
      "--outdir",
      "custom-dist",
      "--strict-broken",
    ]);
    expect(rootBuildArgs()).toEqual(["exec", "zfb", "build"]);
  });

  it("keeps a stdout diagnostic split across unrelated stderr chunks", async () => {
    const { result, stdout, stderr } = await runFakeChild([
      { stream: "stdout", chunk: "imageDim" },
      { stream: "stderr", chunk: "siteUrl is not set\n" },
      { stream: "stdout", chunk: "ensions: cannot stat\n" },
    ]);

    expect(result.code).toBe(0);
    expect(result.diagnosticFound).toBe(true);
    expect(rootBuildExitCode(result)).toBe(1);
    expect(stdout).toBe("imageDimensions: cannot stat\n");
    expect(stderr).toBe("siteUrl is not set\n");
  });

  it("detects full and split diagnostics on stderr", async () => {
    for (const stderrChunks of [
      ["imageDimensions: cannot stat\n"],
      ["imageDimensions: cannot ", "stat\n"],
    ]) {
      const { result, stdout, stderr } = await runFakeChild(
        stderrChunks.map((chunk) => ({ stream: "stderr" as const, chunk })),
      );

      expect(result.code).toBe(0);
      expect(result.signal).toBe(null);
      expect(result.diagnosticFound).toBe(true);
      expect(rootBuildExitCode(result)).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toBe("imageDimensions: cannot stat\n");
    }
  });

  it("does not match fragments divided between stdout and stderr", async () => {
    const { result, stdout, stderr } = await runFakeChild([
      { stream: "stdout", chunk: "imageDimensions: cannot " },
      { stream: "stderr", chunk: "stat\n" },
    ]);

    expect(result.code).toBe(0);
    expect(result.diagnosticFound).toBe(false);
    expect(rootBuildExitCode(result)).toBe(0);
    expect(stdout).toBe("imageDimensions: cannot ");
    expect(stderr).toBe("stat\n");
  });

  it("preserves unrelated warnings and a successful child exit", async () => {
    const { result, stderr } = await runNode(
      `process.stderr.write("siteUrl is not set\\n");`,
    );

    expect(result.code).toBe(0);
    expect(result.diagnosticFound).toBe(false);
    expect(rootBuildExitCode(result)).toBe(0);
    expect(stderr).toBe("siteUrl is not set\n");
  });

  it("preserves a real child failure", async () => {
    const { result, stderr } = await runNode(
      `process.stderr.write("ordinary warning\\n"); process.exitCode = 17;`,
    );

    expect(result.code).toBe(17);
    expect(result.diagnosticFound).toBe(false);
    expect(rootBuildExitCode(result)).toBe(17);
    expect(stderr).toBe("ordinary warning\n");
  });

  it("forwards repeated signals while the child remains active", async () => {
    const signalSource = new EventEmitter();
    const stdout = captureStream();
    const stderr = captureStream();
    const child = new FakeChild();
    const pending = runRootBuild({
      spawnProcess: () => child,
      signalSource,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    signalSource.emit("SIGINT");
    signalSource.emit("SIGTERM");
    signalSource.emit("SIGINT");
    expect(child.killSignals).toEqual(["SIGINT", "SIGTERM", "SIGINT"]);

    child.finish();
    const result = await pending;
    expect(result.code).toBe(0);
  });

  it("maps a signaled close and cleans signal listeners", async () => {
    const signalSource = new EventEmitter();
    const stdout = captureStream();
    const stderr = captureStream();
    const child = new FakeChild();
    const pending = runRootBuild({
      spawnProcess: () => child,
      signalSource,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    signalSource.emit("SIGINT");
    expect(child.killSignals).toEqual(["SIGINT"]);
    child.finish(null, "SIGTERM");
    const result = await pending;
    expect(result.signal).toBe("SIGTERM");
    expect(rootBuildExitCode(result)).toBe(null);
    for (const signal of forwardedSignals()) {
      expect(signalSource.listenerCount(signal)).toBe(0);
    }
    signalSource.emit("SIGINT");
    expect(child.killSignals).toEqual(["SIGINT"]);
  });

  it("does not install SIGHUP forwarding on Windows", () => {
    expect(forwardedSignals("win32")).toEqual(["SIGINT", "SIGTERM"]);
    expect(forwardedSignals("darwin")).toEqual(["SIGINT", "SIGTERM", "SIGHUP"]);
  });
});
