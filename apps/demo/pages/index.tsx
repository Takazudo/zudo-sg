import {
  Hero,
  Button,
  PageHeading,
  SectionHeading,
  Card,
  CardTitle,
  CardBody,
  CardFooter,
  Badge,
  Stat,
  StatGroup,
  Link,
  Field,
  Input,
  Textarea,
} from "@zudo-sg/ui";
import SiteLayout from "../layouts/site-layout";

export const frontmatter = {
  title: "Home",
  description:
    "Northwind — a demo marketing site composed entirely from @zudo-sg/ui components.",
};

// ── Dummy content (issue #1: real copy "will write later"; lorem is fine) ──

const SERVICES = [
  {
    badge: "01",
    title: "Product strategy",
    body: "We pressure-test the idea before a line of code is written — market signals, user research, and a roadmap your stakeholders can actually fund.",
    points: ["Discovery sprints", "Roadmapping", "Success metrics"],
  },
  {
    badge: "02",
    title: "Design systems",
    body: "Interfaces that scale: a token-driven design system, accessible by default, documented so every team ships a consistent product.",
    points: ["UI & interaction design", "Component libraries", "Accessibility audits"],
  },
  {
    badge: "03",
    title: "Engineering",
    body: "Senior engineers who own delivery end to end — typed front ends, resilient APIs, and deploys you trust on a Friday afternoon.",
    points: ["Web & mobile builds", "Platform & APIs", "CI/CD & observability"],
  },
  {
    badge: "04",
    title: "Scale & support",
    body: "Once it ships we stay close — performance work, growth experiments, and an on-call partnership that keeps the product healthy.",
    points: ["Performance tuning", "Growth experiments", "Managed maintenance"],
  },
];

const PRINCIPLES = [
  {
    title: "Small teams, senior people",
    body: "No layers of account managers. The people who scope your work are the people who do it.",
  },
  {
    title: "Evidence over opinion",
    body: "Every decision ties back to a metric or a user signal. We instrument first, then iterate.",
  },
  {
    title: "Build to hand over",
    body: "Typed, tested, documented code your in-house team can own the day we step back.",
  },
];

const MILESTONES = [
  { year: "2016", text: "Founded by three engineers." },
  { year: "2019", text: "Grew to a 20-person product team." },
  { year: "2022", text: "Opened a remote-first European practice." },
  { year: "2025", text: "120+ products shipped across 6 industries." },
];

const CHANNELS = [
  { label: "Email", value: "hello@northwind.example", href: "mailto:hello@northwind.example" },
  { label: "Phone", value: "+1 (206) 555-0142", href: "tel:+12065550142" },
  { label: "Studio", value: "412 Pike Street, Seattle WA", href: null },
];

/**
 * Northwind demo landing page — a single polished marketing page composed
 * entirely from @zudo-sg/ui components. Section structure (Hero → Services →
 * About → Contact → Footer) mirrors the corporate-website reference; styling is
 * the shared tight-token system, so it is dark-correct and responsive for free.
 */
export default function HomePage() {
  return (
    <SiteLayout title="Home" activePath="/">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section class="px-hsp-lg pt-vsp-xl pb-vsp-2xl">
        <Hero
          eyebrow="Product engineering partner"
          title="We build digital products that earn their keep"
          lede="Northwind pairs senior engineers with product strategists and designers, so the thing you ship is the thing your customers actually needed — measured, not guessed."
          actions={
            <>
              <Button size="lg" href="#contact">
                Start a project
              </Button>
              <Button size="lg" variant="secondary" href="#services">
                See how we work
              </Button>
            </>
          }
          media={
            <div class="flex flex-col gap-vsp-md rounded-lg bg-surface p-hsp-xl shadow-card">
              <div class="flex items-center justify-between gap-hsp-md">
                <span class="text-sm font-semibold text-ink">Trusted outcomes</span>
                <Badge tone="success">On track</Badge>
              </div>
              <StatGroup divided>
                <Stat value="120+" label="Products shipped" />
                <Stat value="9 yrs" label="Avg. team tenure" />
                <Stat value="4.9/5" label="Client rating" />
              </StatGroup>
            </div>
          }
        />
      </section>

      {/* ── Services / feature cards ───────────────────────────────────── */}
      <section id="services" class="bg-surface-sunken px-hsp-lg py-vsp-2xl">
        <div class="mx-auto flex w-full max-w-[72rem] flex-col gap-vsp-xl">
          <SectionHeading description="Most agencies hand you a deliverable and disappear. We stay accountable from the first whiteboard sketch to the metrics review six months after launch.">
            One partner, the whole product lifecycle
          </SectionHeading>

          <div class="grid gap-hsp-lg sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service) => (
              <Card key={service.badge} variant="elevated">
                <Badge tone="brand" variant="solid">
                  {service.badge}
                </Badge>
                <CardTitle>{service.title}</CardTitle>
                <CardBody>{service.body}</CardBody>
                <CardFooter>
                  <ul class="flex flex-col gap-vsp-3xs text-sm text-ink-soft">
                    {service.points.map((point) => (
                      <li key={point} class="flex items-center gap-hsp-xs">
                        <span aria-hidden="true" class="text-brand">
                          →
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ──────────────────────────────────────────────────────── */}
      <section id="about" class="px-hsp-lg py-vsp-2xl">
        <div class="mx-auto grid w-full max-w-[72rem] gap-hsp-2xl lg:grid-cols-2 lg:items-start">
          <div class="flex flex-col gap-vsp-lg">
            <PageHeading
              as="h2"
              eyebrow="Who we are"
              description="Northwind started with a simple frustration: too many digital projects shipped late, over budget, and missing the point. We set out to build a studio where senior practitioners stay on the tools and own the outcome."
            >
              A studio built around accountability
            </PageHeading>

            <ul class="flex flex-col gap-vsp-md">
              {PRINCIPLES.map((principle) => (
                <li key={principle.title} class="flex flex-col gap-vsp-3xs">
                  <h3 class="flex items-center gap-hsp-sm text-lg font-semibold tracking-tight text-ink">
                    <span aria-hidden="true" class="inline-block size-[0.5rem] rounded-full bg-brand" />
                    {principle.title}
                  </h3>
                  <p class="text-sm text-ink-soft text-pretty">{principle.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <Card variant="filled">
            <CardTitle>Milestones</CardTitle>
            <ol class="mt-vsp-xs flex flex-col gap-vsp-md">
              {MILESTONES.map((item) => (
                <li key={item.year} class="flex gap-hsp-lg">
                  <Badge tone="neutral" variant="outline">
                    {item.year}
                  </Badge>
                  <span class="text-sm text-ink-soft">{item.text}</span>
                </li>
              ))}
            </ol>
            <CardFooter>
              <Link href="https://github.com/Takazudo/zudo-sg" variant="standalone" external>
                Read the project background
              </Link>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* ── Contact ────────────────────────────────────────────────────── */}
      <section id="contact" class="bg-surface-sunken px-hsp-lg py-vsp-2xl">
        <div class="mx-auto grid w-full max-w-[72rem] gap-hsp-2xl lg:grid-cols-2 lg:items-start">
          <div class="flex flex-col gap-vsp-lg">
            <SectionHeading description="Send a few lines about your product and timeline. You'll hear back from a senior member of the team within one business day — no sales funnel, no scripted demo.">
              Tell us what you're building
            </SectionHeading>

            <ul class="flex flex-col gap-vsp-md">
              {CHANNELS.map((channel) => (
                <li key={channel.label} class="flex flex-col gap-vsp-3xs">
                  <span class="text-xs font-semibold uppercase tracking-wide text-ink-mute">
                    {channel.label}
                  </span>
                  {channel.href ? (
                    <Link href={channel.href}>{channel.value}</Link>
                  ) : (
                    <span class="text-sm text-ink-soft">{channel.value}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <Card variant="elevated">
            <form action="#" method="post" class="flex flex-col gap-vsp-md">
              <Field label="Name" required>
                {(props) => (
                  <Input
                    {...props}
                    name="name"
                    autocomplete="name"
                    placeholder="Jordan Avery"
                    required
                  />
                )}
              </Field>

              <Field label="Work email" required>
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    name="email"
                    autocomplete="email"
                    placeholder="jordan@company.example"
                    required
                  />
                )}
              </Field>

              <Field
                label="About the project"
                hint="A few lines on what you're building and what success looks like."
                required
              >
                {(props) => (
                  <Textarea
                    {...props}
                    name="project"
                    rows={4}
                    placeholder="What are you building, and what does success look like?"
                    required
                  />
                )}
              </Field>

              <Button type="submit" block>
                Send the brief
              </Button>
              <p class="text-xs text-ink-mute">
                This demo form is static — submissions are not stored.
              </p>
            </form>
          </Card>
        </div>
      </section>
    </SiteLayout>
  );
}
