import { describe, expect, it } from "vitest";
import {
  ATTR_INSPECTOR_RESIZER,
  ATTR_TREE_RESIZER,
  CSS_VAR_INSPECTOR_W,
  CSS_VAR_TREE_W,
  LS_INSPECTOR_WIDTH,
  LS_TREE_WIDTH,
  MAX_RAIL_W,
  MIN_CANVAS_W,
  MIN_RAIL_W,
  RESIZER_TRACK_W,
  WIDTH_CHANGE_EVENT,
} from "../resizer-contract";
import { RESIZER_SCRIPT, RESTORE_SCRIPT } from "../resizer-scripts-source";

// Mirrors panel-scripts.test.ts's rationale: an inline <script> can't import
// resizer-contract.ts at runtime, so this asserts every constant actually
// landed in the generated script text rather than a re-typed literal.

describe("RESTORE_SCRIPT", () => {
  it("embeds the rail-width storage keys and CSS vars from resizer-contract.ts", () => {
    expect(RESTORE_SCRIPT).toContain(`'${LS_TREE_WIDTH}'`);
    expect(RESTORE_SCRIPT).toContain(`'${LS_INSPECTOR_WIDTH}'`);
    expect(RESTORE_SCRIPT).toContain(`'${CSS_VAR_TREE_W}'`);
    expect(RESTORE_SCRIPT).toContain(`'${CSS_VAR_INSPECTOR_W}'`);
  });

  it("embeds the joint-clamp constants", () => {
    expect(RESTORE_SCRIPT).toContain(`MIN=${MIN_RAIL_W}`);
    expect(RESTORE_SCRIPT).toContain(`MAX=${MAX_RAIL_W}`);
    expect(RESTORE_SCRIPT).toContain(`MIN_CANVAS=${MIN_CANVAS_W}`);
    expect(RESTORE_SCRIPT).toContain(`TRACK=${RESIZER_TRACK_W}`);
  });

  it("is wrapped in a try/catch so a storage exception cannot block first paint", () => {
    expect(RESTORE_SCRIPT).toContain("try {");
    expect(RESTORE_SCRIPT).toContain("catch(e) {}");
  });
});

describe("RESIZER_SCRIPT", () => {
  it("embeds the resizer data-attributes and CSS vars/storage keys for both rails", () => {
    expect(RESIZER_SCRIPT).toContain(`[${ATTR_TREE_RESIZER}]`);
    expect(RESIZER_SCRIPT).toContain(`[${ATTR_INSPECTOR_RESIZER}]`);
    expect(RESIZER_SCRIPT).toContain(`'${CSS_VAR_TREE_W}'`);
    expect(RESIZER_SCRIPT).toContain(`'${CSS_VAR_INSPECTOR_W}'`);
    expect(RESIZER_SCRIPT).toContain(`'${LS_TREE_WIDTH}'`);
    expect(RESIZER_SCRIPT).toContain(`'${LS_INSPECTOR_WIDTH}'`);
  });

  it("dispatches the shared width-change event so the Preact controller can mirror committed widths", () => {
    expect(RESIZER_SCRIPT).toContain(`'${WIDTH_CHANGE_EVENT}'`);
  });

  it("wires pointer capture and both Arrow keys plus Home/End", () => {
    expect(RESIZER_SCRIPT).toContain("setPointerCapture");
    expect(RESIZER_SCRIPT).toContain("ArrowLeft");
    expect(RESIZER_SCRIPT).toContain("ArrowRight");
    expect(RESIZER_SCRIPT).toContain("'Home'");
    expect(RESIZER_SCRIPT).toContain("'End'");
  });

  it("is idempotent per element (not via a one-shot global guard) so a late-hydrating island still wires", () => {
    // The old `__sgComposerResizersInstalled` global one-shot guard wired
    // nothing (the island had not mounted) yet blocked every retry. Idempotency
    // now lives on each element (`__sgWired`), and a MutationObserver retries
    // `init()` until both rails exist.
    expect(RESIZER_SCRIPT).not.toContain("__sgComposerResizersInstalled");
    expect(RESIZER_SCRIPT).toContain("__sgWired");
    expect(RESIZER_SCRIPT).toContain("MutationObserver");
  });

  it("dispatches the Preact-bridging width-change event only on commit (pointerup/keydown), not on every pointermove", () => {
    const applyBody = RESIZER_SCRIPT.slice(
      RESIZER_SCRIPT.indexOf("function apply(px)"),
      RESIZER_SCRIPT.indexOf("function commit()"),
    );
    expect(applyBody).not.toContain("dispatchChange(");
    const commitBody = RESIZER_SCRIPT.slice(
      RESIZER_SCRIPT.indexOf("function commit()"),
      RESIZER_SCRIPT.indexOf("handle.setAttribute('aria-valuemin'"),
    );
    expect(commitBody).toContain("dispatchChange(opts.rail, cached)");
    // Called from the keydown handler and from pointerup/cancel/lostcapture (onUp).
    expect(RESIZER_SCRIPT.match(/commit\(\);/g) ?? []).toHaveLength(2);
  });
});
