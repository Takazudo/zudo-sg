/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { Story, StoryMeta } from "@takazudo/zudo-sg/stories";

const meta: StoryMeta = {
  title: "Preview",
  category: "Route probes",
  description: "Proves that a story titled Preview stays distinct from the iframe route.",
  usage: "Packed route verifier probe.",
};
export default meta;

export const Default: Story = {
  name: "Default",
  render: () => <div data-packed-story-identity="packed-preview-default">Preview route probe</div>,
};
