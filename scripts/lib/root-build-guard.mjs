/**
 * The one zfb diagnostic that must turn an otherwise successful root build
 * into a failure. Keep this deliberately narrow: other build warnings are
 * valid output and must not affect the exit status.
 */
export const IMAGE_DIMENSIONS_CANNOT_STAT = "imageDimensions: cannot stat";

function textForChunk(chunk) {
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString("utf8");
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  return String(chunk);
}

/**
 * Create a streaming classifier for root-build output.
 *
 * Retaining only the diagnostic-length suffix keeps the guard cheap while
 * still recognizing a diagnostic split at any chunk boundary. Callers that
 * read multiple streams should use one classifier per stream: independent
 * OS streams do not form a reliable ordered text stream.
 */
export function createRootBuildOutputGuard(
  diagnostic = IMAGE_DIMENSIONS_CANNOT_STAT,
) {
  if (typeof diagnostic !== "string" || diagnostic.length === 0) {
    throw new Error("diagnostic must be a non-empty string.");
  }

  let matched = false;
  let suffix = "";
  const suffixLength = diagnostic.length - 1;

  return {
    feed(chunk) {
      if (matched) return true;

      const text = textForChunk(chunk);
      const combined = suffix + text;
      matched = combined.includes(diagnostic);
      suffix =
        matched || suffixLength === 0 ? "" : combined.slice(-suffixLength);
      return matched;
    },
    get matched() {
      return matched;
    },
  };
}

/**
 * Map a completed child result to the exit code the launcher should expose.
 * A child failure remains its original failure; the warning guard only turns
 * a successful child exit into status 1. Signals are returned as `null` so
 * the launcher can re-emit the same signal from its own process.
 */
export function rootBuildExitCode({ code, signal, diagnosticFound, error } = {}) {
  if (signal) return null;
  if (error) return 1;

  const childCode = Number.isInteger(code) ? code : 1;
  return childCode === 0 && diagnosticFound ? 1 : childCode;
}
