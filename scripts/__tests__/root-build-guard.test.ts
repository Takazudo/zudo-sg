import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  createRootBuildOutputGuard,
  IMAGE_DIMENSIONS_CANNOT_STAT,
  rootBuildExitCode,
} from "../lib/root-build-guard.mjs";
import { runRootBuild } from "../run-root-build.mjs";

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
  killed = false;

  kill() {
    this.killed = true;
    return true;
  }

  finish(code = 0) {
    this.exitCode = code;
    this.stdout.end();
    this.stderr.end();
    setImmediate(() => this.emit("close", code, null));
  }
}

async function runFakeChild(
  events: Array<{ stream: "stdout" | "stderr"; chunk: string }>,
  code = 0,
) {
  const stdout = captureStream();
  const stderr = captureStream();
  const child = new FakeChild();
  const pending = runRootBuild({
    spawnProcess: () => child,
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  for (const event of events) child[event.stream].write(event.chunk);
  child.finish(code);

  const result = await pending;
  return { result, stdout: stdout.value(), stderr: stderr.value() };
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
});
