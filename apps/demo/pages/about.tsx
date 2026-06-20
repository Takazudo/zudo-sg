import { PageHeading, Link, Card, CardTitle, CardBody } from "@zudo-sg/ui";
import SiteLayout from "../layouts/site-layout";

export const frontmatter = {
  title: "About",
  description: "About the zudo-sg demo site.",
};

const FACTS = [
  { title: "Framework", body: "zfb — Preact + Tailwind v4, static export." },
  { title: "Hosting", body: "Cloudflare Pages (fully static)." },
  { title: "Components", body: "@zudo-sg/ui — the shared component library." },
];

/** About page — composed from @zudo-sg/ui components. */
export default function AboutPage() {
  return (
    <SiteLayout title="About" activePath="/about">
      <div class="flex flex-col gap-vsp-xl">
        <PageHeading
          eyebrow="About"
          description={
            <>
              This demo site is part of the{" "}
              <Link href="https://github.com/Takazudo/zudo-sg">zudo-sg</Link> monorepo. It composes a
              static zfb site entirely from the shared component library.
            </>
          }
        >
          About this demo
        </PageHeading>

        <div class="grid gap-hsp-lg sm:grid-cols-3">
          {FACTS.map((fact) => (
            <Card key={fact.title}>
              <CardTitle>{fact.title}</CardTitle>
              <CardBody>{fact.body}</CardBody>
            </Card>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
