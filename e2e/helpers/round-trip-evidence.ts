// Failure evidence for the preview-token-panel Export/Load round-trip (#995 / #1001).
//
// The record lives outside the test's `try` so `finally` can freeze and attach
// whatever was observed, including when an assertion, a parse, or a read failed
// mid-way. Nothing here asserts or waits: observations are recorded by the
// spec's existing read-only polls, and finalization only serializes and
// attaches. Pure TypeScript with no Playwright runtime import, so the
// non-masking contract is also unit-tested (scripts/__tests__/round-trip-evidence.test.ts).

export type ReadError = { at: string; message: string };

/** Last successful value and the latest read error, kept separate. */
export type Observation<T> = {
  last?: T;
  lastAt?: string;
  reads: number;
  errors: number;
  lastError?: ReadError;
};

export type RoundTripRun = {
  title: string;
  project: string;
  testId: string;
  retry: number;
  repeatEachIndex: number;
  workerIndex: number;
  parallelIndex: number;
  ci: Record<string, string>;
};

export type RoundTripEvidence = {
  run: RoundTripRun;
  stage: string;
  stages: Array<{ stage: string; at: string }>;
  observations: Record<string, Observation<unknown>>;
  rawExport?: string;
  parsedExport?: unknown;
  exportParseError?: string;
  failureReads?: Record<string, unknown>;
};

export type RunInfo = {
  title: string;
  project: { name: string };
  testId: string;
  retry: number;
  repeatEachIndex: number;
  workerIndex: number;
  parallelIndex: number;
};

const CI_IDENTITY_KEYS = [
  "GITHUB_SHA",
  "GITHUB_REF",
  "GITHUB_RUN_ID",
  "GITHUB_RUN_ATTEMPT",
  "GITHUB_JOB",
];

const now = () => new Date().toISOString();

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export function createRoundTripEvidence(
  info: RunInfo,
  env: Record<string, string | undefined> = process.env,
): RoundTripEvidence {
  const ci: Record<string, string> = {};
  for (const key of CI_IDENTITY_KEYS) if (env[key]) ci[key] = env[key]!;
  const stage = "start";
  return {
    run: {
      title: info.title,
      project: info.project.name,
      testId: info.testId,
      retry: info.retry,
      repeatEachIndex: info.repeatEachIndex,
      workerIndex: info.workerIndex,
      parallelIndex: info.parallelIndex,
      ci,
    },
    stage,
    stages: [{ stage, at: now() }],
    observations: {},
  };
}

export function enterStage(evidence: RoundTripEvidence, stage: string): void {
  evidence.stage = stage;
  evidence.stages.push({ stage, at: now() });
}

export type ReadFailure = { readError: string };

/**
 * Run one read and record it under `slot`. A failed read is recorded without
 * discarding the previous successful value, and returned as a `ReadFailure`
 * so the surrounding poll keeps retrying instead of throwing.
 */
export async function observe<T>(
  evidence: RoundTripEvidence,
  slot: string,
  read: () => Promise<T>,
): Promise<T | ReadFailure> {
  const obs = (evidence.observations[slot] ??= { reads: 0, errors: 0 });
  obs.reads += 1;
  try {
    const value = await read();
    obs.last = value;
    obs.lastAt = now();
    return value;
  } catch (error) {
    obs.errors += 1;
    obs.lastError = { at: now(), message: errorMessage(error) };
    return { readError: obs.lastError.message };
  }
}

/** Store the export bytes before anything can assert on or parse them. */
export function recordExport(evidence: RoundTripEvidence, raw: string): void {
  evidence.rawExport = raw;
  try {
    evidence.parsedExport = JSON.parse(raw);
  } catch (error) {
    evidence.exportParseError = errorMessage(error);
  }
}

export type Attach = (name: string, body: string, contentType: string) => Promise<void>;
export type Annotate = (type: string, description: string) => void;

/** Cap for each failure-time read, so `finally` never adds a long wait. */
export const FAILURE_READ_TIMEOUT_MS = 2_000;

function withTimeout<T>(read: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`read timed out after ${ms}ms`)), ms);
  });
  return Promise.race([read(), timeout]).finally(() => clearTimeout(timer));
}

export type FinalizeOptions = {
  evidence: RoundTripEvidence;
  /** The test body's own error, if any. Never replaced by evidence failures. */
  primaryError?: unknown;
  diagnostics: string[];
  /** Short best-effort reads taken only when the body failed. */
  failureReads?: Record<string, () => Promise<unknown>>;
  attach: Attach;
  annotate: Annotate;
  log?: (message: string) => void;
};

/**
 * Freeze and attach the evidence. Every step is guarded: a failing read,
 * serialization, or attachment becomes an `evidence-error` annotation, and
 * this function never throws, so the caller's original error (or pass) stands.
 * Returns the evidence errors it recorded.
 */
export async function finalizeRoundTripEvidence(options: FinalizeOptions): Promise<string[]> {
  const { evidence, primaryError, diagnostics, attach, annotate } = options;
  const log = options.log ?? ((message: string) => console.error(message));
  const evidenceErrors: string[] = [];
  const fail = (step: string, error: unknown) => {
    const message = `${step}: ${errorMessage(error)}`;
    evidenceErrors.push(message);
    try {
      annotate("evidence-error", message);
    } catch {
      // Annotation is the last channel; the log line below still reports it.
    }
    try {
      log(`[round-trip evidence] ${message}`);
    } catch {
      // Nothing left to report through.
    }
  };

  if (primaryError !== undefined && options.failureReads) {
    const reads: Record<string, unknown> = {};
    for (const [name, read] of Object.entries(options.failureReads)) {
      try {
        reads[name] = await withTimeout(read, FAILURE_READ_TIMEOUT_MS);
      } catch (error) {
        reads[name] = { readError: errorMessage(error) };
      }
    }
    evidence.failureReads = reads;
  }

  let frozen: string | undefined;
  try {
    frozen = JSON.stringify(
      {
        ...evidence,
        outcome: primaryError === undefined ? "passed" : "failed",
        primaryError: primaryError === undefined ? undefined : errorMessage(primaryError),
        finalizedAt: now(),
      },
      null,
      2,
    );
  } catch (error) {
    fail("serialize round-trip-evidence", error);
  }

  const attachments: Array<[string, () => string | undefined, string]> = [
    ["round-trip-evidence", () => frozen, "application/json"],
    ["export-raw", () => evidence.rawExport, "text/plain"],
    ["round-trip-diagnostics", () => diagnostics.join("\n") || "(none)", "text/plain"],
  ];
  for (const [name, body, contentType] of attachments) {
    try {
      const value = body();
      if (value === undefined) continue;
      await attach(name, value, contentType);
    } catch (error) {
      fail(`attach ${name}`, error);
    }
  }
  return evidenceErrors;
}
