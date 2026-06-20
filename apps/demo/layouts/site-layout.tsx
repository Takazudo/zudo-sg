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

const SITE_NAME = "zudo-sg Demo";
const TAGLINE = "A demo site for the zudo-sg styleguide, built from @zudo-sg/ui.";

const NAV = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
];

const FOOTER_GROUPS = [
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
    ],
  },
];

/**
 * Shared page chrome for the demo site: document shell + SiteHeader / SiteFooter
 * from @zudo-sg/ui. Demonstrates the library composing a real layout.
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
            nav={NAV}
            activePath={activePath}
            action={
              <Button size="sm" variant="secondary" href="https://zudo-sg.takazudomodular.com/">
                Styleguide
              </Button>
            }
          />

          <main class="mx-auto w-full max-w-[72rem] flex-1 px-hsp-lg py-vsp-xl">{children}</main>

          <SiteFooter
            brand={SITE_NAME}
            tagline="A static Preact + Tailwind v4 demo built with zfb, composed from the shared @zudo-sg/ui component library."
            groups={FOOTER_GROUPS}
            copyright={`© ${new Date().getFullYear()} zudo-sg.`}
          />
        </div>
      </body>
    </html>
  );
}
