import type { StoryMeta, Story } from "../../stories/types";
import { CertList, type CertListProps, type Cert } from "./cert-list";

const meta: StoryMeta = {
  title: "CertList",
  category: "Content",
  description:
    "Management-certification list (e.g. ISO), each entry a code badge, name, and scope description.",
  usage: `import { CertList } from "@zudo-sg/ui/src/landing/cert-list/cert-list";

<CertList heading="Certifications" certs={certs} />`,
  order: 19,
};

export default meta;

const CERTS: Cert[] = [
  { code: "ISO 9001", name: "Quality management system", scope: "Certified across our core manufacturing sites." },
  { code: "ISO 14001", name: "Environmental management system", scope: "Continuous improvement of environmental impact and goal tracking." },
];

export const Default: Story<CertListProps> = {
  name: "Default (2 certifications)",
  render: () => (
    <div style={{ maxWidth: "880px" }}>
      <CertList heading="Certifications" certs={CERTS} />
    </div>
  ),
};

export const Single: Story<CertListProps> = {
  name: "Single certification",
  render: () => (
    <div style={{ maxWidth: "880px" }}>
      <CertList
        heading="Environmental certification"
        certs={[
          { code: "ISO 14001", name: "Environmental management system", scope: "Reducing environmental impact through continuous improvement." },
        ]}
      />
    </div>
  ),
};

export const Narrow: Story<CertListProps> = {
  name: "Narrow (card wrap)",
  render: () => (
    <div style={{ maxWidth: "360px" }}>
      <CertList heading="Certifications" certs={CERTS} />
    </div>
  ),
};
