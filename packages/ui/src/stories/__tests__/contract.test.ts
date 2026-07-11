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
    });
  }
});
