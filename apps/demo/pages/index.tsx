import {
  Hero,
  Button,
  SectionHeading,
  Card,
  CardTitle,
  CardBody,
  CardFooter,
  Badge,
  Stat,
  StatGroup,
  Link,
} from "@zudo-sg/ui";
import SiteLayout from "../layouts/site-layout";

export const frontmatter = {
  title: "Home",
  description: "zudo-sg demo — a landing page composed entirely from @zudo-sg/ui.",
};

const FEATURES = [
  {
    badge: "Tokens",
    title: "Tight design tokens",
    body: "Two spacing axes, six font sizes, and a small semantic color set keep the UI coherent as it grows.",
  },
  {
    badge: "Dark mode",
    title: "Dark-correct by default",
    body: "Every color resolves through light-dark(), so components read correctly in both schemes with no extra markup.",
  },
  {
    badge: "Preact",
    title: "Zero-runtime markup",
    body: "Server-rendered Preact components ship as static HTML — interactivity is opt-in, not the default.",
  },
];

/** Demo landing page — composed from @zudo-sg/ui components. */
export default function HomePage() {
  return (
    <SiteLayout title="Home" activePath="/">
      <div class="flex flex-col gap-vsp-2xl">
        <Hero
          eyebrow="zudo-sg"
          title="A tight component system that scales"
          lede="Coherent spacing rhythm, consistent type, and dark-mode-correct color — drop in @zudo-sg/ui and build."
          actions={
            <>
              <Button href="/about">Learn more</Button>
              <Button variant="secondary" href="https://zudo-sg.takazudomodular.com/">
                View styleguide
              </Button>
            </>
          }
          media={
            <div class="rounded-lg bg-surface p-hsp-xl shadow-card">
              <StatGroup>
                <Stat value="11" label="Components" />
                <Stat value="3" label="Button variants" />
                <Stat value="6" label="Font sizes" />
                <Stat value="2" label="Spacing axes" />
              </StatGroup>
            </div>
          }
        />

        <section class="flex flex-col gap-vsp-lg">
          <SectionHeading
            description="A starter set big enough to assemble a real marketing page."
            action={
              <Link href="https://zudo-sg.takazudomodular.com/" variant="standalone">
                Browse all
              </Link>
            }
          >
            What you get
          </SectionHeading>

          <div class="grid gap-hsp-lg sm:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} variant="elevated">
                <Badge tone="brand">{f.badge}</Badge>
                <CardTitle>{f.title}</CardTitle>
                <CardBody>{f.body}</CardBody>
                <CardFooter>
                  <Link href="/about" variant="standalone">
                    Read more
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
