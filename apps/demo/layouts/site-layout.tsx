import type { ComponentChildren } from "preact";
import { SiteHeader, SiteFooter, Button } from "@zudo-sg/ui";
import "../styles/global.css";

type Props = {
  /** Document <title>. */
  title?: string;
  /** Highlight the active nav link. */
  activePath?: string;
  children: ComponentChildren;
};

const SITE_NAME = "Northwind";
const TAGLINE = "Northwind — a demo marketing site composed entirely from the shared @zudo-sg/ui component library.";

// Single-page landing site: nav targets are in-page section anchors.
const NAV = [
  { label: "Services", href: "#services" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const FOOTER_GROUPS = [
  {
    heading: "Company",
    links: [
      { label: "Services", href: "#services" },
      { label: "About", href: "#about" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    heading: "Project",
    links: [
      { label: "Styleguide", href: "https://zudo-sg.takazudomodular.com/" },
      { label: "Repository", href: "https://github.com/Takazudo/zudo-sg" },
    ],
  },
  {
    heading: "Built with",
    links: [
      { label: "zfb", href: "https://github.com/Takazudo/zudo-front-builder" },
      { label: "Preact", href: "https://preactjs.com/" },
      { label: "Tailwind v4", href: "https://tailwindcss.com/" },
    ],
  },
];

/**
 * Shared page chrome for the demo site: document shell + SiteHeader / SiteFooter
 * from @zudo-sg/ui. Demonstrates the library composing a real marketing layout.
 */
export default function SiteLayout({ title, activePath = "/", children }: Props) {
  const pageTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={TAGLINE} />
        <title>{pageTitle}</title>
      </head>
      <body>
        <div class="flex min-h-dvh flex-col">
          <SiteHeader
            brand={SITE_NAME}
            brandHref="/"
            nav={NAV}
            activePath={activePath}
            action={
              <Button size="sm" href="#contact">
                Start a project
              </Button>
            }
          />

          <main class="flex-1">{children}</main>

          <SiteFooter
            brand={SITE_NAME}
            tagline="A static Preact + Tailwind v4 marketing demo built with zfb, composed from the shared @zudo-sg/ui component library."
            groups={FOOTER_GROUPS}
            copyright={`© ${new Date().getFullYear()} Northwind. A demo site for the zudo-sg styleguide.`}
          />
        </div>
      </body>
    </html>
  );
}
