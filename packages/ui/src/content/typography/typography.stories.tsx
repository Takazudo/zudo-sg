/**
 * Typography — a combined showcase of the MDX general-element contract
 * (Prose* components in `content/prose-*`). Element appearance (color,
 * border, margin) is owned entirely by these components; inter-element flow
 * spacing (the vertical rhythm between siblings) is a separate concern owned
 * by the consumer's own content-flow stylesheet, so it is intentionally
 * absent here.
 */
import type { StoryMeta, Story } from "../../stories/types";
import { ProseH2 } from "../prose-h2/prose-h2";
import { ProseH3 } from "../prose-h3/prose-h3";
import { ProseH4 } from "../prose-h4/prose-h4";
import { ProseH5 } from "../prose-h5/prose-h5";
import { ProseH6 } from "../prose-h6/prose-h6";
import { ProseP } from "../prose-p/prose-p";
import { ProseA } from "../prose-a/prose-a";
import { ProseStrong } from "../prose-strong/prose-strong";
import { ProseEm } from "../prose-em/prose-em";
import { ProseUl } from "../prose-ul/prose-ul";
import { ProseOl } from "../prose-ol/prose-ol";
import { ProseLi } from "../prose-li/prose-li";
import { ProseBlockquote } from "../prose-blockquote/prose-blockquote";
import { ProseTable, ProseTh, ProseTd } from "../prose-table/prose-table";
import { ProseDl, ProseDt, ProseDd } from "../prose-dl/prose-dl";

const meta: StoryMeta = {
  title: "Typography",
  category: "Typography",
  description: "Full MDX general-element contract, demoed through the Prose* components rather than raw HTML.",
  usage: `import { ProseH2, ProseP, ProseA } from "@zudo-sg/ui/src/content/…";

<ProseH2>Section</ProseH2>
<ProseP>Body copy with an <ProseA href="#">inline link</ProseA>.</ProseP>`,
  order: 1,
};

export default meta;

export const AllElements: Story = {
  name: "All elements",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <ProseH2>Heading 2 — section</ProseH2>
      <ProseP>
        This is body copy (p). The Prose* components format MDX's general
        elements. Links render <ProseA href="#">like this</ProseA>.
      </ProseP>

      <ProseH3>Heading 3 — subsection</ProseH3>
      <ProseP>
        Inline text can be <ProseStrong>bold</ProseStrong>,{" "}
        <ProseEm>italic</ProseEm>, an <ProseA href="#">inline link</ProseA>,
        or <code>inline code</code>.
      </ProseP>

      <ProseH4>Heading 4</ProseH4>
      <ProseP>h4 is a body-sized bold heading.</ProseP>

      <ProseH5>Heading 5</ProseH5>
      <ProseH6>Heading 6</ProseH6>
      <ProseP>h5 / h6 render as muted, understated minor headings.</ProseP>

      <ProseH3>Unordered list</ProseH3>
      <ProseUl>
        <ProseLi>Item one</ProseLi>
        <ProseLi>
          Item with a nested list
          <ProseUl>
            <ProseLi>Nested item a</ProseLi>
            <ProseLi>Nested item b</ProseLi>
          </ProseUl>
        </ProseLi>
        <ProseLi>Item three</ProseLi>
      </ProseUl>

      <ProseH3>Ordered list</ProseH3>
      <ProseOl>
        <ProseLi>Step one</ProseLi>
        <ProseLi>Step two</ProseLi>
        <ProseLi>Step three</ProseLi>
      </ProseOl>

      <ProseH3>Blockquote</ProseH3>
      <ProseBlockquote>
        <ProseP>
          A blockquote is set apart from body copy with a left rule and muted
          text. It can hold multiple paragraphs.
        </ProseP>
      </ProseBlockquote>

      <ProseH3>Table</ProseH3>
      <ProseTable>
        <thead>
          <tr>
            <ProseTh>Token</ProseTh>
            <ProseTh>Purpose</ProseTh>
            <ProseTh>Value</ProseTh>
          </tr>
        </thead>
        <tbody>
          <tr>
            <ProseTd>color-bg</ProseTd>
            <ProseTd>Page background</ProseTd>
            <ProseTd>white</ProseTd>
          </tr>
          <tr>
            <ProseTd>color-surface</ProseTd>
            <ProseTd>Card surface</ProseTd>
            <ProseTd>light-grey</ProseTd>
          </tr>
          <tr>
            <ProseTd>color-accent</ProseTd>
            <ProseTd>Accent</ProseTd>
            <ProseTd>blue</ProseTd>
          </tr>
        </tbody>
      </ProseTable>

      <ProseH3>Definition list</ProseH3>
      <ProseDl>
        <ProseDt>hsp</ProseDt>
        <ProseDd>Horizontal spacing token axis.</ProseDd>
        <ProseDt>vsp</ProseDt>
        <ProseDd>Vertical spacing token axis.</ProseDd>
      </ProseDl>
    </div>
  ),
};

export const Headings: Story = {
  name: "Headings (h2-h6 scale)",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <ProseH2>h2 heading — section title</ProseH2>
      <ProseH3>h3 heading — subsection</ProseH3>
      <ProseH4>h4 heading — detail</ProseH4>
      <ProseH5>h5 heading — minor</ProseH5>
      <ProseH6>h6 heading — smallest</ProseH6>
    </div>
  ),
};

export const TextFormatting: Story = {
  name: "Text formatting",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <ProseP>Regular paragraph text. Line-height holds up across wraps.</ProseP>
      <ProseP>
        <ProseStrong>strong</ProseStrong> is bold, <ProseEm>em</ProseEm> is
        italic, <ProseA href="#">a</ProseA> is an accent-colored link, and{" "}
        <code>code</code> is inline code.
      </ProseP>
      <ProseP>
        <ProseStrong>
          <ProseEm>Combinations</ProseEm>
        </ProseStrong>{" "}
        work too.
      </ProseP>
    </div>
  ),
};

export const Lists: Story = {
  name: "Lists (ul / ol / nested)",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <ProseH3>Unordered</ProseH3>
      <ProseUl>
        <ProseLi>Item one</ProseLi>
        <ProseLi>
          Item two
          <ProseUl>
            <ProseLi>Nested a</ProseLi>
            <ProseLi>Nested b</ProseLi>
          </ProseUl>
        </ProseLi>
      </ProseUl>
      <ProseH3>Ordered</ProseH3>
      <ProseOl>
        <ProseLi>Step one</ProseLi>
        <ProseLi>Step two</ProseLi>
      </ProseOl>
    </div>
  ),
};

export const Table: Story = {
  name: "Table",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <ProseTable>
        <thead>
          <tr>
            <ProseTh>Column A</ProseTh>
            <ProseTh>Column B</ProseTh>
            <ProseTh>Column C</ProseTh>
          </tr>
        </thead>
        <tbody>
          <tr>
            <ProseTd>1</ProseTd>
            <ProseTd>2</ProseTd>
            <ProseTd>3</ProseTd>
          </tr>
          <tr>
            <ProseTd>4</ProseTd>
            <ProseTd>5</ProseTd>
            <ProseTd>6</ProseTd>
          </tr>
        </tbody>
      </ProseTable>
    </div>
  ),
};

export const QuoteAndDefinitionList: Story = {
  name: "Blockquote and definition list",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <ProseBlockquote>
        <ProseP>A blockquote is set apart with a left rule and muted text.</ProseP>
      </ProseBlockquote>
      <ProseDl>
        <ProseDt>hsp</ProseDt>
        <ProseDd>Horizontal spacing token axis.</ProseDd>
        <ProseDt>vsp</ProseDt>
        <ProseDd>Vertical spacing token axis.</ProseDd>
      </ProseDl>
    </div>
  ),
};
