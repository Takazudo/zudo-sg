import type { StoryMeta, Story } from "../stories/types";
import { Hero } from "./hero";
import { Button } from "../button/button";
import { Stat, StatGroup } from "../stat/stat";

const meta: StoryMeta = {
  title: "Hero",
  category: "Layout",
  description: "Landing-page hero with eyebrow, display title, lede, actions, and an optional media panel.",
  usage: `import { Hero, Button } from "@zudo-sg/ui";

<Hero
  title="Ship faster"
  lede="A tight, dark-correct component set."
  actions={<Button>Get started</Button>}
/>`,
  order: 2,
};

export default meta;

export const Playground: Story = {
  name: "Playground",
  source: `<Hero
  eyebrow="zudo-sg"
  title="A tight component system that scales"
  lede="Coherent spacing rhythm, consistent type, dark-mode correct."
  tinted={true}
/>`,
  controls: [
    {
      type: "text",
      prop: "eyebrow",
      label: "Eyebrow",
      defaultValue: "zudo-sg",
    },
    {
      type: "text",
      prop: "title",
      label: "Title",
      defaultValue: "A tight component system that scales",
    },
    {
      type: "text",
      prop: "lede",
      label: "Lede",
      defaultValue: "Coherent spacing rhythm, consistent type, dark-mode correct.",
    },
    {
      type: "boolean",
      prop: "tinted",
      label: "Tinted",
      defaultValue: true,
    },
  ],
  render: (args = {}) => (
    <Hero
      eyebrow={args.eyebrow as string}
      title={args.title as string}
      lede={args.lede as string}
      tinted={args.tinted as boolean}
    />
  ),
};

export const Basic: Story = {
  name: "Basic",
  source: `<Hero
  eyebrow="zudo-sg"
  title="A tight component system that scales"
  lede="Coherent spacing rhythm, consistent type, dark-mode correct…"
  actions={
    <>
      <Button href="/start">Get started</Button>
      <Button variant="secondary" href="/docs">Read the docs</Button>
    </>
  }
/>`,
  render: () => (
    <Hero
      eyebrow="zudo-sg"
      title="A tight component system that scales"
      lede="Coherent spacing rhythm, consistent type, dark-mode correct via the token system — drop in and build."
      actions={
        <>
          <Button href="/start">Get started</Button>
          <Button variant="secondary" href="/docs">
            Read the docs
          </Button>
        </>
      }
    />
  ),
};

export const WithMedia: Story = {
  name: "With media panel",
  source: `<Hero
  eyebrow="Platform"
  title="Everything you measure, in one view"
  lede="Track uptime, latency, and traffic across every environment…"
  actions={<Button href="/start">Start free</Button>}
  media={
    <div class="rounded-lg bg-surface p-hsp-xl shadow-card">
      <StatGroup>
        <Stat value="99.9%" label="Uptime" />
        <Stat value="42ms" label="p95 latency" />
        <Stat value="1.2M" label="Requests / day" />
        <Stat value="12k" label="Active users" />
      </StatGroup>
    </div>
  }
/>`,
  render: () => (
    <Hero
      eyebrow="Platform"
      title="Everything you measure, in one view"
      lede="Track uptime, latency, and traffic across every environment without leaving the dashboard."
      actions={<Button href="/start">Start free</Button>}
      media={
        <div class="rounded-lg bg-surface p-hsp-xl shadow-card">
          <StatGroup>
            <Stat value="99.9%" label="Uptime" />
            <Stat value="42ms" label="p95 latency" />
            <Stat value="1.2M" label="Requests / day" />
            <Stat value="12k" label="Active users" />
          </StatGroup>
        </div>
      }
    />
  ),
};

export const Plain: Story = {
  name: "Plain (untinted)",
  source: `<Hero
  tinted={false}
  title="Untinted hero"
  lede="The same layout on a plain surface background."
  actions={<Button href="/start">Get started</Button>}
/>`,
  render: () => (
    <Hero
      tinted={false}
      title="Untinted hero"
      lede="The same layout on a plain surface background."
      actions={<Button href="/start">Get started</Button>}
    />
  ),
};
