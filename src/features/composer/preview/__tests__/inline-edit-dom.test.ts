import { describe, expect, it } from "vitest";
import { readEditableValue, readNormalizedEditableValue } from "../inline-edit-dom";

interface CapturedShape {
  readonly engine: "Chromium" | "Firefox";
  readonly mode: "plaintext-only" | "true";
  readonly probe: string;
  readonly seed: string;
  readonly html: string;
  readonly textContent: string;
  readonly expected: string;
}

/**
 * The 56 `{ engine, mode, probe }` rows captured by #444. Keep duplicated
 * shapes as separate labeled rows: the labels are evidence that every
 * reporter capture was checked, not an assertion that the engines differ.
 */
const CAPTURED_SHAPES: readonly CapturedShape[] = [
  // interior one; "" -> "a\nb"
  { engine: "Chromium", mode: "plaintext-only", probe: "interior one", seed: "", html: "a\nb", textContent: "a\nb", expected: "a\nb" },
  { engine: "Chromium", mode: "true", probe: "interior one", seed: "", html: "a<div>b</div>", textContent: "ab", expected: "a\nb" },
  { engine: "Firefox", mode: "plaintext-only", probe: "interior one", seed: "", html: "a\nb", textContent: "a\nb", expected: "a\nb" },
  { engine: "Firefox", mode: "true", probe: "interior one", seed: "", html: "<div>a</div><div>b</div>", textContent: "ab", expected: "a\nb" },

  // interior blank; "" -> "a\n\nb"
  { engine: "Chromium", mode: "plaintext-only", probe: "interior blank", seed: "", html: "a\n\nb", textContent: "a\n\nb", expected: "a\n\nb" },
  { engine: "Chromium", mode: "true", probe: "interior blank", seed: "", html: "a<div><br></div><div>b</div>", textContent: "ab", expected: "a\n\nb" },
  { engine: "Firefox", mode: "plaintext-only", probe: "interior blank", seed: "", html: "a\n\nb", textContent: "a\n\nb", expected: "a\n\nb" },
  { engine: "Firefox", mode: "true", probe: "interior blank", seed: "", html: "<div>a</div><div><br></div><div>b</div>", textContent: "ab", expected: "a\n\nb" },

  // trailing one; "" -> "a\n"
  { engine: "Chromium", mode: "plaintext-only", probe: "trailing one", seed: "", html: "a\n\n", textContent: "a\n\n", expected: "a\n" },
  { engine: "Chromium", mode: "true", probe: "trailing one", seed: "", html: "a<div><br></div>", textContent: "a", expected: "a\n" },
  { engine: "Firefox", mode: "plaintext-only", probe: "trailing one", seed: "", html: "a\n<br>", textContent: "a\n", expected: "a\n" },
  { engine: "Firefox", mode: "true", probe: "trailing one", seed: "", html: "<div>a</div><div><br></div>", textContent: "a", expected: "a\n" },

  // trailing two; "" -> "a\n\n"
  { engine: "Chromium", mode: "plaintext-only", probe: "trailing two", seed: "", html: "a\n\n\n", textContent: "a\n\n\n", expected: "a\n\n" },
  { engine: "Chromium", mode: "true", probe: "trailing two", seed: "", html: "a<div><br></div><div><br></div>", textContent: "a", expected: "a\n\n" },
  { engine: "Firefox", mode: "plaintext-only", probe: "trailing two", seed: "", html: "a\n\n<br>", textContent: "a\n\n", expected: "a\n\n" },
  { engine: "Firefox", mode: "true", probe: "trailing two", seed: "", html: "<div>a</div><div><br></div><div><br></div>", textContent: "a", expected: "a\n\n" },

  // exact paste; "" -> "p1\n\np2\n\np3"
  { engine: "Chromium", mode: "plaintext-only", probe: "exact paste", seed: "", html: "p1\n\np2\n\np3", textContent: "p1\n\np2\n\np3", expected: "p1\n\np2\n\np3" },
  { engine: "Chromium", mode: "true", probe: "exact paste", seed: "", html: "p1\n\np2\n\np3", textContent: "p1\n\np2\n\np3", expected: "p1\n\np2\n\np3" },
  { engine: "Firefox", mode: "plaintext-only", probe: "exact paste", seed: "", html: "p1\n\np2\n\np3", textContent: "p1\n\np2\n\np3", expected: "p1\n\np2\n\np3" },
  { engine: "Firefox", mode: "true", probe: "exact paste", seed: "", html: "p1\n\np2\n\np3", textContent: "p1\n\np2\n\np3", expected: "p1\n\np2\n\np3" },

  // clear; "clear me" -> ""
  { engine: "Chromium", mode: "plaintext-only", probe: "clear", seed: "clear me", html: "<br>", textContent: "", expected: "" },
  { engine: "Chromium", mode: "true", probe: "clear", seed: "clear me", html: "<br>", textContent: "", expected: "" },
  { engine: "Firefox", mode: "plaintext-only", probe: "clear", seed: "clear me", html: "<br>", textContent: "", expected: "" },
  { engine: "Firefox", mode: "true", probe: "clear", seed: "clear me", html: "<br>", textContent: "", expected: "" },

  // no-edit ""; exact
  { engine: "Chromium", mode: "plaintext-only", probe: "no-edit empty", seed: "", html: "", textContent: "", expected: "" },
  { engine: "Chromium", mode: "true", probe: "no-edit empty", seed: "", html: "", textContent: "", expected: "" },
  { engine: "Firefox", mode: "plaintext-only", probe: "no-edit empty", seed: "", html: "", textContent: "", expected: "" },
  { engine: "Firefox", mode: "true", probe: "no-edit empty", seed: "", html: "", textContent: "", expected: "" },

  // type/delete ""; exact
  { engine: "Chromium", mode: "plaintext-only", probe: "type/delete empty", seed: "", html: "<br>", textContent: "", expected: "" },
  { engine: "Chromium", mode: "true", probe: "type/delete empty", seed: "", html: "<br>", textContent: "", expected: "" },
  { engine: "Firefox", mode: "plaintext-only", probe: "type/delete empty", seed: "", html: "<br>", textContent: "", expected: "" },
  { engine: "Firefox", mode: "true", probe: "type/delete empty", seed: "", html: "<br>", textContent: "", expected: "" },

  // no-edit "a"; exact
  { engine: "Chromium", mode: "plaintext-only", probe: "no-edit a", seed: "a", html: "a", textContent: "a", expected: "a" },
  { engine: "Chromium", mode: "true", probe: "no-edit a", seed: "a", html: "a", textContent: "a", expected: "a" },
  { engine: "Firefox", mode: "plaintext-only", probe: "no-edit a", seed: "a", html: "a", textContent: "a", expected: "a" },
  { engine: "Firefox", mode: "true", probe: "no-edit a", seed: "a", html: "a", textContent: "a", expected: "a" },

  // type/delete "a"; exact
  { engine: "Chromium", mode: "plaintext-only", probe: "type/delete a", seed: "a", html: "a", textContent: "a", expected: "a" },
  { engine: "Chromium", mode: "true", probe: "type/delete a", seed: "a", html: "a", textContent: "a", expected: "a" },
  { engine: "Firefox", mode: "plaintext-only", probe: "type/delete a", seed: "a", html: "a", textContent: "a", expected: "a" },
  { engine: "Firefox", mode: "true", probe: "type/delete a", seed: "a", html: "a", textContent: "a", expected: "a" },

  // no-edit "a\n"; exact
  { engine: "Chromium", mode: "plaintext-only", probe: "no-edit a\\n", seed: "a\n", html: "a\n", textContent: "a\n", expected: "a\n" },
  { engine: "Chromium", mode: "true", probe: "no-edit a\\n", seed: "a\n", html: "a\n", textContent: "a\n", expected: "a\n" },
  { engine: "Firefox", mode: "plaintext-only", probe: "no-edit a\\n", seed: "a\n", html: "a\n", textContent: "a\n", expected: "a\n" },
  { engine: "Firefox", mode: "true", probe: "no-edit a\\n", seed: "a\n", html: "a\n", textContent: "a\n", expected: "a\n" },

  // type/delete "a\n"; exact
  { engine: "Chromium", mode: "plaintext-only", probe: "type/delete a\\n", seed: "a\n", html: "a\n", textContent: "a\n", expected: "a\n" },
  { engine: "Chromium", mode: "true", probe: "type/delete a\\n", seed: "a\n", html: "a\n", textContent: "a\n", expected: "a\n" },
  { engine: "Firefox", mode: "plaintext-only", probe: "type/delete a\\n", seed: "a\n", html: "a", textContent: "a", expected: "a\n" },
  { engine: "Firefox", mode: "true", probe: "type/delete a\\n", seed: "a\n", html: "a", textContent: "a", expected: "a\n" },

  // no-edit "a\n\n"; exact
  { engine: "Chromium", mode: "plaintext-only", probe: "no-edit a\\n\\n", seed: "a\n\n", html: "a\n\n", textContent: "a\n\n", expected: "a\n\n" },
  { engine: "Chromium", mode: "true", probe: "no-edit a\\n\\n", seed: "a\n\n", html: "a\n\n", textContent: "a\n\n", expected: "a\n\n" },
  { engine: "Firefox", mode: "plaintext-only", probe: "no-edit a\\n\\n", seed: "a\n\n", html: "a\n\n", textContent: "a\n\n", expected: "a\n\n" },
  { engine: "Firefox", mode: "true", probe: "no-edit a\\n\\n", seed: "a\n\n", html: "a\n\n", textContent: "a\n\n", expected: "a\n\n" },

  // type/delete "a\n\n"; exact, including Chromium plaintext's captured a\n<br> shape
  { engine: "Chromium", mode: "plaintext-only", probe: "type/delete a\\n\\n", seed: "a\n\n", html: "a\n<br>", textContent: "a\n", expected: "a\n\n" },
  { engine: "Chromium", mode: "true", probe: "type/delete a\\n\\n", seed: "a\n\n", html: "a\n\n", textContent: "a\n\n", expected: "a\n\n" },
  { engine: "Firefox", mode: "plaintext-only", probe: "type/delete a\\n\\n", seed: "a\n\n", html: "a\n\n", textContent: "a\n\n", expected: "a\n\n" },
  { engine: "Firefox", mode: "true", probe: "type/delete a\\n\\n", seed: "a\n\n", html: "a\n\n", textContent: "a\n\n", expected: "a\n\n" },
];

describe("inline-edit DOM value readers", () => {
  it.each(CAPTURED_SHAPES)("$engine/$mode — $probe", (shape) => {
    const el = document.createElement("div");
    el.innerHTML = shape.html;

    expect(el.textContent).toBe(shape.textContent);
    expect(readNormalizedEditableValue(el, true, shape.seed)).toBe(shape.expected);
  });

  it("keeps the raw walker separate from baseline normalization", () => {
    const el = document.createElement("div");
    el.innerHTML = "a<div><br></div>";

    expect(readEditableValue(el, true)).toBe("a\n\n");
    expect(readNormalizedEditableValue(el, true, "")).toBe("a\n");
  });

  it.each([
    ["seed quota", "a\n", "b\n", "b\n"],
    ["one extra terminal newline", "a\n", "a\n\n\n", "a\n\n"],
    ["known seed-minus-one ambiguity", "a\n", "a", "a\n"],
  ])("%s", (_label, seed, raw, expected) => {
    const el = document.createElement("div");
    el.textContent = raw;
    expect(readNormalizedEditableValue(el, true, seed)).toBe(expected);
  });

  it("keeps single-line CR/LF collapsing unchanged and skips multiline normalization", () => {
    const el = document.createElement("div");
    el.textContent = "a\r\n\r\nb";

    expect(readEditableValue(el, false)).toBe("a b");
    expect(readNormalizedEditableValue(el, false, "a\n")).toBe("a b");
  });
});
