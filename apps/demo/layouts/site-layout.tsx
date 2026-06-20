import type { ComponentChildren } from "preact";
import "../styles/global.css";

type Props = {
  /** Document <title>. */
  title?: string;
  /** Highlight the active nav link. */
  activePath?: string;
  children: ComponentChildren;
};

const SITE_NAME = "zudo-sg Demo";
const TAGLINE = "A demo site for the zudo-sg styleguide.";

/**
 * Shared page chrome for the demo site: document shell, sticky header
 * with nav links, and footer.
 */
export default function SiteLayout({
  title,
  activePath = "/",
  children,
}: Props) {
  const pageTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  const navLink = (href: string, label: string) => {
    const active = activePath === href;
    return (
      <a
        href={href}
        class={`rounded-sm px-hsp-xs py-vsp-2xs text-small transition-colors hover:text-brand ${
          active ? "font-semibold text-brand" : "text-ink-soft"
        }`}
        aria-current={active ? "page" : undefined}
      >
        {label}
      </a>
    );
  };

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
          <header class="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
            <div class="mx-auto flex w-full max-w-[72rem] items-center justify-between gap-hsp-md px-hsp-md py-vsp-sm">
              <a href="/" class="flex items-baseline gap-hsp-xs">
                <span class="text-heading font-bold tracking-tight text-ink">{SITE_NAME}</span>
                <span class="hidden text-micro text-ink-soft sm:inline">{TAGLINE}</span>
              </a>
              <nav class="flex items-center gap-hsp-xs">
                {navLink("/", "Home")}
                {navLink("/about", "About")}
              </nav>
            </div>
          </header>

          <main class="mx-auto w-full max-w-[72rem] flex-1 px-hsp-md py-vsp-lg">{children}</main>

          <footer class="border-t border-line bg-surface-sunken">
            <div class="mx-auto flex w-full max-w-[72rem] flex-col gap-vsp-2xs px-hsp-md py-vsp-md text-micro text-ink-soft">
              <p class="font-semibold text-ink-soft">{SITE_NAME}</p>
              <p>
                A demo site built with{" "}
                <a href="https://github.com/Takazudo/zudo-front-builder" class="text-brand underline">
                  zfb
                </a>{" "}
                — part of the zudo-sg styleguide monorepo.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
