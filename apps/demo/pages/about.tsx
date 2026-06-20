import SiteLayout from "../layouts/site-layout";

export const frontmatter = {
  title: "About",
  description: "About the zudo-sg demo site.",
};

/** About page. */
export default function AboutPage() {
  return (
    <SiteLayout title="About" activePath="/about">
      <section class="flex flex-col gap-vsp-md">
        <h1 class="text-display font-bold tracking-tight text-ink">About</h1>
        <p class="max-w-[40rem] text-body text-ink-soft">
          This demo site is part of the{" "}
          <a href="https://github.com/Takazudo/zudo-sg" class="text-brand underline">
            zudo-sg
          </a>{" "}
          monorepo. It demonstrates a static zfb site using the Tailwind v4 token system from
          the webshop baseline.
        </p>
        <ul class="flex flex-col gap-vsp-xs text-body text-ink-soft">
          <li>
            <strong class="text-ink">Framework:</strong> zfb (Preact + Tailwind v4)
          </li>
          <li>
            <strong class="text-ink">Hosting:</strong> Cloudflare Pages (static)
          </li>
          <li>
            <strong class="text-ink">Styleguide:</strong>{" "}
            <a href="https://zudo-sg.takazudomodular.com/" class="text-brand underline">
              zudo-sg.takazudomodular.com
            </a>
          </li>
        </ul>
      </section>
    </SiteLayout>
  );
}
