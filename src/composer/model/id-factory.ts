// Injectable stable-ID factory for new Composition nodes.
//
// Commands never mint ids themselves — they receive an `IdFactory` so tests can
// inject a deterministic sequence and production can inject a collision-resistant
// one. Ids are opaque; the optional `hint` only makes generated ids readable.

/** Produces a fresh, unique node id on each call. `hint` is cosmetic only. */
export type IdFactory = (hint?: string) => string;

/** Lower-cases a hint into an id-safe fragment (letters, digits, dashes). */
function slugHint(hint: string | undefined): string {
  if (!hint) return "node";
  const slug = hint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "node";
}

/**
 * A deterministic, monotonically increasing factory — ideal for tests and for
 * the native sample generator. Ids look like `n-1`, `n-2`, … or, with a hint,
 * `heading-1`. The counter is closed over, so successive calls never collide.
 */
export function createSequentialIdFactory(prefix = "n"): IdFactory {
  let counter = 0;
  return (hint?: string) => {
    counter += 1;
    const base = hint ? slugHint(hint) : prefix;
    return `${base}-${counter}`;
  };
}

/**
 * A collision-resistant factory for production runtime use. Prefers
 * `crypto.randomUUID` when present, falling back to a timestamp+counter id in
 * environments without it. Downstream waves inject this into the controller.
 */
export function createUuidIdFactory(): IdFactory {
  let counter = 0;
  return (hint?: string) => {
    counter += 1;
    const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    const unique = cryptoObj?.randomUUID
      ? cryptoObj.randomUUID()
      : `${Date.now().toString(36)}-${counter.toString(36)}`;
    return hint ? `${slugHint(hint)}-${unique}` : unique;
  };
}
