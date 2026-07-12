import { cx } from "../../lib/cx";
import { Card } from "../../cards/card/card";
import { SectionHeading } from "../../shared/section-heading/section-heading";
import { AutoGrid } from "../../shared/auto-grid/auto-grid";
import { ViewAllLink } from "../../shared/card-link/card-link";

export type DiscoveryScene = { title: string; body: string };

export type DiscoveryTeaserProps = {
  heading: string;
  intro?: string;
  scenes: DiscoveryScene[];
  href: string;
  linkLabel?: string;
  class?: string;
};

/**
 * DiscoveryTeaser — top-page excerpt showing a handful of "where our products
 * show up" scenes, teasing through to a fuller scene gallery page.
 */
export function DiscoveryTeaser({
  heading,
  intro,
  scenes,
  href,
  linkLabel = "See all scenes",
  class: cls,
}: DiscoveryTeaserProps) {
  return (
    <section class={cx("flex flex-col gap-y-vsp-md", cls)} aria-label={heading}>
      <SectionHeading heading={heading} intro={intro} />

      <AutoGrid min="14rem">
        {scenes.map((scene) => (
          <Card key={scene.title} variant="muted" class="h-full">
            <Card.Title>{scene.title}</Card.Title>
            <p class="text-small leading-relaxed text-fg">{scene.body}</p>
          </Card>
        ))}
      </AutoGrid>

      <p>
        <ViewAllLink href={href}>{linkLabel}</ViewAllLink>
      </p>
    </section>
  );
}
