// Proves the story-authoring contract resolves from the installed @zudo-sg/ui
// tarball alone — no @takazudo/zudo-sg engine installed (ADR
// docs/adr/styleguide-engine.md decision 3). The fixture's `typecheck` step
// fails if the provider ever imports the engine for these types.
import { defineStory } from "@zudo-sg/ui";
import type { Story, StoryMeta, StoryModule } from "@zudo-sg/ui";

interface DemoProps {
  tone: "info" | "warn";
  label: string;
}

export const meta: StoryMeta = {
  title: "Contract Demo",
  category: "Fixture",
  description: "Type-level proof of the provider story contract.",
  usage: "",
};

export const Playground: Story<DemoProps> = defineStory<DemoProps>({
  name: "Playground",
  render: (args) => `${args?.tone ?? "info"}:${args?.label ?? ""}`,
  controls: [
    { type: "select", prop: "tone", label: "Tone", options: ["info", "warn"], defaultValue: "info" },
    { type: "text", prop: "label", label: "Label", defaultValue: "Hello" },
  ],
});

export const storyModule: StoryModule = { default: meta, Playground: Playground as Story };
