import { describe, expect, it } from "vitest";
import { renderToString } from "preact-render-to-string";
import type { VNode } from "preact";
import type { Story } from "../types";
import { STORY_MODULES } from "./story-modules";

/**
 * Seeds a story's render() with its controls' defaultValue — the same args
 * the catalog injects before first paint (see types.ts → Story#controls) —
 * so the rendered HTML reflects what a reader actually sees rather than an
 * all-undefined-props fallback.
 */
function defaultArgs(story: Story): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const control of story.controls ?? []) {
    args[control.prop] = control.defaultValue;
  }
  return args;
}

// Guards against the `source` string (the code panel authors hand-write) and
// the actual `render()` output (what the preview shows) silently drifting
// apart. It cannot verify the two are equivalent — `source` is a plain
// string, not parsed — so instead it snapshots what `render()` produces for
// every variant that sets `source`. Editing a render body without updating
// its snapshot fails the test, which is the prompt to re-check `source`.
describe("story source vs. render drift", () => {
  for (const [path, mod] of Object.entries(STORY_MODULES)) {
    const stories = Object.entries(mod).filter(([name]) => name !== "default");

    for (const [exportName, value] of stories) {
      const story = value as Story;
      // Nothing to drift-check without an explicit `source` to compare against.
      if (!story.source) continue;

      it(`${path} → ${exportName} (${story.name})`, () => {
        // Every story's `render` produces an actual node — `ComponentChildren`
        // is wider than renderToString's `VNode` param only because it also
        // covers primitives/`undefined`, which no story here returns.
        const html = renderToString(story.render(defaultArgs(story)) as VNode);
        // Snapshot `source` alongside `html`: snapshotting html alone would
        // miss drift introduced by editing `source` without touching render.
        expect({ source: story.source, html }).toMatchSnapshot();
      });
    }
  }
});
