import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
import { Container, type ContainerProps } from "./container";

const meta: StoryMeta = {
  title: "Container",
  category: "Layout",
  description:
    "Centers page content in a single ~88rem-wide column, with fluid inline padding that expands on wider viewports.",
  usage: `import { Container } from "@zudo-sg/ui/src/shared/container/container";

<Container>
  <p>Page content…</p>
</Container>`,
  composer: defineComposer<ContainerProps>({
    componentId: "ui.container",
    version: 1,
    component: Container,
    source: {
      module: "@zudo-sg/ui/src/shared/container/container",
      exportKind: "named",
      exportName: "Container",
    },
    slots: [{ id: "content", prop: "children", label: "Content", cardinality: "many" }],
  }),
};

export default meta;

const Filler = ({ label }: { label: string }) => (
  <div class="rounded-md border border-border bg-surface px-hsp-lg py-vsp-md">
    <p class="text-caption text-muted">{label}</p>
    <p class="text-small text-fg">
      Sample Co. is a demo company. This band shows the container's maximum width — resize the
      browser to see the inline padding expand and contract fluidly (via clamp()).
    </p>
  </div>
);

export const Default: Story<ContainerProps> = {
  name: "Default (~88rem)",
  source: `<Container>
  <div>Page content…</div>
</Container>`,
  render: () => (
    <Container>
      <Filler label="Container (~88rem)" />
    </Container>
  ),
};
