/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { Story, StoryMeta } from "@takazudo/zudo-sg/stories";

const meta: StoryMeta = {
  title: "Preview 2",
  category: "Route probes",
  description: "Proves deterministic allocation alongside the Preview story.",
  usage: "Packed route verifier probe.",
};
export default meta;

export const Default: Story = {
  name: "Default",
  render: () => <div data-packed-story-identity="packed-preview-two-default">Preview 2 route probe</div>,
};
