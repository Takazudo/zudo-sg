import { describe, expect, it } from "vitest";
import {
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
});
