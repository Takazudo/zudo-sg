import type { Child } from "@takazudo/zfb/zudo-react";
import type { Story, StoryMeta } from "@takazudo/zudo-sg/stories";

const meta: StoryMeta = {
  title: "Canvas",
  category: "Route probes",
  description: "Proves route-aware allocation for a custom preview endpoint.",
  usage: "Packed route verifier probe.",
};
export default meta;

export const Default: Story = {
  name: "Default",
  render: (): Child => <div data-packed-story-identity="packed-canvas-default">Canvas route probe</div>,
};
