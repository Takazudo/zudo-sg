import { describe, expect, it } from "vitest";
import { STORY_CATEGORIES } from "../types";
import type { StoryMeta, Story } from "../types";
import { STORY_MODULES } from "./story-modules";

const entries = Object.entries(STORY_MODULES);

describe("story-authoring contract", () => {
  for (const [path, mod] of entries) {
    describe(path, () => {
      const meta = mod.default as StoryMeta | undefined;

      it("default-exports a valid StoryMeta", () => {
        expect(meta, "missing default meta export").toBeTruthy();
        expect(typeof meta?.title).toBe("string");
        expect(meta?.title.length).toBeGreaterThan(0);
        expect(STORY_CATEGORIES).toContain(meta?.category);
        expect(typeof meta?.description).toBe("string");
        expect(meta?.description.length).toBeGreaterThan(0);
        expect(typeof meta?.usage).toBe("string");
        expect(meta?.usage.length).toBeGreaterThan(0);
      });

      it("previewRoute, when present, is a real same-origin page path (STORIES.md §6)", () => {
        if (meta?.previewRoute === undefined) return;
        expect(typeof meta.previewRoute).toBe("string");
        expect(meta.previewRoute.length).toBeGreaterThan(0);
        expect(meta.previewRoute.startsWith("/")).toBe(true);
        expect(meta.previewRoute.startsWith("//")).toBe(false);
      });

      it("has at least one named Story export, each well-formed", () => {
        const stories = Object.entries(mod).filter(([name]) => name !== "default");
        expect(stories.length).toBeGreaterThan(0);
        for (const [name, value] of stories) {
          const story = value as Story;
          expect(typeof story.name, `${name}.name`).toBe("string");
          expect(typeof story.render, `${name}.render`).toBe("function");
          // render must be synchronous + produce a node (pure, no throw).
          const node = story.render();
          expect(node, `${name}.render() returned nullish`).toBeDefined();
        }
      });

      // A `composer` opt-in is OPTIONAL. When present, guard the invariants a
      // definition must satisfy at the package level (the host registry adds
      // cross-module + JSON-safety checks). No component opts in yet (#246), so
      // this is a forward-looking guard.
      it("composer opt-in, when present, is a well-formed definition", () => {
        const composer = meta?.composer;
        if (!composer) return;
        expect(typeof composer.componentId, "componentId").toBe("string");
        expect(composer.componentId.length).toBeGreaterThan(0);
        expect(Number.isInteger(composer.version), "version is an integer").toBe(true);
        expect(typeof composer.component, "component is a function").toBe("function");

        const slotIds = new Set<string>();
        const slotProps = new Set<string>();
        for (const slot of composer.slots ?? []) {
          expect(slotIds.has(slot.id), `duplicate slot id ${slot.id}`).toBe(false);
          slotIds.add(slot.id);
          slotProps.add(slot.prop);
        }
        // One prop cannot be both a scalar field and a structural slot.
        for (const field of composer.fields ?? []) {
          expect(slotProps.has(field.prop), `prop ${field.prop} is both field and slot`).toBe(
            false,
          );
        }
      });
    });
  }
});
