import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import {
  AFTER_SWAP_EVENT,
  ATTR_CODE_PANEL_HIDDEN,
  ATTR_CODE_PANEL_RESIZER,
  CSS_VAR_CODE_PANEL_W,
  ID_CODE_PANEL,
  LS_CODE_PANEL_HIDDEN,
  LS_CODE_PANEL_WIDTH,
  MIN_CODE_PANEL_W,
} from "../panel-contract";
import { RESIZER_SCRIPT, RESTORE_SCRIPT } from "../panel-scripts-source";

// panel-scripts-source.ts interpolates panel-contract.ts's constants into two
// inline <script> strings — an inline <script> can't `import` the module at
// runtime, so this is the one legitimate place the literals get re-embedded.
// These tests assert every constant actually landed in the generated script
// text, so a future edit that reverts to a hand-typed literal (or a template
// typo) fails here instead of silently drifting from panel-contract.ts (#105).

describe("RESTORE_SCRIPT", () => {
  it("embeds the code-panel width/hidden constants from panel-contract.ts", () => {
    expect(RESTORE_SCRIPT).toContain(`'${LS_CODE_PANEL_WIDTH}'`);
    expect(RESTORE_SCRIPT).toContain(`'${CSS_VAR_CODE_PANEL_W}'`);
    expect(RESTORE_SCRIPT).toContain(`'${LS_CODE_PANEL_HIDDEN}'`);
    expect(RESTORE_SCRIPT).toContain(`'${ATTR_CODE_PANEL_HIDDEN}'`);
  });
});

describe("RESIZER_SCRIPT", () => {
  it("embeds the code-panel resizer constants from panel-contract.ts", () => {
    expect(RESIZER_SCRIPT).toContain(`MIN_CP=${MIN_CODE_PANEL_W}`);
    expect(RESIZER_SCRIPT).toContain(`'${ID_CODE_PANEL}'`);
    expect(RESIZER_SCRIPT).toContain(`'${CSS_VAR_CODE_PANEL_W}'`);
    expect(RESIZER_SCRIPT).toContain(`'${LS_CODE_PANEL_WIDTH}'`);
    expect(RESIZER_SCRIPT).toContain(`[${ATTR_CODE_PANEL_RESIZER}]`);
  });

  it("embeds the SPA swap channel the client router actually dispatches", () => {
    expect(AFTER_SWAP_EVENT).toBe(AFTER_NAVIGATE_EVENT);
    expect(RESIZER_SCRIPT).toContain(`'${AFTER_SWAP_EVENT}'`);
  });
});

// The script guarded the WHOLE body on `window.__sgResizersInstalled` and never
// listened for a page swap, so navigating detail -> detail left the freshly
// swapped-in handle inert: the flag was already true, init() never ran again,
// and dragging did nothing until a full reload. These run the real script text.
describe("RESIZER_SCRIPT SPA lifecycle", () => {
  function runScript(): void {
    new Function(RESIZER_SCRIPT)();
  }

  function addHandle(): HTMLElement {
    const handle = document.createElement("div");
    handle.setAttribute(ATTR_CODE_PANEL_RESIZER, "");
    document.body.append(handle);
    return handle;
  }

  /** attach() stamps the a11y range onto every handle it wires. */
  function isWired(handle: HTMLElement): boolean {
    return handle.hasAttribute("aria-valuenow");
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as unknown as { __sgResizersInstalled?: boolean })
      .__sgResizersInstalled;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete (window as unknown as { __sgResizersInstalled?: boolean })
      .__sgResizersInstalled;
  });

  it("wires the handle present at first run", () => {
    const handle = addHandle();
    runScript();
    expect(isWired(handle)).toBe(true);
  });

  it("wires the replacement handle a client-router swap installs", () => {
    addHandle();
    runScript();

    // The swap replaces the body: the old handle is gone, a new one arrives.
    document.body.innerHTML = "";
    const swapped = addHandle();
    document.dispatchEvent(new Event(AFTER_SWAP_EVENT));

    expect(isWired(swapped)).toBe(true);
  });

  it("never wires the same handle twice", () => {
    addHandle();
    runScript();
    document.body.innerHTML = "";
    const swapped = addHandle();
    // A swap can BOTH re-execute this body-end script and fire the listener
    // the first run registered.
    runScript();
    document.dispatchEvent(new Event(AFTER_SWAP_EVENT));
    expect(isWired(swapped)).toBe(true);

    // attach() stamps aria-valuenow from the measured width, so overwriting it
    // and re-firing the swap detects a second attach — which would also stack
    // a duplicate set of drag listeners on this element.
    swapped.setAttribute("aria-valuenow", "sentinel");
    document.dispatchEvent(new Event(AFTER_SWAP_EVENT));
    expect(swapped.getAttribute("aria-valuenow")).toBe("sentinel");
  });
});
