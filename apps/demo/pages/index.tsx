import SiteLayout from "../layouts/site-layout";

export const frontmatter = {
  title: "Home",
  description: "zudo-sg demo site — Preact + Tailwind v4 static site.",
};

/** Demo homepage. */
export default function HomePage() {
  return (
    <SiteLayout title="Home" activePath="/">
      <section class="flex flex-col gap-vsp-md">
        <div class="flex flex-col gap-vsp-xs rounded-lg bg-brand-soft px-hsp-lg py-vsp-lg">
          <h1 class="text-display font-bold tracking-tight text-ink">
            zudo-sg Demo Site
          </h1>
          <p class="max-w-[40rem] text-body text-ink-soft">
            A static Preact + Tailwind v4 demo built with zfb. This site lives
            alongside the zudo-sg styleguide and shares components from{" "}
            <code class="rounded bg-brand-soft px-hsp-2xs font-mono text-small">@zudo-sg/ui</code>.
          </p>
          <div class="flex gap-hsp-sm">
            <a
              href="/about"
              class="rounded-md bg-brand px-hsp-md py-vsp-xs text-small font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              Learn more
            </a>
            <a
              href="https://zudo-sg.takazudomodular.com/"
              class="rounded-md border border-line px-hsp-md py-vsp-xs text-small font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              View styleguide
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
